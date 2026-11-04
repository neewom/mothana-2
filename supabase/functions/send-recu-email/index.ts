import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { resolveOrganisationId } from '../_shared/resolveOrganisationId.ts'
import { rendreEmailRecu, rendreObjetEmailRecu, valeursEmailRecu } from '../_shared/recuEmail.ts'
import { sendViaResend } from '../_shared/resend.ts'
import { envoyerEmailRecu } from './envoi.ts'

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

function bytesToBase64(bytes: Uint8Array): string {
  let binary = ''
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i])
  return btoa(binary)
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

    const { profil_participant_id, annee, organisation_id } = await req.json()
    const anneeNum = Number(annee)
    if (!profil_participant_id || !annee || Number.isNaN(anneeNum)) {
      return jsonResponse({ error: 'Paramètres manquants' }, 400)
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

    // Expéditeur et modèle d'email dans organisations, clé API Brevo dans organisation_secrets.
    const [{ data: org }, { data: secret }] = await Promise.all([
      adminClient
        .from('organisations')
        .select('nom, brevo_expediteur_nom, brevo_expediteur_email, modele_recu_pdf')
        .eq('id', organisationId)
        .single(),
      adminClient.from('organisation_secrets').select('brevo_api_key').eq('organisation_id', organisationId).maybeSingle(),
    ])

    if (!org) {
      return jsonResponse({ error: 'Organisation introuvable' }, 404)
    }

    const { data: participant } = await adminClient
      .from('profils_participant')
      .select('id, organisation_id, personnes(nom, prenom, email)')
      .eq('id', profil_participant_id)
      .eq('organisation_id', organisationId)
      .single()

    if (!participant) {
      return jsonResponse({ error: 'Participant introuvable' }, 404)
    }

    const personne = (participant as unknown as { personnes: { nom: string; prenom: string | null; email: string | null } }).personnes
    if (!personne.email) {
      return jsonResponse({ error: 'Aucune adresse email pour ce participant' }, 422)
    }

    const { data: recu } = await adminClient
      .from('recus_fiscaux')
      .select('id, fichier_url, montant_total')
      .eq('profil_participant_id', profil_participant_id)
      .eq('organisation_id', organisationId)
      .eq('annee', anneeNum)
      .single()

    if (!recu || !recu.fichier_url) {
      return jsonResponse({ error: 'Aucun reçu généré pour ce participant et cette année' }, 404)
    }

    // Dernière version du reçu (docs/regles-recus-fiscaux.md §5) : c'est elle qui est envoyée et
    // marquée comme envoyée. Un reçu sans version enregistrée (antérieur aux versions) envoie son
    // fichier actuel.
    const { data: derniereVersion, error: versionError } = await adminClient
      .from('recus_fiscaux_versions')
      .select('id, fichier_url, montant_total')
      .eq('recu_id', recu.id)
      .order('version', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (versionError) {
      console.error('recus_fiscaux_versions read error:', versionError)
      return jsonResponse({ error: 'Erreur lors de la récupération du reçu' }, 500)
    }

    const fichierEnvoye = (derniereVersion?.fichier_url as string | undefined) ?? recu.fichier_url

    const { data: pdfFile, error: downloadError } = await adminClient.storage
      .from('recus-fiscaux')
      .download(fichierEnvoye)

    if (downloadError || !pdfFile) {
      console.error('Storage download error:', downloadError)
      return jsonResponse({ error: 'Erreur lors de la récupération du PDF' }, 500)
    }

    const pdfBytes = new Uint8Array(await pdfFile.arrayBuffer())
    const donateurNom = personne.prenom ? `${personne.prenom} ${personne.nom}` : personne.nom

    // Modèle personnalisé (Paramètres › Reçus fiscaux), sinon le texte par défaut ; valeurs échappées.
    const modele = (org.modele_recu_pdf ?? {}) as { email_objet?: string | null; email_html?: string | null }
    const montant = Number(derniereVersion?.montant_total ?? recu.montant_total)
    const valeurs = valeursEmailRecu({
      prenom: personne.prenom,
      nom: personne.nom,
      annee: anneeNum,
      organisation: org.nom,
      montant: Number.isFinite(montant) ? montant : null,
    })

    const emailResult = await envoyerEmailRecu(
      {
        destinataire: { email: personne.email.trim(), nom: donateurNom },
        objet: rendreObjetEmailRecu(modele.email_objet, valeurs),
        html: rendreEmailRecu(modele.email_html, valeurs),
        pieceJointe: { nom: `recu-fiscal-${anneeNum}.pdf`, contenuBase64: bytesToBase64(pdfBytes) },
        profilParticipantId: profil_participant_id,
      },
      {
        apiKey: (secret?.brevo_api_key as string | null | undefined) ?? null,
        expediteurNom: org.brevo_expediteur_nom,
        expediteurEmail: org.brevo_expediteur_email,
      },
      { fetchFn: fetch, envoyerResend: sendViaResend },
    )

    if (!emailResult.ok) {
      console.error('send-recu-email: envoi impossible', emailResult.detail)
      return jsonResponse({ error: "Erreur lors de l'envoi de l'email" }, 500)
    }
    // Trace du canal : journal de la fonction + recus_fiscaux.email_canal.
    console.log('send-recu-email: envoyé', emailResult.canal, emailResult.motifSecours ?? '')

    const envoyeLe = new Date().toISOString()

    if (derniereVersion) {
      const { error: versionUpdateError } = await adminClient
        .from('recus_fiscaux_versions')
        .update({ email_envoye_le: envoyeLe })
        .eq('id', derniereVersion.id)
      if (versionUpdateError) {
        console.error('Update email_envoye_le error:', versionUpdateError)
        // Non bloquant : l'email est parti
      }
    }

    const { error: updateError } = await adminClient
      .from('recus_fiscaux')
      .update({ email_envoye_at: envoyeLe, email_canal: emailResult.canal })
      .eq('profil_participant_id', profil_participant_id)
      .eq('organisation_id', organisationId)
      .eq('annee', anneeNum)

    if (updateError) {
      console.error('Update email_envoye_at error:', updateError)
      // Non-blocking: email was sent, return success anyway
    }

    return jsonResponse({ ok: true, canal: emailResult.canal })
  } catch (err) {
    console.error('send-recu-email error:', err)
    return jsonResponse({ error: 'Erreur inconnue' }, 500)
  }
})
