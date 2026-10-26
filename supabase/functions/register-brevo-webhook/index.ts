import { createClient, type SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { resolveOrganisationId } from '../_shared/resolveOrganisationId.ts'
import { genererSecretWebhook, secretsEgaux } from '../_shared/webhookSecret.ts'

// Appelée depuis BrevoConfigModal juste après l'enregistrement d'une clé API
// Brevo : enregistre automatiquement (idempotent) le webhook de bounce côté
// Brevo pour cette organisation, sur son propre compte (chaque organisation
// a sa propre clé, cf. organisations_brevo_integration.sql). Type
// "transactional" : send-mailing-brevo envoie via l'API transactionnelle
// Brevo (/v3/smtp/email), pas l'API Campagnes.
//
// Audit sécurité 2026-10-24 : l'URL du webhook porte un secret propre à l'organisation
// (organisation_secrets.brevo_webhook_secret, créé ici au premier enregistrement), vérifié par
// brevo-bounce-webhook. Un webhook déjà enregistré sans secret est mis à jour (même id Brevo).
// Appelée avec la clé service_role et { toutes_organisations: true }, la fonction
// réenregistre toutes les organisations ayant une clé Brevo (migration des webhooks existants).

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

interface BrevoWebhook {
  id: number
  url: string
}

// "invalid_email" (cadrage initial) rejeté par l'API Brevo pour un webhook
// transactionnel ("invalid event of transactional webhook email channel",
// constaté en testant) — le nom correct pour ce channel est "invalid".
// "blocked" ajouté après coup (constaté en testant en conditions réelles,
// 2026-09-10) sur l'hypothèse d'un domaine sans DNS/MX rejeté avant toute
// tentative — hypothèse invalidée par un test réel ensuite : le journal
// Transactionnel de Brevo montre l'événement réel "Erreur" (event "error")
// pour ce cas précis, pas "blocked". Les 3 restent souscrits par prudence
// (aucun des trois ne fait de mal à être activé), "error" ajouté comme le
// vrai signal confirmé pour ce cas.
// Correction 2026-10-23 : les `error` observés étaient des refus d'expéditeur non validé, pas
// des domaines sans MX (qui arrivent en softBounce, non souscrit) ; brevo-bounce-webhook trie
// désormais blocked / error selon la raison (_shared/brevoRejets.ts).
const WEBHOOK_EVENTS = ['hardBounce', 'invalid', 'blocked', 'error']

type Resultat =
  | { ok: true; already_registered: boolean }
  | { skipped: true; reason: string }
  | { error: string; detail?: string; status: number }

async function enregistrerWebhook(
  adminClient: SupabaseClient,
  supabaseUrl: string,
  organisationId: string,
): Promise<Resultat> {
  // Clé API et secret du webhook dans organisation_secrets (plus lisibles par les membres).
  const { data: secrets } = await adminClient
    .from('organisation_secrets')
    .select('brevo_api_key, brevo_webhook_secret')
    .eq('organisation_id', organisationId)
    .maybeSingle()

  const apiKey = secrets?.brevo_api_key as string | null | undefined
  if (!apiKey) {
    return { skipped: true, reason: 'Pas de clé API Brevo configurée' }
  }

  let secret = secrets?.brevo_webhook_secret as string | null | undefined
  if (!secret) {
    secret = genererSecretWebhook()
    const { error: secretError } = await adminClient
      .from('organisation_secrets')
      .update({ brevo_webhook_secret: secret })
      .eq('organisation_id', organisationId)
    if (secretError) {
      console.error('register-brevo-webhook secret error:', secretError.code)
      return { error: 'Erreur lors de la création du secret du webhook', status: 500 }
    }
  }

  const baseUrl = `${supabaseUrl}/functions/v1/brevo-bounce-webhook`
  const webhookUrl = `${baseUrl}?org=${organisationId}&secret=${secret}`

  const listRes = await fetch('https://api.brevo.com/v3/webhooks?type=transactional', {
    headers: { 'api-key': apiKey, Accept: 'application/json' },
  })

  const listBody = await listRes.text()
  let listData: { webhooks?: BrevoWebhook[]; code?: string } = {}
  try {
    listData = JSON.parse(listBody)
  } catch {
    // ignore, traité comme réponse vide ci-dessous
  }

  // Constaté en testant (compte sans aucun webhook) : Brevo répond avec
  // code "document_not_found" plutôt qu'une liste vide — traité comme
  // "aucun webhook existant", pas comme une erreur.
  if (!listRes.ok && listData.code !== 'document_not_found') {
    console.error('Brevo list webhooks error:', listRes.status, listBody)
    return { error: 'Erreur lors de la vérification des webhooks Brevo', detail: listBody, status: 502 }
  }

  // Webhook de cette organisation, avec ou sans secret (anciens enregistrements).
  const existing = (listData.webhooks ?? []).find((w) => {
    if (!w.url.startsWith(`${baseUrl}?`)) return false
    try {
      return new URL(w.url).searchParams.get('org') === organisationId
    } catch {
      return false
    }
  })

  if (existing) {
    // Idempotent sur l'URL (ajout du secret) et sur les événements souscrits : corrige un
    // webhook déjà créé sans demander à l'admin de le recréer à la main.
    const updateRes = await fetch(`https://api.brevo.com/v3/webhooks/${existing.id}`, {
      method: 'PUT',
      headers: {
        'api-key': apiKey,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({ url: webhookUrl, events: WEBHOOK_EVENTS }),
    })

    if (!updateRes.ok) {
      const detail = await updateRes.text()
      console.error('Brevo update webhook error:', updateRes.status, detail)
      return { error: 'Erreur lors de la mise à jour du webhook Brevo', detail, status: 502 }
    }

    return { ok: true, already_registered: true }
  }

  const createRes = await fetch('https://api.brevo.com/v3/webhooks', {
    method: 'POST',
    headers: {
      'api-key': apiKey,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({
      url: webhookUrl,
      description: 'Mothana - détection adresses invalides',
      events: WEBHOOK_EVENTS,
      type: 'transactional',
    }),
  })

  if (!createRes.ok) {
    const detail = await createRes.text()
    console.error('Brevo create webhook error:', createRes.status, detail)
    return { error: 'Erreur lors de la création du webhook Brevo', detail, status: 502 }
  }

  return { ok: true, already_registered: false }
}

function reponse(resultat: Resultat): Response {
  if ('error' in resultat) {
    const { status, ...corps } = resultat
    return jsonResponse(corps, status)
  }
  return jsonResponse(resultat)
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const authHeader = req.headers.get('authorization')
    if (!authHeader) return jsonResponse({ error: 'Non autorisé' }, 401)

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!
    const adminClient = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } })

    const corps = await req.json().catch(() => ({}))

    // Migration des webhooks existants : réservée à la clé service_role.
    if (corps?.toutes_organisations === true) {
      if (!secretsEgaux(authHeader.replace(/^Bearer\s+/i, ''), serviceRoleKey)) {
        return jsonResponse({ error: 'Accès refusé' }, 403)
      }
      const { data: organisations, error: listeError } = await adminClient
        .from('organisation_secrets')
        .select('organisation_id')
        .not('brevo_api_key', 'is', null)
      if (listeError) return jsonResponse({ error: 'Erreur serveur' }, 500)

      const resultats: Record<string, unknown> = {}
      for (const { organisation_id } of organisations ?? []) {
        const resultat = await enregistrerWebhook(adminClient, supabaseUrl, organisation_id)
        resultats[organisation_id] = 'error' in resultat ? { error: resultat.error, status: resultat.status } : resultat
      }
      return jsonResponse({ ok: true, resultats })
    }

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false },
    })
    const { data: { user }, error: userError } = await userClient.auth.getUser()
    if (userError || !user) return jsonResponse({ error: 'Non autorisé' }, 401)

    const resolved = await resolveOrganisationId(adminClient, user, corps?.organisation_id)
    if (!resolved) return jsonResponse({ error: 'Accès refusé' }, 403)

    return reponse(await enregistrerWebhook(adminClient, supabaseUrl, resolved.organisationId))
  } catch (err) {
    console.error('register-brevo-webhook error:', err)
    return jsonResponse({ error: 'Erreur serveur', detail: String(err) }, 500)
  }
})
