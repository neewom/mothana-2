import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { resolveOrganisationId } from '../_shared/resolveOrganisationId.ts'
import { envoyerRecuDonateur } from '../_shared/envoyerRecu.ts'
import { sendViaResend } from '../_shared/resend.ts'

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

    // Cœur partagé avec les lots d'envoi (traiter-lots-recus) : _shared/envoyerRecu.ts.
    const resultat = await envoyerRecuDonateur(
      adminClient,
      { organisationId: resolved.organisationId, profilParticipantId: profil_participant_id, annee: anneeNum },
      { fetchFn: fetch, envoyerResend: sendViaResend },
    )

    if (!resultat.ok) {
      // Envoi Brevo incertain : message explicite, et aucun marquage (email_envoye_at / _le).
      if (resultat.incertain) return jsonResponse({ error: resultat.error, incertain: true }, 502)
      return jsonResponse({ error: resultat.error }, resultat.status)
    }

    return jsonResponse({ ok: true, canal: resultat.canal })
  } catch (err) {
    console.error('send-recu-email error:', err)
    return jsonResponse({ error: 'Erreur inconnue' }, 500)
  }
})
