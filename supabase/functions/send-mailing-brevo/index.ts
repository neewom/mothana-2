import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { fetchAllRows } from '../_shared/fetchAllRows.ts'
import { resolveOrganisationId } from '../_shared/resolveOrganisationId.ts'
import { secretAleatoire } from '../_shared/secretAleatoire.ts'
import {
  avecBoutonRenouvellement,
  empreinteSecret,
  lienRenouvellement,
  origineSite,
  utiliseLienRenouvellement,
} from './lienRenouvellement.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

// Limite Brevo /v3/smtp/email : jusqu'à 1000 destinataires personnalisés par appel (messageVersions).
const BREVO_BATCH_SIZE = 1000
// Validation simple (pas de RFC 5322 complet) : suffisante pour écarter les valeurs
// clairement mal saisies (espace, domaine tronqué) qui font échouer tout le batch Brevo
// (Brevo rejette l'intégralité de messageVersions si une seule adresse est invalide).
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024
const MAX_ATTACHMENTS = 3

interface PieceJointe {
  nom: string
  contenu_base64: string
  type_mime: string
}

function validateAttachments(pieces: unknown): PieceJointe[] | null {
  if (pieces === null || pieces === undefined) return []
  if (!Array.isArray(pieces) || pieces.length > MAX_ATTACHMENTS) return null
  for (const p of pieces) {
    if (typeof p?.nom !== 'string' || typeof p?.contenu_base64 !== 'string' || typeof p?.type_mime !== 'string') return null
    const decodedBytes = Math.floor((p.contenu_base64.length * 3) / 4)
    if (decodedBytes > MAX_ATTACHMENT_BYTES) return null
  }
  return pieces as PieceJointe[]
}

interface AdherentDestinataire {
  id: string
  courriel: string
  nom: string
  prenom: string | null
  mailing_unsubscribe_token: string
  tags: string[]
  email_invalide_at: string | null
}

/** 'valide' | 'non_valide' (Brevo a répondu : expéditeur absent ou inactif) | 'impossible'. */
async function verifierExpediteur(apiKey: string, email: string): Promise<'valide' | 'non_valide' | 'impossible'> {
  try {
    const res = await fetch('https://api.brevo.com/v3/senders', {
      headers: { 'api-key': apiKey, Accept: 'application/json' },
    })
    if (!res.ok) {
      console.warn('send-mailing-brevo: GET /v3/senders', res.status)
      return 'impossible'
    }
    const { senders } = (await res.json()) as { senders?: { email?: string; active?: boolean }[] }
    const cible = email.trim().toLowerCase()
    return (senders ?? []).some((s) => s.email?.trim().toLowerCase() === cible && s.active === true)
      ? 'valide'
      : 'non_valide'
  } catch (err) {
    console.warn('send-mailing-brevo: GET /v3/senders failed', String(err))
    return 'impossible'
  }
}

function unsubscribeFooterHtml(): string {
  return `<hr style="margin-top:32px;border:none;border-top:1px solid #e2e8f0;" />
<p style="margin-top:16px;font-size:11px;color:#94a3b8;">
  <a href="{{params.lien_desinscription}}" style="color:#94a3b8;">Se désinscrire</a>
</p>`
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const authHeader = req.headers.get('authorization')
    if (!authHeader) {
      return jsonResponse({ error: 'Non autorisé' }, 401)
    }

    const { sujet, corps_html, filtre_statut, tag_envoi, exclude_tag, pieces_jointes, site_url, organisation_id } = await req.json()

    if (!sujet || typeof sujet !== 'string' || !corps_html || typeof corps_html !== 'string') {
      return jsonResponse({ error: 'Sujet et contenu du message requis' }, 400)
    }
    if (!['actif', 'archive', 'tous'].includes(filtre_statut)) {
      return jsonResponse({ error: 'Filtre de statut invalide' }, 400)
    }
    if (tag_envoi !== null && tag_envoi !== undefined && typeof tag_envoi !== 'string') {
      return jsonResponse({ error: 'Liste de diffusion invalide' }, 400)
    }
    if (exclude_tag !== null && exclude_tag !== undefined && typeof exclude_tag !== 'string') {
      return jsonResponse({ error: "Liste d'exclusion invalide" }, 400)
    }
    if (!site_url || typeof site_url !== 'string') {
      return jsonResponse({ error: 'site_url requis' }, 400)
    }

    const attachments = validateAttachments(pieces_jointes)
    if (attachments === null) {
      return jsonResponse({ error: `Pièces jointes invalides (${MAX_ATTACHMENTS} fichiers max, 10 Mo max par fichier)` }, 400)
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!

    // Verify caller's identity
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false },
    })

    const { data: { user }, error: userError } = await userClient.auth.getUser()
    if (userError || !user) {
      return jsonResponse({ error: 'Non autorisé' }, 401)
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false },
    })

    // Caller must be admin for an organisation, or super-admin with an explicit organisation_id
    const resolved = await resolveOrganisationId(adminClient, user, organisation_id)
    if (!resolved) {
      return jsonResponse({ error: 'Accès refusé' }, 403)
    }

    const organisationId = resolved.organisationId

    // ---------------------------------------------------------------------
    // 1. Config Brevo de l'organisation
    // ---------------------------------------------------------------------

    // Clé API dans organisation_secrets (plus lisible par les membres), expéditeur dans organisations.
    const [{ data: expediteur }, { data: secret }] = await Promise.all([
      adminClient.from('organisations').select('slug, brevo_expediteur_nom, brevo_expediteur_email').eq('id', organisationId).single(),
      adminClient.from('organisation_secrets').select('brevo_api_key').eq('organisation_id', organisationId).maybeSingle(),
    ])
    const org = expediteur ? { ...expediteur, brevo_api_key: secret?.brevo_api_key ?? null } : null

    if (!org?.brevo_api_key || !org.brevo_expediteur_nom || !org.brevo_expediteur_email) {
      return jsonResponse(
        { error: "Configuration Brevo incomplète pour votre organisation. Renseignez la clé API et l'expéditeur." },
        422,
      )
    }

    // Expéditeur vérifié chez Brevo (cadré 2026-10-23) : un expéditeur non validé fait rejeter
    // l'envoi par Brevo, destinataire par destinataire. Refus seulement si Brevo répond et que
    // l'expéditeur est absent ou inactif ; si la vérification est impossible (clé API à
    // permissions restreintes → 403, 401, 5xx, réseau), l'envoi part quand même —
    // brevo-bounce-webhook ne marque de toute façon pas les rejets côté expéditeur.
    const verification = await verifierExpediteur(org.brevo_api_key, org.brevo_expediteur_email)
    if (verification === 'non_valide') {
      return jsonResponse(
        {
          error: `L'expéditeur ${org.brevo_expediteur_email} n'est pas validé dans Brevo : validez-le ou authentifiez votre domaine, puis réessayez.`,
          code: 'EXPEDITEUR_NON_VALIDE',
        },
        422,
      )
    }
    if (verification === 'impossible') {
      console.warn('send-mailing-brevo: vérification de l\'expéditeur impossible, envoi maintenu')
    }

    // Lien personnel de renouvellement : généré seulement si le corps l'utilise.
    const avecLienRenouvellement = utiliseLienRenouvellement(corps_html)
    if (avecLienRenouvellement && !org.slug) {
      return jsonResponse(
        { error: "Lien de renouvellement impossible : l'organisation n'a pas d'adresse de formulaire d'adhésion (identifiant public)." },
        422,
      )
    }
    const origine = origineSite(site_url, supabaseUrl)

    // ---------------------------------------------------------------------
    // 2. Destinataires
    // ---------------------------------------------------------------------

    // Toutes les pages (au-delà de 1 000 adhérents, PostgREST tronquerait l'envoi), ordre stable.
    const { data: adherentsData, error: adherentsError } = await fetchAllRows<AdherentDestinataire>((from, to) => {
      let query = adminClient
        .from('adherents')
        .select('id, courriel, nom, prenom, mailing_unsubscribe_token, tags, email_invalide_at')
        .eq('organisation_id', organisationId)
        .eq('mailing_opt_out', false)

      // Sélectionner une liste de diffusion prime sur le statut actif/archivé
      // (envoie à tous les porteurs du tag, peu importe leur statut).
      if (tag_envoi) {
        query = query.contains('tags', [tag_envoi])
      } else if (filtre_statut !== 'tous') {
        query = query.eq('statut', filtre_statut)
      }

      return query.order('id').range(from, to)
    })

    if (adherentsError) {
      console.error('adherents query error:', adherentsError)
      return jsonResponse({ error: 'Erreur lors du chargement des adhérents' }, 500)
    }

    const tousAdherents = adherentsData.filter(
      (a) => !exclude_tag || !(a.tags ?? []).includes(exclude_tag),
    )
    // Même classement que src/lib/mailingRecipients.ts : email manquant, format invalide ou
    // adresse rejetée lors d'un envoi précédent (email_invalide_at, rejet Brevo) → exclu.
    const destinataires = tousAdherents.filter(
      (a) => a.courriel && EMAIL_REGEX.test(a.courriel.trim()) && !a.email_invalide_at,
    )
    const nombreExclus = tousAdherents.length - destinataires.length

    if (destinataires.length === 0) {
      return jsonResponse({ error: 'Aucun destinataire avec une adresse email' }, 422)
    }

    // ---------------------------------------------------------------------
    // 3. Envoi par lots (mode batch Brevo, messageVersions)
    // ---------------------------------------------------------------------

    const brevoAttachment = attachments.length > 0
      ? attachments.map((a) => ({ content: a.contenu_base64, name: a.nom }))
      : undefined

    const htmlContentAvecFooter =
      (avecLienRenouvellement ? avecBoutonRenouvellement(corps_html) : corps_html) + unsubscribeFooterHtml()

    for (let i = 0; i < destinataires.length; i += BREVO_BATCH_SIZE) {
      const chunk = destinataires.slice(i, i + BREVO_BATCH_SIZE)

      // Un secret par destinataire, gardé en mémoire le temps de l'appel Brevo ; seule son
      // empreinte est insérée. Les liens précédents ne sont révoqués qu'après un envoi réussi.
      let liensParAdherent: Map<string, string> | null = null
      let nouveauxLiens: string[] = []
      if (avecLienRenouvellement) {
        const secrets = chunk.map((a) => ({ adherentId: a.id, secret: secretAleatoire() }))
        const lignes = await Promise.all(secrets.map(async ({ adherentId, secret }) => ({
          organisation_id: organisationId,
          adherent_id: adherentId,
          secret_hash: await empreinteSecret(secret),
        })))
        const { data: inseres, error: lienError } = await adminClient
          .from('liens_renouvellement')
          .insert(lignes)
          .select('id')
        if (lienError || !inseres) {
          console.error('send-mailing-brevo: insertion des liens de renouvellement', lienError?.code, lienError?.message)
          return jsonResponse({ error: 'Erreur lors de la création des liens de renouvellement' }, 500)
        }
        nouveauxLiens = inseres.map((l) => l.id as string)
        liensParAdherent = new Map(secrets.map(({ adherentId, secret }) => [adherentId, lienRenouvellement(origine, org.slug!, secret)]))
      }

      const brevoRes = await fetch('https://api.brevo.com/v3/smtp/email', {
        method: 'POST',
        headers: {
          'api-key': org.brevo_api_key,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({
          sender: { name: org.brevo_expediteur_nom, email: org.brevo_expediteur_email },
          subject: sujet,
          htmlContent: htmlContentAvecFooter,
          messageVersions: chunk.map((a) => ({
            to: [{ email: a.courriel.trim(), name: [a.prenom, a.nom].filter(Boolean).join(' ') }],
            params: {
              prenom: a.prenom ?? '',
              nom: a.nom,
              lien_desinscription: `${site_url}/desinscription?token=${a.mailing_unsubscribe_token}`,
              ...(liensParAdherent ? { lien_renouvellement: liensParAdherent.get(a.id) } : {}),
            },
          })),
          ...(brevoAttachment ? { attachment: brevoAttachment } : {}),
        }),
      })

      if (!brevoRes.ok) {
        const detail = await brevoRes.text()
        console.error('Brevo error:', brevoRes.status, detail)
        if (nouveauxLiens.length > 0) {
          const { error } = await adminClient.rpc('revoquer_liens_renouvellement', { p_ids: nouveauxLiens })
          if (error) console.error('send-mailing-brevo: révocation des liens non envoyés', error.code, error.message)
        }
        return jsonResponse({ error: "Erreur lors de l'envoi via Brevo", detail }, 502)
      }

      if (nouveauxLiens.length > 0) {
        const { error } = await adminClient.rpc('remplacer_liens_renouvellement', { p_nouveaux: nouveauxLiens })
        // Non bloquant : l'email est parti ; l'ancien lien reste seulement valide jusqu'à son expiration.
        if (error) console.error('send-mailing-brevo: révocation des anciens liens', error.code, error.message)
      }
    }

    // ---------------------------------------------------------------------
    // 4. Historique
    // ---------------------------------------------------------------------

    const { error: historiqueError } = await adminClient.from('campagnes_mailing').insert({
      organisation_id: organisationId,
      sujet,
      corps_html,
      nombre_destinataires: destinataires.length,
      nombre_exclus: nombreExclus,
      envoye_par: user.id,
    })

    if (historiqueError) {
      console.error('Historique insert error:', historiqueError)
      // Non-bloquant : l'envoi a réussi, seul l'historique échoue
    }

    return jsonResponse({ nombre_destinataires: destinataires.length, nombre_exclus: nombreExclus })
  } catch (err) {
    console.error('send-mailing-brevo error:', err)
    return jsonResponse({ error: 'Erreur serveur', detail: String(err) }, 500)
  }
})
