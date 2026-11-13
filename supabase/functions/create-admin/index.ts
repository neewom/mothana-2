import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { creerCompteEtInviter } from '../_shared/inviterAdmin.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Appelant : super-admin ou admin, d'après son jeton vérifié ci-dessous
    const authHeader = req.headers.get('Authorization') ?? ''
    const token = authHeader.replace('Bearer ', '')

    if (!token) {
      return new Response(
        JSON.stringify({ error: 'Authorization header manquant' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false },
    })

    // Audit sécurité 2026-10-24 : jeton vérifié par l'auth (l'ancien décodage base64 n'en
    // contrôlait pas la signature).
    const { data: { user: appelant }, error: appelantError } = await adminClient.auth.getUser(token)
    if (appelantError || !appelant) {
      return new Response(
        JSON.stringify({ error: 'Session invalide' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }
    const isSuperAdmin = appelant.app_metadata?.is_super_admin === true

    const { nom, email, organisation_id, site_url, role } = await req.json()

    if (role !== undefined && role !== 'admin' && role !== 'contributeur') {
      return new Response(
        JSON.stringify({ error: 'Rôle inconnu' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    if (!nom || !email || !site_url || (isSuperAdmin && !organisation_id)) {
      return new Response(
        JSON.stringify({ error: 'Paramètres manquants : nom, email, site_url requis (organisation_id également pour un super-admin)' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    // Super-admin : crée un admin ou un contributeur (paramètre role, admin
    // par défaut) dans l'organisation de son choix.
    // Admin : crée un contributeur, forcément dans sa propre organisation
    // (organisation_id du body ignoré, jamais fait confiance au client ici) ;
    // toute demande d'un autre rôle est refusée.
    let targetOrganisationId: string
    let targetRole: 'admin' | 'contributeur'

    if (isSuperAdmin) {
      targetOrganisationId = organisation_id
      targetRole = role ?? 'admin'
    } else {
      if (role !== undefined && role !== 'contributeur') {
        return new Response(
          JSON.stringify({ error: 'Accès refusé — seul un super-admin peut créer un administrateur' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        )
      }

      const { data: callerProfil } = await adminClient
        .from('profils_organisation')
        .select('organisation_id, role')
        .eq('utilisateur_id', appelant.id)
        .eq('role', 'admin')
        .single()

      if (!callerProfil) {
        return new Response(
          JSON.stringify({ error: 'Accès refusé — réservé aux super-admins et aux admins' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        )
      }

      targetOrganisationId = callerProfil.organisation_id
      targetRole = 'contributeur'
    }

    // Compte, profil et invitation habituelle : logique partagée avec valider-demande-inscription.
    const resultat = await creerCompteEtInviter(adminClient, {
      nom,
      email,
      organisationId: targetOrganisationId,
      role: targetRole,
      siteUrl: site_url,
      modele: { type: 'standard' },
    })
    if (!resultat.ok) {
      return new Response(
        JSON.stringify({ error: resultat.error }),
        { status: resultat.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }
    const { profil, emailEnvoye } = resultat

    return new Response(
      JSON.stringify({
        id: profil.id,
        utilisateur_id: profil.utilisateur_id,
        nom_affiche: profil.nom_affiche,
        email,
        organisation_id: profil.organisation_id,
        role: profil.role,
        email_envoye: emailEnvoye,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  } catch (err) {
    console.error('create-admin error:', err)
    return new Response(
      JSON.stringify({ error: 'Erreur serveur', detail: String(err) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  }
})
