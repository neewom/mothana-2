// Tout appel vers l'URL « Supabase » de la démo est servi dans l'onglet par le backend local ;
// tout appel vers un autre hôte est refusé (en plus de la CSP `connect-src 'self'` de
// demo.samakan.fr) : rien ne quitte le navigateur. Les fichiers de l'application elle-même
// (même origine) passent normalement.
import type { TinbaseBackend } from 'tinbase'

export const DEMO_API_ORIGIN = new URL(import.meta.env.VITE_SUPABASE_URL as string).origin

function requestUrl(input: RequestInfo | URL): string {
  return typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
}

/** Installe l'interception. Renvoie la liste (vivante) des URL externes refusées. */
export function installDemoFetch(backend: TinbaseBackend): string[] {
  const realFetch = window.fetch.bind(window)
  const blocked: string[] = []
  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(requestUrl(input), location.href)
    if (url.origin === DEMO_API_ORIGIN) return backend.fetch(new Request(input, init))
    // Même origine (fichiers de l'application, moteur PGlite) et URL locales (blob:, data:).
    if (url.origin === location.origin || url.protocol === 'blob:' || url.protocol === 'data:') return realFetch(input, init)
    blocked.push(url.href)
    console.warn('[démo] appel externe refusé', url.href)
    return new Response(JSON.stringify({ error: 'Appel externe refusé par la démo' }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' },
    })
  }
  return blocked
}
