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
    const { pin } = await req.json()
    if (!pin) {
      return new Response(
        JSON.stringify({ error: 'PIN manquant' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!

    // Admin client — used to query organisations and manage Auth users
    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false },
    })

    // 1. Verify PIN → resolve organisation
    const { data: org, error: orgError } = await adminClient
      .from('organisations')
      .select('id')
      .eq('code_pin_benevole', pin)
      .single()

    if (orgError || !org) {
      return new Response(
        JSON.stringify({ error: 'Code PIN invalide' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    const benevoleEmail = `benevole-${org.id}@mothana.internal`
    const appMetadata = { role: 'benevole', organisation_id: org.id }

    // 2. Ensure the dedicated bénévole Auth account exists (idempotent)
    const { error: createError } = await adminClient.auth.admin.createUser({
      email: benevoleEmail,
      password: pin,
      email_confirm: true,
      app_metadata: appMetadata,
    })

    if (createError && !createError.message.toLowerCase().includes('already')) {
      // Unexpected error during creation — log but continue (account may exist)
      console.error('createUser:', createError.message)
    }

    // 3. Sign in as the bénévole account using the PIN as password
    // Use a plain client (anon key) for signInWithPassword
    const anonClient = createClient(supabaseUrl, anonKey, {
      auth: { persistSession: false },
    })

    const { data: signInData, error: signInError } = await anonClient.auth.signInWithPassword({
      email: benevoleEmail,
      password: pin,
    })

    if (signInError || !signInData.session) {
      console.error('signInWithPassword:', signInError?.message)
      return new Response(
        JSON.stringify({ error: 'Erreur de connexion bénévole' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    return new Response(
      JSON.stringify({
        access_token: signInData.session.access_token,
        refresh_token: signInData.session.refresh_token,
        organisation_id: org.id,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  } catch (err) {
    console.error('verify-pin error:', err)
    return new Response(
      JSON.stringify({ error: 'Erreur serveur', detail: String(err) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  }
})
