// Staging-only integration check. Uses local .env; never prints secrets/capabilities.
import { createClient } from '@supabase/supabase-js'
import { randomUUID } from 'node:crypto'
import { writeFile } from 'node:fs/promises'
import assert from 'node:assert/strict'
process.loadEnvFile('.env')
const url = process.env.VITE_SUPABASE_URL
assert.equal(url, 'https://cxngcmvxktddhyxboyyx.supabase.co')
const activeObservers = new Set()
const key = process.env.VITE_SUPABASE_ANON_KEY
const client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
const call = async (body, jwt) => {
  const response = await fetch(`${url}/functions/v1/coupon-transport-spike`, {
    method: 'POST', signal: AbortSignal.timeout(12000),
    headers: { 'Content-Type': 'application/json', apikey: key, ...(jwt ? { Authorization: `Bearer ${jwt}` } : {}) },
    body: JSON.stringify(body),
  })
  return { status: response.status, body: await response.json() }
}
try {
  assert.equal((await call({ action: 'create' })).status, 403)
  const auth = await client.auth.signInWithPassword({ email: process.env.SUPER_ADMIN_ID, password: process.env.SUPER_ADMIN_PASSWORD })
  assert.ok(auth.data.session, 'staging super-admin authentication failed')
  const created = await call({ action: 'create' }, auth.data.session.access_token)
  assert.equal(created.status, 200, 'create failed')
  await client.auth.signOut({ scope: 'local' })
  const { sessionId, sellerToken, buyerToken } = created.body
  const seller = { sessionId, token: sellerToken }
  const buyer = { sessionId, token: buyerToken }
  assert.equal((await call({ ...buyer, token: '0'.repeat(64), action: 'read' })).status, 403)
  assert.equal((await call({ ...buyer, action: 'request', requestId: randomUUID() })).status, 403)
  const initial = await call({ ...buyer, action: 'read' })
  assert.equal(initial.status, 200)
  let onHint = () => {}
  const channel = client.channel(initial.body.topic).on('broadcast', { event: 'changed' }, ({ payload }) => {
    assert.deepEqual(payload, {}, 'public payload must be empty')
    onHint()
  })
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Broadcast subscribe timed out')), 10000)
    channel.subscribe(status => {
      if (status === 'SUBSCRIBED') { clearTimeout(timer); resolve() }
      else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') { clearTimeout(timer); reject(new Error('Broadcast subscribe failed')) }
    })
  })
  const samples = []
  async function observe(mode, actor, predicate) {
    let active = true
    let running = false
    let interval
    let timer
    let resolveObserved, rejectObserved
    const promise = new Promise((resolve, reject) => { resolveObserved = resolve; rejectObserved = reject })
    const check = async () => {
      if (!active || running) return
      running = true
      try {
        const result = await call({ ...actor, action: 'read' })
        assert.equal(result.status, 200)
        if (predicate(result.body)) { active = false; resolveObserved() }
      } catch (error) { active = false; rejectObserved(error) }
      finally { running = false }
    }
    if (mode === 'broadcast') onHint = () => { void check() }
    else interval = setInterval(() => { void check() }, 1000)
    timer = setTimeout(() => rejectObserved(new Error('observation timeout')), 10000)
    const cleanup = () => { active = false; clearInterval(interval); clearTimeout(timer); onHint = () => {}; activeObservers.delete(cleanup) }
    activeObservers.add(cleanup)
    return { promise, cleanup }
  }
  for (const mode of ['broadcast', 'polling']) {
    for (let i = 0; i < 5; i++) {
      const requestId = randomUUID()
      const receive = await observe(mode, buyer, s => s.requestId === requestId && s.status === 'pending')
      let start = performance.now()
      const write = call({ ...seller, action: 'request', requestId })
      await receive.promise
      const requestMs = Math.round(performance.now() - start)
      receive.cleanup()
      assert.equal((await write).status, 200)
      assert.equal((await call({ ...seller, action: 'decide', requestId, accept: true })).status, 403)
      const decision = await observe(mode, seller, s => s.requestId === requestId && s.status === 'accepted')
      start = performance.now()
      const decide = call({ ...buyer, action: 'decide', requestId, accept: true })
      await decision.promise
      const decisionMs = Math.round(performance.now() - start)
      decision.cleanup()
      assert.equal((await decide).status, 200)
      const replay = await call({ ...buyer, action: 'decide', requestId, accept: false })
      assert.equal(replay.body.status, 'accepted')
      samples.push({ mode, requestMs, decisionMs })
    }
  }
  const report = { measuredAt: new Date().toISOString(), environment: 'One Mac / Node clients, staging, NOT two mobile phones; polling phase starts at action', samples }
  await writeFile('/tmp/coupon3-network-results.json', JSON.stringify(report, null, 2))
  console.log(JSON.stringify(report, null, 2))
} finally {
  for (const cleanup of activeObservers) cleanup()
  await client.removeAllChannels()
  await client.auth.signOut({ scope: 'local' })
  client.realtime.disconnect()
}
