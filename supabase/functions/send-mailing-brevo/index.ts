import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

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
  courriel: string
  nom: string
  prenom: string | null
  mailing_unsubscribe_token: string
  tags: string[]
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

    const { sujet, corps_html, filtre_statut, tag_envoi, exclude_tag, pieces_jointes, site_url } = await req.json()

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

    // Caller must be admin for an organisation
    const { data: profilOrg } = await adminClient
      .from('profils_organisation')
      .select('organisation_id, role')
      .eq('utilisateur_id', user.id)
      .eq('role', 'admin')
      .single()

    if (!profilOrg) {
      return jsonResponse({ error: 'Accès refusé' }, 403)
    }

    const organisationId = profilOrg.organisation_id

    // ---------------------------------------------------------------------
    // 1. Config Brevo de l'organisation
    // ---------------------------------------------------------------------

    const { data: org } = await adminClient
      .from('organisations')
      .select('brevo_api_key, brevo_expediteur_nom, brevo_expediteur_email')
      .eq('id', organisationId)
      .single()

    if (!org?.brevo_api_key || !org.brevo_expediteur_nom || !org.brevo_expediteur_email) {
      return jsonResponse(
        { error: "Configuration Brevo incomplète pour votre organisation. Renseignez la clé API et l'expéditeur." },
        422,
      )
    }

    // ---------------------------------------------------------------------
    // 2. Destinataires
    // ---------------------------------------------------------------------

    let query = adminClient
      .from('adherents')
      .select('courriel, nom, prenom, mailing_unsubscribe_token, tags')
      .eq('organisation_id', organisationId)
      .eq('mailing_opt_out', false)

    // Sélectionner une liste de diffusion prime sur le statut actif/archivé
    // (envoie à tous les porteurs du tag, peu importe leur statut).
    if (tag_envoi) {
      query = query.contains('tags', [tag_envoi])
    } else if (filtre_statut !== 'tous') {
      query = query.eq('statut', filtre_statut)
    }

    const { data: adherentsData, error: adherentsError } = await query

    if (adherentsError) {
      console.error('adherents query error:', adherentsError)
      return jsonResponse({ error: 'Erreur lors du chargement des adhérents' }, 500)
    }

    const tousAdherents = ((adherentsData ?? []) as AdherentDestinataire[]).filter(
      (a) => !exclude_tag || !(a.tags ?? []).includes(exclude_tag),
    )
    const destinataires = tousAdherents.filter((a) => a.courriel && a.courriel.trim() !== '')
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

    const htmlContentAvecFooter = corps_html + unsubscribeFooterHtml()

    for (let i = 0; i < destinataires.length; i += BREVO_BATCH_SIZE) {
      const chunk = destinataires.slice(i, i + BREVO_BATCH_SIZE)

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
            to: [{ email: a.courriel, name: [a.prenom, a.nom].filter(Boolean).join(' ') }],
            params: {
              prenom: a.prenom ?? '',
              nom: a.nom,
              lien_desinscription: `${site_url}/desinscription?token=${a.mailing_unsubscribe_token}`,
            },
          })),
          ...(brevoAttachment ? { attachment: brevoAttachment } : {}),
        }),
      })

      if (!brevoRes.ok) {
        const detail = await brevoRes.text()
        console.error('Brevo error:', brevoRes.status, detail)
        return jsonResponse({ error: "Erreur lors de l'envoi via Brevo", detail }, 502)
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
