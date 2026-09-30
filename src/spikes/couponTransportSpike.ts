import { createClient } from '@supabase/supabase-js'
import { createPaymentTransport, TransportAccessError } from '../lib/transport/paymentTransport'
import type { SpikeSnapshot, TransportEvent, TransportMode } from '../types/paymentTransport'

const root = document.querySelector<HTMLDivElement>('#root')!
const url = import.meta.env.VITE_SUPABASE_URL
if (import.meta.env.VITE_COUPON_SPIKE !== 'true' || url !== 'https://cxngcmvxktddhyxboyyx.supabase.co') {
  root.textContent = 'Banc d’essai désactivé.'
} else {
  void mount()
}

async function mount() {
  // Separate ephemeral client: buyer never inherits a stored admin session.
  const client = createClient(url, import.meta.env.VITE_SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  })
  const fragment = new URLSearchParams(location.hash.slice(1))
  let sessionId = fragment.get('session') ?? ''
  let secret = fragment.get('token') ?? ''
  history.replaceState(null, '', location.pathname)
  let snapshot: SpikeSnapshot | undefined
  let transport: ReturnType<typeof createPaymentTransport<SpikeSnapshot>> | undefined
  let events: TransportEvent[] = []
  let run = 0
  let busy = false
  let requestId: string | undefined
  let mode: TransportMode = 'broadcast'
  let mutationStart: number | undefined
  let observedRevision = -1
  root.innerHTML = `
    <h1>Coupon 3 — Banc de transport</h1>
    <p>Demandes fictives uniquement. Aucun paiement, aucun débit. Session valable deux heures.</p>
    <section id="setup">
      <p>Création réservée au super-admin de recette. Les liens donnent accès à cette simulation.</p>
      <form id="login"><label>Email <input id="email" type="email" autocomplete="username" required></label>
      <label>Mot de passe <input id="password" type="password" autocomplete="current-password" required></label>
      <button>Créer une session d’essai</button></form>
      <div id="links"></div>
    </section>
    <label>Transport <select id="mode"><option value="broadcast">Broadcast + repli polling</option><option value="polling">Polling seul (1 seconde)</option></select></label>
    <p id="role"></p><p id="state" role="status">Connexion…</p>
    <p id="connection" role="status"></p>
    <p id="expiry"></p>
    <div><button id="request" hidden>Envoyer une demande fictive</button>
    <button id="accept" hidden>Accepter</button><button id="refuse" hidden>Refuser</button></div>
    <p>Un écran verrouillé peut suspendre le navigateur. Revenir au premier plan déclenche une relecture ; aucune validation hors ligne.</p>
    <label>Repère de test <input id="note" placeholder="Téléphone, navigateur, réseau, scénario"></label>
    <button id="mark">Marquer le scénario</button><button id="export">Exporter les mesures JSON</button>
    <pre id="log" aria-label="Journal du banc d’essai"></pre>`
  const element = <T extends HTMLElement>(id: string) => document.getElementById(id) as T
  const state = element('state')
  const buttons = ['request', 'accept', 'refuse'].map(id => element<HTMLButtonElement>(id))
  function log(event: TransportEvent) {
    events.push(event)
    // Bounded in-memory log, never include capabilities, URLs or topic names.
    events = events.slice(-3000)
    element('log').textContent = events.slice(-15).map(e => `${e.at} ${e.event}${e.durationMs === undefined ? '' : ` ${e.durationMs} ms`}${e.revision === undefined ? '' : ` rev ${e.revision}`}`).join('\n')
  }
  function record(event: string) { log({ at: new Date().toISOString(), event }) }
  function updateButtons() {
    buttons[0].hidden = snapshot?.role !== 'seller'
    buttons[1].hidden = buttons[2].hidden = snapshot?.role !== 'buyer'
    buttons[0].disabled = busy || !navigator.onLine || snapshot?.status === 'pending'
    buttons[1].disabled = buttons[2].disabled = busy || !navigator.onLine || snapshot?.status !== 'pending'
  }
  async function call(action: string, extra: Record<string, unknown> = {}, signal?: AbortSignal): Promise<SpikeSnapshot> {
    const response = await fetch(`${url}/functions/v1/coupon-transport-spike`, {
      method: 'POST', signal: signal ?? AbortSignal.timeout(8000), cache: 'no-store',
      headers: { 'Content-Type': 'application/json', apikey: import.meta.env.VITE_SUPABASE_ANON_KEY },
      body: JSON.stringify({ action, sessionId, token: secret, ...extra }),
    })
    if ([401, 403, 404].includes(response.status)) throw new TransportAccessError('Session expirée, accès refusé ou banc désactivé.')
    if (!response.ok) throw new Error('État à relire ; ne pas déduire un succès de cette erreur.')
    return response.json()
  }
  function display(next: SpikeSnapshot, reason: string) {
    snapshot = next
    const names = { idle: 'Prêt', pending: 'Demande en attente', accepted: 'Acceptée (simulation)', refused: 'Refusée', expired: 'Expirée' }
    state.textContent = `${names[next.status]} — révision ${next.revision} (${reason})`
    element('role').textContent = next.role === 'seller' ? 'Appareil vendeur' : 'Appareil acheteur'
    element('expiry').textContent = next.expiresAt ? `Expiration de la demande : ${new Date(next.expiresAt).toLocaleTimeString()}` : ''
    if (next.revision > observedRevision) {
      observedRevision = next.revision
      // Cross-device clocks are NOT synchronized: this is an indicative offset, not a latency result.
      log({ at: new Date().toISOString(), event: 'state-observed', revision: next.revision })
      if (mutationStart !== undefined && next.requestId === requestId && next.status !== 'pending') {
        log({ at: new Date().toISOString(), event: 'seller-round-trip-including-human', durationMs: Math.round(performance.now() - mutationStart), revision: next.revision })
        mutationStart = undefined
      }
    }
    updateButtons()
  }
  async function start() {
    const generation = ++run
    transport?.stop()
    transport = undefined
    snapshot = undefined
    updateButtons()
    try {
      const initial = await call('read')
      if (generation !== run) return
      display(initial, 'connexion')
      const current = createPaymentTransport<SpikeSnapshot>({
        mode,
        read: signal => call('read', {}, signal),
        subscribe: (hint, status) => {
          const channel = client.channel(initial.topic, { config: { private: false } })
            .on('broadcast', { event: 'changed' }, () => hint())
            .subscribe(value => status(value === 'SUBSCRIBED'))
          return () => { void client.removeChannel(channel) }
        },
        onSnapshot: (next, reason) => { if (generation === run) display(next, reason) },
        onEvent: event => {
          if (generation !== run) return
          log(event)
          if (['read-error', 'access-denied', 'offline', 'background', 'broadcast-fallback', 'broadcast-connected'].includes(event.event)) {
            const labels: Record<string, string> = { 'access-denied': 'Session terminée : créer un nouvel essai.', 'read-error': 'Lecture impossible, nouvelle tentative automatique.', offline: 'Hors ligne', background: 'Page en arrière-plan', 'broadcast-fallback': 'Polling de secours', 'broadcast-connected': 'Temps réel connecté' }
            element('connection').textContent = labels[event.event]
            if (event.event === 'access-denied') { snapshot = undefined; updateButtons() }
          } else if (event.event.startsWith('read:')) element('connection').textContent = 'État serveur relu'
        },
      })
      transport = current
      current.setAvailability(document.visibilityState === 'visible', navigator.onLine)
      current.start()
    } catch (error) { state.textContent = error instanceof Error ? error.message : 'Connexion impossible.' }
  }
  async function mutate(action: 'request' | 'decide', accept?: boolean) {
    if (busy || !snapshot || !navigator.onLine) return
    busy = true
    updateButtons()
    const started = performance.now()
    if (action === 'request') { requestId = crypto.randomUUID(); mutationStart = started }
    record(`action:${action}${accept === undefined ? '' : accept ? ':accept' : ':refuse'}`)
    try {
      await call(action, { requestId: action === 'request' ? requestId : snapshot.requestId, ...(accept === undefined ? {} : { accept }) })
      log({ at: new Date().toISOString(), event: 'write-http-round-trip', durationMs: Math.round(performance.now() - started) })
    } catch (error) {
      state.textContent = error instanceof Error ? error.message : 'Résultat inconnu.'
      record('write-result-unknown')
    } finally {
      // Never trust optimistic state. Re-read even after a timeout / lost response.
      await transport?.refresh('mutation')
      busy = false
      updateButtons()
    }
  }
  element<HTMLFormElement>('login').onsubmit = async event => {
    event.preventDefault()
    const submit = element<HTMLFormElement>('login').querySelector('button')!
    submit.disabled = true
    try {
      const { data, error } = await client.auth.signInWithPassword({ email: element<HTMLInputElement>('email').value, password: element<HTMLInputElement>('password').value })
      element<HTMLInputElement>('password').value = ''
      if (error || !data.session) throw new Error('Connexion refusée.')
      const response = await fetch(`${url}/functions/v1/coupon-transport-spike`, {
        method: 'POST', signal: AbortSignal.timeout(10000),
        headers: { 'Content-Type': 'application/json', apikey: import.meta.env.VITE_SUPABASE_ANON_KEY, Authorization: `Bearer ${data.session.access_token}` },
        body: JSON.stringify({ action: 'create' }),
      })
      if (!response.ok) throw new Error('Création refusée. Vérifier le compte super-admin et l’activation du banc.')
      const created: { sessionId: string; sellerToken: string; buyerToken: string } = await response.json()
      sessionId = created.sessionId
      secret = created.sellerToken
      const links = element('links')
      links.replaceChildren()
      for (const [label, value] of [['Vendeur', created.sellerToken], ['Acheteur', created.buyerToken]]) {
        const link = document.createElement('a')
        link.textContent = `Lien ${label} (à ouvrir sur le téléphone correspondant)`
        link.target = '_blank'
        link.rel = 'noopener noreferrer'
        link.href = `${location.origin}${location.pathname}#${new URLSearchParams({ session: sessionId, token: value })}`
        const paragraph = document.createElement('p')
        paragraph.append(link)
        links.append(paragraph)
      }
      await start()
    } catch (error) { state.textContent = error instanceof Error ? error.message : 'Création impossible.' }
    finally { await client.auth.signOut({ scope: 'local' }); submit.disabled = false }
  }
  element<HTMLSelectElement>('mode').onchange = event => {
    mode = (event.target as HTMLSelectElement).value as TransportMode
    record(`mode:${mode}`)
    if (sessionId) void start()
  }
  buttons[0].onclick = () => { void mutate('request') }
  buttons[1].onclick = () => { void mutate('decide', true) }
  buttons[2].onclick = () => { void mutate('decide', false) }
  element('mark').onclick = () => record(`scenario:${element<HTMLInputElement>('note').value.slice(0, 200)}`)
  element('export').onclick = () => {
    const blob = new Blob([JSON.stringify({ version: 1, mode, userAgent: navigator.userAgent, note: element<HTMLInputElement>('note').value, events }, null, 2)], { type: 'application/json' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = `coupon-transport-${Date.now()}.json`
    link.click()
    setTimeout(() => URL.revokeObjectURL(link.href), 1000)
  }
  const availability = () => { transport?.setAvailability(document.visibilityState === 'visible', navigator.onLine); updateButtons() }
  document.addEventListener('visibilitychange', availability)
  window.addEventListener('online', availability)
  window.addEventListener('offline', availability)
  window.addEventListener('pagehide', () => transport?.setAvailability(false, false))
  window.addEventListener('pageshow', availability)
  if (sessionId && secret) {
    element('setup').hidden = true
    await start()
  } else state.textContent = 'Créer une session pour obtenir les deux liens.'
}
