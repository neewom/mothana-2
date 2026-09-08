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

    const payload = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')))
    const isSuperAdmin = payload?.app_metadata?.is_super_admin === true

    if (!isSuperAdmin) {
      return new Response(
        JSON.stringify({ error: 'Accès refusé — réservé aux super-admins' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    const { organisation_id } = await req.json()

    if (!organisation_id) {
      return new Response(
        JSON.stringify({ error: 'Paramètre manquant : organisation_id requis' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false },
    })

    // Comptes admin liés à cette organisation — profils_organisation sera de
    // toute façon cascadé par la suppression de l'organisation, mais ça ne
    // supprime pas les comptes auth.users eux-mêmes (cascade FK uniquement
    // dans l'autre sens : users -> profils_organisation). On les récupère
    // avant, pour les supprimer explicitement via l'API admin Auth.
    const { data: profils, error: profilsError } = await adminClient
      .from('profils_organisation')
      .select('utilisateur_id')
      .eq('organisation_id', organisation_id)

    if (profilsError) {
      return new Response(
        JSON.stringify({ error: profilsError.message }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    const userIds = (profils ?? []).map((p: { utilisateur_id: string }) => p.utilisateur_id)
    const errors: string[] = []

    for (const userId of userIds) {
      const { error: deleteError } = await adminClient.auth.admin.deleteUser(userId)
      if (deleteError) errors.push(`${userId}: ${deleteError.message}`)
    }

    if (errors.length > 0) {
      console.error('delete-org-admins errors:', errors.join('; '))
      return new Response(
        JSON.stringify({ error: `Certains comptes admin n'ont pas pu être supprimés : ${errors.join('; ')}`, deleted: userIds.length - errors.length }),
        { status: 207, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    return new Response(
      JSON.stringify({ success: true, deleted: userIds.length }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  } catch (err) {
    console.error('delete-org-admins error:', err)
    return new Response(
      JSON.stringify({ error: 'Erreur serveur', detail: String(err) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  }
})
