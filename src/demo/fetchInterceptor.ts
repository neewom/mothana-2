// Spike démo PGlite — tout appel vers l'URL « Supabase » de la démo est servi en local
// par le backend in-process ; tout appel vers un vrai Supabase est bloqué et journalisé.
import type { TinbaseBackend } from 'tinbase'

export const DEMO_ORIGIN = new URL(import.meta.env.VITE_SUPABASE_URL as string).origin

export function installDemoFetch(backend: TinbaseBackend): string[] {
  const realFetch = window.fetch.bind(window)
  const blocked: string[] = []
  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
    if (url.startsWith(DEMO_ORIGIN)) {
      const t = performance.now()
      const res = await backend.fetch(new Request(input, init))
      console.debug(`[demo] ${init?.method ?? 'GET'} ${url.slice(DEMO_ORIGIN.length, DEMO_ORIGIN.length + 160)} -> ${res.status} ${Math.round(performance.now() - t)}ms`)
      return res
    }
    if (/supabase\.(co|in)|samakan\.fr/.test(url)) {
      blocked.push(url)
      console.warn('[demo] appel externe bloqué', url)
      return new Response(JSON.stringify({ error: 'Bloqué par la démo' }), { status: 503 })
    }
    return realFetch(input, init)
  }
  return blocked
}
