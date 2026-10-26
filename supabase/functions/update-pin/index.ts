import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { resolveOrganisationId } from '../_shared/resolveOrganisationId.ts'
import { pinAleatoire, secretAleatoire } from '../_shared/secretAleatoire.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

type PinRole = 'benevole' | 'vendeur'

const pinRoleConfig: Record<PinRole, { column: string; emailPrefix: string }> = {
  benevole: { column: 'code_pin_benevole', emailPrefix: 'benevole' },
  vendeur: { column: 'code_pin_vendeur_evenement', emailPrefix: 'vendeur' },
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const authHeader = req.headers.get('authorization')
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Non autorise' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!

    // Verify caller identity
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false },
    })

    const { data: { user }, error: userError } = await userClient.auth.getUser()
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'Non autorise' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false },
    })

    // Caller must be admin for an organisation, or super-admin with an explicit organisation_id
    const { organisation_id, role: requestedRole = 'benevole' } = await req.json().catch(() => ({}))
    if (requestedRole !== 'benevole' && requestedRole !== 'vendeur') {
      return new Response(
        JSON.stringify({ error: 'Role PIN invalide' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    const role: PinRole = requestedRole
    const roleConfig = pinRoleConfig[role]
    const resolved = await resolveOrganisationId(adminClient, user, organisation_id)

    if (!resolved) {
      return new Response(
        JSON.stringify({ error: 'Acces refuse' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    // Codes PIN réservés au rôle admin (et au super-admin en mode Consulter) — audit 2026-10-24.
    if (resolved.role === 'contributeur') {
      return new Response(
        JSON.stringify({ error: 'Acces refuse' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    const organisationId = resolved.organisationId

    // Generate a PIN that doesn't already exist in another org
    let newPin = pinAleatoire()
    let attempts = 0

    while (attempts < 10) {
      const { data: existing } = await adminClient
        .from('organisation_secrets')
        .select('organisation_id')
        .eq(roleConfig.column, newPin)
        .neq('organisation_id', organisationId)
        .maybeSingle()

      if (!existing) break
      newPin = pinAleatoire()
      attempts++
    }

    // Update organisation PIN (organisation_secrets : plus lisible par les membres)
    const { error: updateOrgErr } = await adminClient
      .from('organisation_secrets')
      .upsert({ organisation_id: organisationId, [roleConfig.column]: newPin, updated_at: new Date().toISOString() }, { onConflict: 'organisation_id' })

    if (updateOrgErr) {
      console.error('update org:', updateOrgErr)
      return new Response(
        JSON.stringify({ error: 'Erreur mise a jour organisation' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    // Rotation réelle (audit sécurité 2026-10-24) : le compte technique est retrouvé par son
    // email (plus de listUsers, paginé à 50), ses sessions sont révoquées et son mot de passe
    // redevient un aléa inconnu. Un access token déjà émis expire de lui-même (1 h).
    const accountEmail = `${roleConfig.emailPrefix}-${organisationId}@mothana.internal`
    const { data: compteId, error: revokeErr } = await adminClient.rpc('revoquer_sessions_compte_technique', {
      p_email: accountEmail,
    })
    if (revokeErr) {
      console.error('revoquer_sessions_compte_technique:', revokeErr.message)
      return new Response(
        JSON.stringify({ error: 'PIN changé, mais les sessions existantes n\'ont pas pu être coupées : réessayez.' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }
    if (compteId) {
      const { error: updateAuthErr } = await adminClient.auth.admin.updateUserById(compteId as string, {
        password: secretAleatoire(),
      })
      if (updateAuthErr) console.error('update technical account password:', updateAuthErr.message)
    }

    return new Response(
      JSON.stringify({ new_pin: newPin }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  } catch (err) {
    console.error('update-pin error:', err)
    return new Response(
      JSON.stringify({ error: 'Erreur serveur', detail: String(err) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  }
})
