import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { classerRejet } from '../_shared/brevoRejets.ts'
import { secretsEgaux } from '../_shared/webhookSecret.ts'

// Reçoit les événements webhook Brevo (hard_bounce, invalid_email, blocked, error) sur les
// campagnes mailing envoyées via send-mailing-brevo (API transactionnelle
// Brevo /v3/smtp/email). Volet 2 de la carte Trello "Détection d'emails
// adhérents invalides (bounce)". Enregistré automatiquement par
// register-brevo-webhook dès qu'un admin configure sa clé API Brevo.
//
// Brevo ne signe pas ses webhooks : l'URL enregistrée par register-brevo-webhook porte un
// secret aléatoire propre à l'organisation (?org=<uuid>&secret=<hex>, dans
// organisation_secrets), vérifié ici avant tout traitement (audit sécurité 2026-10-24 :
// l'UUID seul, public, permettait à n'importe qui de marquer des adresses invalides).

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Tri des événements par `classerRejet` (_shared/brevoRejets.ts) : hard bounce et adresse
// invalide marquent toujours ; blocked / error seulement si la raison ne met pas en cause
// l'expéditeur, le domaine d'envoi ou le compte Brevo. Correction du 2026-10-23 : les `error`
// du 2026-09-10 (@exemple.fr), pris pour des domaines sans MX, étaient en fait des refus
// d'expéditeur non validé ; le vrai « MX introuvable » arrive en softBounce (non souscrit).
// Noms d'événement : le payload utilise hard_bounce / invalid_email (constaté en prod : aucun
// hardBounce n'avait jamais été marqué) ; les deux formes sont acceptées.

interface BrevoEvent {
  event?: string
  email?: string
  reason?: string
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

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const adminClient = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } })

    const secretRecu = new URL(req.url).searchParams.get('secret')
    const { data: secrets } = await adminClient
      .from('organisation_secrets')
      .select('brevo_webhook_secret')
      .eq('organisation_id', organisationId)
      .maybeSingle()
    if (!secretsEgaux(secretRecu, secrets?.brevo_webhook_secret ?? null)) {
      console.warn('brevo-bounce-webhook: secret absent ou invalide pour', organisationId)
      return new Response(JSON.stringify({ error: 'Non autorisé' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const body = await req.json()
    const events: BrevoEvent[] = Array.isArray(body) ? body : [body]

    // Une décision par adresse (la dernière reçue l'emporte).
    const aMarquer = new Map<string, { evenement: string; raison: string | null }>()
    for (const e of events) {
      if (!e.email) continue
      const decision = classerRejet(e.event, e.reason)
      if (decision.marquer) {
        aMarquer.set(e.email, { evenement: decision.evenement, raison: decision.raison })
      } else if (decision.motif === 'cote_expediteur') {
        // Jamais imputé au destinataire : à corriger côté expéditeur / compte Brevo.
        console.warn('brevo-bounce-webhook: rejet côté expéditeur ignoré', e.event, e.reason)
      }
    }

    if (aMarquer.size === 0) {
      return new Response(JSON.stringify({ skipped: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const maintenant = new Date().toISOString()
    for (const [email, { evenement, raison }] of aMarquer) {
      const { error } = await adminClient
        .from('adherents')
        .update({ email_invalide_at: maintenant, email_invalide_evenement: evenement, email_invalide_raison: raison })
        .eq('organisation_id', organisationId)
        .eq('courriel', email)

      if (error) {
        console.error('adherents update error:', error)
        return new Response(JSON.stringify({ error: 'Erreur serveur' }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }
    }

    return new Response(JSON.stringify({ ok: true, emails: aMarquer.size }), {
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
