import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { resolveOrganisationId } from '../_shared/resolveOrganisationId.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function generatePin(): string {
  return String(Math.floor(100000 + Math.random() * 900000))
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

    const organisationId = resolved.organisationId

    // Generate a PIN that doesn't already exist in another org
    let newPin = generatePin()
    let attempts = 0

    while (attempts < 10) {
      const { data: existing } = await adminClient
        .from('organisations')
        .select('id')
        .eq(roleConfig.column, newPin)
        .neq('id', organisationId)
        .single()

      if (!existing) break
      newPin = generatePin()
      attempts++
    }

    // Update organisation PIN
    const { error: updateOrgErr } = await adminClient
      .from('organisations')
      .update({ [roleConfig.column]: newPin })
      .eq('id', organisationId)

    if (updateOrgErr) {
      console.error('update org:', updateOrgErr)
      return new Response(
        JSON.stringify({ error: 'Erreur mise a jour organisation' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    // Update the dedicated Auth account password when it already exists.
    const accountEmail = `${roleConfig.emailPrefix}-${organisationId}@mothana.internal`

    // Find the user by email
    const { data: { users }, error: listErr } = await adminClient.auth.admin.listUsers()

    if (!listErr) {
      const pinUser = users.find((u) => u.email === accountEmail)
      if (pinUser) {
        const { error: updateAuthErr } = await adminClient.auth.admin.updateUserById(
          pinUser.id,
          { password: newPin },
        )
        if (updateAuthErr) {
          console.error('update PIN auth password:', updateAuthErr)
          // Non-blocking: PIN in DB is updated, log and continue
        }
      }
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
