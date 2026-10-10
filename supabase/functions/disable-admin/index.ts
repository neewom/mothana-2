import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Verify caller is super-admin by decoding the JWT payload
    const authHeader = req.headers.get('Authorization') ?? ''
    const token = authHeader.replace('Bearer ', '')

    if (!token) {
      return new Response(
        JSON.stringify({ error: 'Authorization header manquant' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    // Decode JWT payload (base64url) without verifying the signature
    const payload = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')))
    const isSuperAdmin = payload?.app_metadata?.is_super_admin === true

    const { utilisateur_id, ban } = await req.json()

    if (!utilisateur_id || typeof ban !== 'boolean') {
      return new Response(
        JSON.stringify({ error: 'Paramètres manquants : utilisateur_id et ban (boolean) requis' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false },
    })

    if (!isSuperAdmin) {
      // Un admin ne peut désactiver/réactiver qu'un contributeur de sa
      // propre organisation — jamais un autre admin, jamais lui-même.
      const { data: callerProfil } = await adminClient
        .from('profils_organisation')
        .select('organisation_id')
        .eq('utilisateur_id', payload.sub)
        .eq('role', 'admin')
        .single()

      if (!callerProfil) {
        return new Response(
          JSON.stringify({ error: 'Accès refusé — réservé aux super-admins et aux admins' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        )
      }

      const { data: targetProfil } = await adminClient
        .from('profils_organisation')
        .select('organisation_id, role')
        .eq('utilisateur_id', utilisateur_id)
        .single()

      if (!targetProfil || targetProfil.role !== 'contributeur' || targetProfil.organisation_id !== callerProfil.organisation_id) {
        return new Response(
          JSON.stringify({ error: 'Accès refusé' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        )
      }
    }

    // Une organisation garde toujours au moins un administrateur actif
    // (même règle que changer_role_compte côté base).
    if (ban) {
      const { data: dernierAdmin, error: guardError } = await adminClient
        .rpc('est_dernier_admin_actif', { p_utilisateur_id: utilisateur_id })

      if (guardError) {
        console.error('est_dernier_admin_actif error:', guardError.message)
        return new Response(
          JSON.stringify({ error: 'Erreur lors de la vérification des administrateurs' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        )
      }

      if (dernierAdmin === true) {
        return new Response(
          JSON.stringify({ error: "Impossible : c'est le dernier administrateur actif de l'organisation. Nommez d'abord un autre administrateur." }),
          { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        )
      }
    }

    // Ban: set a very long ban duration. Unban: set duration to 'none'.
    const ban_duration = ban ? '876000h' : 'none'

    const { error: updateError } = await adminClient.auth.admin.updateUserById(
      utilisateur_id,
      { ban_duration },
    )

    if (updateError) {
      console.error('updateUserById error:', updateError.message)
      return new Response(
        JSON.stringify({ error: updateError.message }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    return new Response(
      JSON.stringify({ success: true }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  } catch (err) {
    console.error('disable-admin error:', err)
    return new Response(
      JSON.stringify({ error: 'Erreur serveur', detail: String(err) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  }
})
