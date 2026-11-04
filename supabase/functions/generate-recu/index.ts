import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { genererRecu } from '../_shared/genererRecu.ts'
import { resolveOrganisationId } from '../_shared/resolveOrganisationId.ts'

// Génère (ou régénère) un reçu fiscal à la demande d'un admin. Le cœur de la génération est partagé
// avec traiter-lots-recus : _shared/genererRecu.ts.

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

// ---------------------------------------------------------------------------
// Main handler
// ---------------------------------------------------------------------------

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
    const gotenbergUrl = Deno.env.get('GOTENBERG_URL')!

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

    const resultat = await genererRecu(adminClient, {
      organisationId,
      profilParticipantId: profil_participant_id,
      annee: anneeNum,
      generePar: user.id,
      gotenbergUrl,
    })
    return jsonResponse(resultat.body, resultat.status)
  } catch (err) {
    console.error('generate-recu error:', err)
    return jsonResponse({ error: 'Erreur serveur', detail: String(err) }, 500)
  }
})
