import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// Reçoit les événements webhook Brevo (hardBounce / invalid_email) sur les
// campagnes mailing envoyées via send-mailing-brevo (API transactionnelle
// Brevo /v3/smtp/email). Volet 2 de la carte Trello "Détection d'emails
// adhérents invalides (bounce)". Enregistré automatiquement par
// register-brevo-webhook dès qu'un admin configure sa clé API Brevo.
//
// Pas de vérification de signature (Brevo ne signe pas ses webhooks) :
// sécurité par obscurité de l'URL (organisation_id en query, un UUID, même
// posture que mailing_unsubscribe_token ailleurs dans ce projet).

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// "invalid" et non "invalid_email" — nom d'événement confirmé côté API
// Brevo en testant register-brevo-webhook (channel webhook transactionnel).
// "blocked" ajouté après coup (constaté en conditions réelles, 2026-09-10) :
// un domaine sans DNS/MX (ex. adresse de test @exemple.fr) est rejeté par
// Brevo avant toute tentative de livraison et classé "blocked", jamais
// "hardBounce" — 0 événement ne remontait avant cet ajout.
const BOUNCE_EVENTS = ['hardBounce', 'invalid', 'blocked']

interface BrevoEvent {
  event?: string
  email?: string
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const organisationId = new URL(req.url).searchParams.get('org')
    if (!organisationId) {
      return new Response(JSON.stringify({ error: 'Paramètre org manquant' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const body = await req.json()
    const events: BrevoEvent[] = Array.isArray(body) ? body : [body]
    const emailsInvalides = [
      ...new Set(
        events
          .filter((e) => e.event && BOUNCE_EVENTS.includes(e.event) && e.email)
          .map((e) => e.email as string),
      ),
    ]

    if (emailsInvalides.length === 0) {
      return new Response(JSON.stringify({ skipped: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const adminClient = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } })

    const { error } = await adminClient
      .from('adherents')
      .update({ email_invalide_at: new Date().toISOString() })
      .eq('organisation_id', organisationId)
      .in('courriel', emailsInvalides)

    if (error) {
      console.error('adherents update error:', error)
      return new Response(JSON.stringify({ error: 'Erreur serveur' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    return new Response(JSON.stringify({ ok: true, emails: emailsInvalides.length }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    console.error('brevo-bounce-webhook error:', err)
    return new Response(JSON.stringify({ error: 'Erreur serveur', detail: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
