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
      .select('id, archived_at')
      .eq('code_pin_benevole', pin)
      .single()

    if (orgError || !org) {
      return new Response(
        JSON.stringify({ error: 'Code PIN invalide' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    if (org.archived_at) {
      return new Response(
        JSON.stringify({ error: 'Cette organisation a été archivée' }),
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

    let signInData = await anonClient.auth.signInWithPassword({
      email: benevoleEmail,
      password: pin,
    })

    if (signInData.error || !signInData.data.session) {
      console.error('signInWithPassword:', signInData.error?.message)
      return new Response(
        JSON.stringify({ error: 'Erreur de connexion bénévole' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    // The account may already have existed before app_metadata was introduced
    // (or with a stale organisation_id/role) — createUser above silently no-ops
    // on "already registered", so app_metadata never gets fixed up on its own.
    // Self-heal here: if it's wrong, correct it and re-sign-in so the returned
    // token actually carries the right claims (a JWT's claims are fixed at
    // issuance — updating the user record after the fact doesn't change a
    // token already handed out).
    const currentMetadata = signInData.data.user.app_metadata
    const metadataStale =
      currentMetadata?.role !== 'benevole' || currentMetadata?.organisation_id !== org.id

    if (metadataStale) {
      await adminClient.auth.admin.updateUserById(signInData.data.user.id, {
        app_metadata: appMetadata,
      })

      signInData = await anonClient.auth.signInWithPassword({
        email: benevoleEmail,
        password: pin,
      })

      if (signInData.error || !signInData.data.session) {
        console.error('signInWithPassword (post-fixup):', signInData.error?.message)
        return new Response(
          JSON.stringify({ error: 'Erreur de connexion bénévole' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        )
      }
    }

    return new Response(
      JSON.stringify({
        access_token: signInData.data.session.access_token,
        refresh_token: signInData.data.session.refresh_token,
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
