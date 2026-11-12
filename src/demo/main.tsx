// Spike démo PGlite — point d'entrée dédié (demo.html, build vite.demo.config.ts).
// Rien de ce dossier n'est importé par l'application normale.
import { DEMO_ORIGIN, installDemoFetch } from './fetchInterceptor'

const status = document.getElementById('demo-status')
const say = (msg: string) => {
  if (status) status.textContent = msg
}

declare global {
  interface Window {
    __demo?: { timings: Record<string, number>; firstBoot: boolean; reset: () => Promise<void>; blocked: string[]; backend: unknown }
  }
}

async function boot() {
  const t0 = performance.now()
  say('Préparation de la démo…')
  const { startDemoBackend, resetDemo, DEMO_ADMIN } = await import('./backend')
  const demo = await startDemoBackend({ persist: !new URLSearchParams(location.search).has('mem') })
  const blocked = installDemoFetch(demo.backend)
  window.__demo = {
    timings: { ...demo.timings, sinceNavStart: 0 },
    firstBoot: demo.firstBoot,
    blocked,
    backend: demo.backend,
    reset: async () => {
      await resetDemo()
      location.href = '/admin'
    },
  }

  // Le client supabase de l'application est créé à l'import : le fetch est déjà intercepté.
  const { supabase } = await import('../lib/supabaseClient')
  const { data } = await supabase.auth.getSession()
  if (!data.session && !location.pathname.startsWith('/benevole') && !location.pathname.startsWith('/login')) {
    say('Connexion au compte de démo…')
    const { error } = await supabase.auth.signInWithPassword(DEMO_ADMIN)
    if (error) throw error
  }
  if (location.pathname === '/' || location.pathname === '/demo.html') history.replaceState(null, '', '/admin')

  const { mountApp } = await import('./mountApp')
  mountApp()
  window.__demo.timings.boot = performance.now() - t0
  window.__demo.timings.sinceNavStart = performance.now()
  console.info('[demo] prêt', DEMO_ORIGIN, window.__demo.timings)
}

boot().catch((err) => {
  console.error('[demo] échec du démarrage', err)
  say(`La démo n'a pas pu démarrer : ${err instanceof Error ? err.message : String(err)}`)
})
