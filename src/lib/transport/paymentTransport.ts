import type { SyncReason, TransportEvent, TransportMode, TransportSnapshot } from '../../types/paymentTransport'

export class TransportAccessError extends Error {}

interface TransportOptions<T extends TransportSnapshot> {
  mode: TransportMode
  read: (signal: AbortSignal) => Promise<T>
  subscribe: (hint: () => void, connected: (ready: boolean) => void) => () => void
  onSnapshot: (snapshot: T, reason: SyncReason) => void
  onEvent: (event: TransportEvent) => void
  pollMs?: number
  reconcileMs?: number
  timeoutMs?: number
}

/** Broadcast is an untrusted wake-up hint. Only read() may supply application state.
 * No mutation retry here: a timed-out write must be reconciled by its request ID.
 */
export function createPaymentTransport<T extends TransportSnapshot>(options: TransportOptions<T>) {
  let stopped = false
  let active = true
  let online = true
  let connected = false
  let revision = -1
  let failures = 0
  let queued: SyncReason | null = null
  let controller: AbortController | undefined
  let timer: ReturnType<typeof setTimeout> | undefined
  let unsubscribe: (() => void) | undefined
  let lastRead = -Infinity
  const pollMs = options.pollMs ?? 1000
  const report = (event: string, extra: Partial<TransportEvent> = {}) => {
    if (!stopped) options.onEvent({ at: new Date().toISOString(), event, ...extra })
  }
  const clearTimer = () => { if (timer) clearTimeout(timer); timer = undefined }
  const schedule = () => {
    clearTimer()
    if (stopped || !active || !online) return
    const base = options.mode === 'broadcast' && connected ? (options.reconcileMs ?? 5000) : pollMs
    const delay = failures ? Math.min(15000, pollMs * 2 ** Math.min(failures, 4)) : base
    timer = setTimeout(() => { void refresh('poll') }, delay)
  }
  async function refresh(reason: SyncReason) {
    if (stopped || !active || !online) return
    if (controller) { queued = reason; return }
    // A leaked public topic must not turn hints into an unbounded HTTP request storm.
    if (reason === 'broadcast' && Date.now() - lastRead < 250) {
      clearTimer()
      timer = setTimeout(() => { void refresh('broadcast') }, 250)
      return
    }
    clearTimer()
    const request = new AbortController()
    controller = request
    lastRead = Date.now()
    const start = performance.now()
    const timeout = setTimeout(() => request.abort(), options.timeoutMs ?? 8000)
    try {
      const snapshot = await options.read(request.signal)
      if (stopped || request.signal.aborted) return
      failures = 0
      report(`read:${reason}`, { durationMs: Math.round(performance.now() - start), revision: snapshot.revision })
      if (snapshot.revision > revision) {
        revision = snapshot.revision
        options.onSnapshot(snapshot, reason)
      }
    } catch (error) {
      if (!stopped && request.signal.reason !== 'unavailable') {
        failures++
        report(error instanceof TransportAccessError ? 'access-denied' : 'read-error')
        if (error instanceof TransportAccessError) stop()
      }
    } finally {
      clearTimeout(timeout)
      controller = undefined
      const next = queued
      queued = null
      if (!stopped && next && failures === 0) void refresh(next)
      else schedule()
    }
  }
  function connect() {
    if (stopped || !active || !online || options.mode !== 'broadcast' || unsubscribe) return
    unsubscribe = options.subscribe(() => { void refresh('broadcast') }, ready => {
      if (stopped) return
      connected = ready
      report(ready ? 'broadcast-connected' : 'broadcast-fallback')
      void refresh('reconnect')
    })
  }
  function disconnect() {
    const cleanup = unsubscribe
    unsubscribe = undefined
    connected = false
    cleanup?.()
  }
  function stop() {
    stopped = true
    clearTimer()
    controller?.abort()
    disconnect()
  }
  return {
    start() { connect(); void refresh('initial') },
    refresh,
    setAvailability(visible: boolean, hasNetwork: boolean) {
      if (stopped) return
      const resume = (!active || !online) && visible && hasNetwork
      active = visible
      online = hasNetwork
      report(!online ? 'offline' : !active ? 'background' : 'foreground')
      if (!active || !online) { clearTimer(); disconnect(); controller?.abort('unavailable') }
      else { if (resume) failures = 0; connect(); if (resume) void refresh('resume') }
    },
    stop,
  }
}
