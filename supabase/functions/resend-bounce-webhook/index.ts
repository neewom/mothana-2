import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// Reçoit les événements webhook Resend (signés via Svix) pour détecter les
// bounces sur l'email de confirmation de réception d'une demande d'adhésion
// (send-demande-confirmation). Volet 1 de la carte Trello "Détection
// d'emails adhérents invalides (bounce)". Le volet 2 (bounces sur les
// campagnes mailing Brevo) est géré par brevo-bounce-webhook, indépendant.
//
// ⚠️ Suppose qu'un webhook Resend (événement email.bounced) a été créé côté
// dashboard Resend, pointant vers cette fonction, et que le secret de
// signature généré à cette occasion est enregistré comme secret Supabase
// RESEND_WEBHOOK_SECRET (`supabase secrets set RESEND_WEBHOOK_SECRET=whsec_...`)
// — pas d'API Resend pour créer ce webhook automatiquement, étape manuelle
// à faire une fois (carte Trello "Action admin" dédiée).

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, svix-id, svix-timestamp, svix-signature',
}

async function verifySvixSignature(
  body: string,
  svixId: string,
  svixTimestamp: string,
  svixSignature: string,
  secret: string,
): Promise<boolean> {
  const secretBytes = Uint8Array.from(atob(secret.replace(/^whsec_/, '')), (c) => c.charCodeAt(0))
  const signedContent = `${svixId}.${svixTimestamp}.${body}`

  const key = await crypto.subtle.importKey(
    'raw',
    secretBytes,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const signatureBytes = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(signedContent))
  const expected = btoa(String.fromCharCode(...new Uint8Array(signatureBytes)))

  return svixSignature
    .split(' ')
    .map((part) => part.split(',')[1])
    .filter(Boolean)
    .some((sig) => sig === expected)
}

interface ResendBounceEvent {
  type: string
  data?: {
    tags?: { name: string; value: string }[]
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const secret = Deno.env.get('RESEND_WEBHOOK_SECRET')
    const svixId = req.headers.get('svix-id')
    const svixTimestamp = req.headers.get('svix-timestamp')
    const svixSignature = req.headers.get('svix-signature')
    const body = await req.text()

    if (!secret || !svixId || !svixTimestamp || !svixSignature) {
      return new Response(JSON.stringify({ error: 'Signature manquante' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const valid = await verifySvixSignature(body, svixId, svixTimestamp, svixSignature, secret)
    if (!valid) {
      return new Response(JSON.stringify({ error: 'Signature invalide' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const event = JSON.parse(body) as ResendBounceEvent

    if (event.type !== 'email.bounced') {
      return new Response(JSON.stringify({ skipped: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const demandeId = event.data?.tags?.find((t) => t.name === 'demande_id')?.value
    if (!demandeId) {
      return new Response(JSON.stringify({ skipped: true, reason: 'Pas de tag demande_id' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const adminClient = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } })

    const { error } = await adminClient
      .from('demandes_adhesion')
      .update({ email_bounced_at: new Date().toISOString() })
      .eq('id', demandeId)

    if (error) {
      console.error('demandes_adhesion update error:', error)
      return new Response(JSON.stringify({ error: 'Erreur serveur' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    console.error('resend-bounce-webhook error:', err)
    return new Response(JSON.stringify({ error: 'Erreur serveur', detail: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
