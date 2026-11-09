// verifier-expediteur-brevo (carte B4) : état réel de validation, dans Brevo, de l'expéditeur
// configuré pour une organisation (Paramètres › Intégrations). Lecture seule : aucune écriture.
// La clé API Brevo (organisation_secrets, lisible seulement en service_role) reste côté serveur :
// elle n'apparaît ni dans la réponse ni dans les logs.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { statutExpediteurBrevo } from '../_shared/brevo.ts'
import { autoriserAppelant, configBrevoComplete, estSuperAdmin, organisationDemandeeValide, statutAffiche } from './decision.ts'

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
    if (!authHeader) return jsonResponse({ error: 'Non autorisé' }, 401)

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false },
    })
    const { data: { user }, error: userError } = await userClient.auth.getUser()
    if (userError || !user) return jsonResponse({ error: 'Non autorisé' }, 401)

    const body = await req.json().catch(() => ({})) as { organisation_id?: unknown }
    const organisationDemandee = body.organisation_id

    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false },
    })

    // Rôle de l'appelant dans l'organisation demandée (pas dans « son » organisation) : un admin
    // de A qui demande B n'a aucune ligne pour B → refus.
    let roleDansOrganisation: string | null = null
    if (organisationDemandeeValide(organisationDemandee) && !estSuperAdmin(user)) {
      const { data: profil } = await adminClient
        .from('profils_organisation')
        .select('role')
        .eq('utilisateur_id', user.id)
        .eq('organisation_id', organisationDemandee)
        .maybeSingle()
      roleDansOrganisation = (profil as { role?: string } | null)?.role ?? null
    }

    const decision = autoriserAppelant(user, userError, organisationDemandee, roleDansOrganisation)
    if (!decision.autorise) return jsonResponse({ error: decision.error }, decision.status)
    const organisationId = decision.organisationId

    const [{ data: org, error: orgError }, { data: secret, error: secretError }] = await Promise.all([
      adminClient.from('organisations').select('brevo_expediteur_email').eq('id', organisationId).maybeSingle(),
      adminClient.from('organisation_secrets').select('brevo_api_key').eq('organisation_id', organisationId).maybeSingle(),
    ])
    if (orgError || secretError) {
      console.error('verifier-expediteur-brevo: lecture de la configuration impossible')
      return jsonResponse({ error: 'Erreur interne' }, 500)
    }
    if (!org) return jsonResponse({ error: 'Organisation introuvable' }, 404)

    const expediteurEmail = (org as { brevo_expediteur_email: string | null }).brevo_expediteur_email
    const apiKey = (secret as { brevo_api_key: string | null } | null)?.brevo_api_key ?? null
    if (!configBrevoComplete(apiKey, expediteurEmail)) {
      return jsonResponse({ statut: 'non_configure', expediteur_email: expediteurEmail ?? null })
    }

    const statut = await statutExpediteurBrevo(apiKey!, expediteurEmail!, 'verifier-expediteur-brevo')
    return jsonResponse({ statut: statutAffiche(statut), expediteur_email: expediteurEmail })
  } catch (err) {
    console.error('verifier-expediteur-brevo: erreur inattendue', err instanceof Error ? err.message : String(err))
    return jsonResponse({ error: 'Erreur interne' }, 500)
  }
})
