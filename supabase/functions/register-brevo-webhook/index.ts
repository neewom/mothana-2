import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// Appelée depuis BrevoConfigModal juste après l'enregistrement d'une clé API
// Brevo : enregistre automatiquement (idempotent) le webhook de bounce côté
// Brevo pour cette organisation, sur son propre compte (chaque organisation
// a sa propre clé, cf. organisations_brevo_integration.sql). Type
// "transactional" : send-mailing-brevo envoie via l'API transactionnelle
// Brevo (/v3/smtp/email), pas l'API Campagnes.

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
// 2026-09-10) : un domaine sans aucun enregistrement DNS/MX (ex. adresse de
// test @exemple.fr) est rejeté par Brevo avant toute tentative de livraison
// et classé "blocked", jamais "hardBounce" — sans cet événement, ce cas très
// courant en pratique (typo de domaine) ne remonte jamais.
const WEBHOOK_EVENTS = ['hardBounce', 'invalid', 'blocked']

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

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false },
    })
    const { data: { user }, error: userError } = await userClient.auth.getUser()
    if (userError || !user) return jsonResponse({ error: 'Non autorisé' }, 401)

    const adminClient = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } })

    const { data: profilOrg } = await adminClient
      .from('profils_organisation')
      .select('organisation_id')
      .eq('utilisateur_id', user.id)
      .eq('role', 'admin')
      .single()

    if (!profilOrg) return jsonResponse({ error: 'Accès refusé' }, 403)

    const { data: org } = await adminClient
      .from('organisations')
      .select('brevo_api_key')
      .eq('id', profilOrg.organisation_id)
      .single()

    if (!org?.brevo_api_key) {
      return jsonResponse({ skipped: true, reason: 'Pas de clé API Brevo configurée' })
    }

    const webhookUrl = `${supabaseUrl}/functions/v1/brevo-bounce-webhook?org=${profilOrg.organisation_id}`

    const listRes = await fetch('https://api.brevo.com/v3/webhooks?type=transactional', {
      headers: { 'api-key': org.brevo_api_key, Accept: 'application/json' },
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
      return jsonResponse({ error: 'Erreur lors de la vérification des webhooks Brevo', detail: listBody }, 502)
    }

    const existing = (listData.webhooks ?? []).find((w) => w.url === webhookUrl)

    if (existing) {
      // Idempotent aussi sur les événements souscrits : corrige un webhook
      // déjà créé avec une liste d'événements devenue obsolète (ex. "blocked"
      // ajouté après coup) sans demander à l'admin de le recréer à la main.
      const updateRes = await fetch(`https://api.brevo.com/v3/webhooks/${existing.id}`, {
        method: 'PUT',
        headers: {
          'api-key': org.brevo_api_key,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({ events: WEBHOOK_EVENTS }),
      })

      if (!updateRes.ok) {
        const detail = await updateRes.text()
        console.error('Brevo update webhook error:', updateRes.status, detail)
        return jsonResponse({ error: 'Erreur lors de la mise à jour du webhook Brevo', detail }, 502)
      }

      return jsonResponse({ ok: true, already_registered: true })
    }

    const createRes = await fetch('https://api.brevo.com/v3/webhooks', {
      method: 'POST',
      headers: {
        'api-key': org.brevo_api_key,
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
      return jsonResponse({ error: 'Erreur lors de la création du webhook Brevo', detail }, 502)
    }

    return jsonResponse({ ok: true, already_registered: false })
  } catch (err) {
    console.error('register-brevo-webhook error:', err)
    return jsonResponse({ error: 'Erreur serveur', detail: String(err) }, 500)
  }
})
