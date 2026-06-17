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
