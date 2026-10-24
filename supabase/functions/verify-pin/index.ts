import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { hashClientIp } from '../_shared/rateLimit.ts'
import { secretAleatoire } from '../_shared/secretAleatoire.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface VerifyPinRateLimitResult {
  ok: boolean
  reason?: 'ACCES_INVALIDE' | 'RATE_LIMIT'
}

type PinRole = 'benevole' | 'vendeur'

const pinRoleConfig: Record<PinRole, { column: string; emailPrefix: string }> = {
  benevole: { column: 'code_pin_benevole', emailPrefix: 'benevole' },
  vendeur: { column: 'code_pin_vendeur_evenement', emailPrefix: 'vendeur' },
}

function jsonResponse(
  body: unknown,
  status = 200,
  extraHeaders: Record<string, string> = {},
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
      ...extraHeaders,
    },
  })
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { pin, role: requestedRole = 'benevole' } = await req.json()
    if (!pin) {
      return new Response(
        JSON.stringify({ error: 'PIN manquant' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    if (requestedRole !== 'benevole' && requestedRole !== 'vendeur') {
      return jsonResponse({ error: 'Rôle PIN invalide' }, 400)
    }

    const role: PinRole = requestedRole
    const roleConfig = pinRoleConfig[role]

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!

    // Admin client — used to query organisations and manage Auth users
    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false },
    })

    let ipHash: string
    try {
      ipHash = await hashClientIp(req)
    } catch {
      console.error('Verify PIN rate limiter is not configured')
      return jsonResponse({ error: 'Service temporairement indisponible' }, 503)
    }

    const { data: rateLimitData, error: rateLimitError } = await adminClient.rpc(
      'verifier_limite_verify_pin',
      { p_ip_hash: ipHash },
    )

    if (rateLimitError) {
      console.error('Verify PIN rate limit failed:', rateLimitError.code)
      return jsonResponse({ error: 'Service temporairement indisponible' }, 503)
    }

    const rateLimit = rateLimitData as VerifyPinRateLimitResult | null
    if (!rateLimit?.ok) {
      if (rateLimit?.reason === 'RATE_LIMIT') {
        return jsonResponse(
          {
            error: 'Trop de tentatives. Réessayez dans 15 minutes.',
            code: 'TROP_DE_REQUETES',
          },
          429,
          { 'Retry-After': '900' },
        )
      }

      console.error('Verify PIN rate limit returned an invalid result')
      return jsonResponse({ error: 'Service temporairement indisponible' }, 503)
    }

    // 1. Verify PIN → resolve organisation
    const { data: org, error: orgError } = await adminClient
      .from('organisations')
      .select('id, archived_at')
      .eq(roleConfig.column, pin)
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

    const accountEmail = `${roleConfig.emailPrefix}-${org.id}@mothana.internal`
    const appMetadata = { role, organisation_id: org.id }

    // 2. Compte technique du rôle (idempotent). Son mot de passe est un aléa jamais conservé :
    // deviner le PIN sur l'auth Supabase ne donne rien (audit sécurité 2026-10-24).
    const { error: createError } = await adminClient.auth.admin.createUser({
      email: accountEmail,
      password: secretAleatoire(),
      email_confirm: true,
      app_metadata: appMetadata,
    })

    if (createError && !createError.message.toLowerCase().includes('already')) {
      // Unexpected error during creation — log but continue (account may exist)
      console.error('createUser:', createError.message)
    }

    // 3. Session par lien magique admin (aucun email envoyé), jamais par mot de passe.
    const anonClient = createClient(supabaseUrl, anonKey, {
      auth: { persistSession: false },
    })

    async function ouvrirSession() {
      const { data: lien, error: lienError } = await adminClient.auth.admin.generateLink({
        type: 'magiclink',
        email: accountEmail,
      })
      if (lienError || !lien.properties?.hashed_token) {
        console.error('generateLink:', lienError?.message)
        return null
      }
      const { data, error } = await anonClient.auth.verifyOtp({
        token_hash: lien.properties.hashed_token,
        type: 'magiclink',
      })
      if (error || !data.session || !data.user) {
        console.error('verifyOtp:', error?.message)
        return null
      }
      return { session: data.session, user: data.user }
    }

    let connexion = await ouvrirSession()
    if (!connexion) {
      return new Response(
        JSON.stringify({ error: 'Erreur de connexion' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    // The account may already have existed before app_metadata was introduced
    // (or with a stale organisation_id/role) — createUser above silently no-ops
    // on "already registered", so app_metadata never gets fixed up on its own.
    // Self-heal here: if it's wrong, correct it and open a new session so the
    // returned token actually carries the right claims (a JWT's claims are fixed
    // at issuance — updating the user record after the fact doesn't change a
    // token already handed out).
    const currentMetadata = connexion.user.app_metadata
    const metadataStale =
      currentMetadata?.role !== role || currentMetadata?.organisation_id !== org.id

    if (metadataStale) {
      await adminClient.auth.admin.updateUserById(connexion.user.id, {
        app_metadata: appMetadata,
      })

      connexion = await ouvrirSession()
      if (!connexion) {
        return new Response(
          JSON.stringify({ error: 'Erreur de connexion' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        )
      }
    }

    return new Response(
      JSON.stringify({
        access_token: connexion.session.access_token,
        refresh_token: connexion.session.refresh_token,
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
