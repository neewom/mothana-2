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

    if (!isSuperAdmin) {
      return new Response(
        JSON.stringify({ error: 'Accès refusé — réservé aux super-admins' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    const { nom, email, password, organisation_id } = await req.json()

    if (!nom || !email || !password || !organisation_id) {
      return new Response(
        JSON.stringify({ error: 'Paramètres manquants : nom, email, password, organisation_id requis' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false },
    })

    // Create the Auth account for the new admin
    const { data: newUser, error: createError } = await adminClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    })

    if (createError || !newUser?.user) {
      console.error('createUser error:', createError?.message)
      return new Response(
        JSON.stringify({ error: createError?.message ?? 'Erreur lors de la création du compte' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    const utilisateur_id = newUser.user.id

    // Insert the admin profile linked to the organisation
    const { data: profil, error: profilError } = await adminClient
      .from('profils_organisation')
      .insert({
        utilisateur_id,
        organisation_id,
        nom_affiche: nom,
        role: 'admin',
      })
      .select('id, utilisateur_id, nom_affiche, organisation_id')
      .single()

    if (profilError || !profil) {
      console.error('profils_organisation insert error:', profilError?.message)
      // Roll back the Auth account to keep data consistent
      await adminClient.auth.admin.deleteUser(utilisateur_id)
      return new Response(
        JSON.stringify({ error: profilError?.message ?? 'Erreur lors de la création du profil' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    return new Response(
      JSON.stringify({
        id: profil.id,
        utilisateur_id: profil.utilisateur_id,
        nom_affiche: profil.nom_affiche,
        email,
        organisation_id: profil.organisation_id,
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
