import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.108.2'

// Explicit allowlist: this experimental endpoint must never operate in production.
const stagingUrl = 'https://cxngcmvxktddhyxboyyx.supabase.co'
const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json',
  'Cache-Control': 'no-store',
}
const reply = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers })
const token = () => Array.from(crypto.getRandomValues(new Uint8Array(32)), b => b.toString(16).padStart(2, '0')).join('')
async function hash(value: string) {
  return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))), b => b.toString(16).padStart(2, '0')).join('')
}
const uuid = (value: unknown): value is string => typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)

Deno.serve(async req => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers })
  if (req.method !== 'POST') return reply({ error: 'METHOD_NOT_ALLOWED' }, 405)
  if (Deno.env.get('SUPABASE_URL') !== stagingUrl || Deno.env.get('COUPON_SPIKE_ENABLED') !== 'true') {
    return reply({ error: 'SPIKE_DISABLED' }, 404)
  }
  try {
    const bodyText = await req.text()
    if (bodyText.length > 2048) return reply({ error: 'INVALID_INPUT' }, 400)
    const body = JSON.parse(bodyText)
    if (!body || typeof body !== 'object') return reply({ error: 'INVALID_INPUT' }, 400)
    const admin = createClient(stagingUrl, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } })
    if (body.action === 'create') {
      const jwt = req.headers.get('Authorization')?.replace(/^Bearer /, '')
      if (!jwt) return reply({ error: 'ACCESS_DENIED' }, 403)
      const { data, error } = await admin.auth.getUser(jwt)
      if (error || data.user?.app_metadata?.is_super_admin !== true) return reply({ error: 'ACCESS_DENIED' }, 403)
      const sellerToken = token(), buyerToken = token()
      // Short-lived synthetic sessions only. Purge on the next authorized creation.
      const { error: purgeError } = await admin.from('coupon_transport_spike').delete().lt('expires_at', new Date().toISOString())
      if (purgeError) return reply({ error: 'STORAGE_ERROR' }, 500)
      const { data: session, error: insertError } = await admin.from('coupon_transport_spike').insert({
        seller_hash: await hash(sellerToken), buyer_hash: await hash(buyerToken), topic: `coupon-spike:${token()}`,
      }).select('id').single()
      if (insertError) return reply({ error: 'STORAGE_ERROR' }, 500)
      return reply({ sessionId: session.id, sellerToken, buyerToken })
    }
    if (!['read', 'request', 'decide'].includes(body.action) || !uuid(body.sessionId)
      || typeof body.token !== 'string' || !/^[0-9a-f]{64}$/.test(body.token)
      || (body.action !== 'read' && !uuid(body.requestId))
      || (body.action === 'decide' && typeof body.accept !== 'boolean')) {
      return reply({ error: 'INVALID_INPUT' }, 400)
    }
    const { data: snapshot, error } = await admin.rpc('coupon_spike_step', {
      p_session_id: body.sessionId, p_token: body.token, p_action: body.action,
      p_request_id: body.requestId ?? null, p_accept: body.accept ?? null,
    })
    if (error) return reply({ error: error.code === '42501' ? 'ACCESS_DENIED' : 'STATE_CONFLICT' }, error.code === '42501' ? 403 : 409)
    // Never send the secret, request, role, amount or decision over a public channel.
    // Failure to broadcast cannot undo the committed write; polling reconciles it.
    if (body.action !== 'read') {
      try {
        const response = await fetch(`${stagingUrl}/realtime/v1/api/broadcast`, {
          method: 'POST', signal: AbortSignal.timeout(1500),
          headers: { apikey: Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, 'Content-Type': 'application/json' },
          body: JSON.stringify({ messages: [{ topic: snapshot.topic, event: 'changed', payload: {}, private: false }] }),
        })
        if (!response.ok) console.warn('coupon-spike: broadcast unavailable')
      } catch { console.warn('coupon-spike: broadcast unavailable') }
    }
    return reply(snapshot)
  } catch {
    return reply({ error: 'INVALID_REQUEST' }, 400)
  }
})
