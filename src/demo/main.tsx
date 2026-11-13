// Point d'entrée de la démo (demo.html). Rien de ce dossier n'est chargé par l'application normale
// ni par la landing : la base (PGlite) et son stockage IndexedDB ne démarrent qu'ici.
// Les imports statiques de ce fichier restent légers ; le moteur et l'application se téléchargent
// en parallèle par des imports dynamiques.
import { installDemoFetch } from './fetchInterceptor'
import { registerDatabaseCloser, resetDemo } from './storage'

declare global {
  interface Window {
    /** Mesures et accès de test (smoke test Playwright, diagnostic). */
    __demo?: { timings: Record<string, number>; firstBoot: boolean; blocked: string[]; reset: () => Promise<void> }
  }
}

const status = document.getElementById('demo-status')
function say(message: string) {
  if (status) status.textContent = message
}

async function boot() {
  const t0 = performance.now()
  say('Préparation de la démo…')
  // Le code de l'application se télécharge pendant que la base démarre.
  const appModule = import('./mountApp')
  const { startDemoBackend, DEMO_ADMIN } = await import('./backend')
  // ?mem : base en mémoire, rien n'est écrit dans IndexedDB (tests automatisés).
  const demo = await startDemoBackend({ persist: !new URLSearchParams(location.search).has('mem') })
  registerDatabaseCloser(() => demo.pg.close())
  const blocked = installDemoFetch(demo.backend)
  window.__demo = { timings: demo.timings, firstBoot: demo.firstBoot, blocked, reset: resetDemo }

  // Le client supabase de l'application est créé à son import : le fetch est déjà intercepté.
  const { supabase } = await import('../lib/supabaseClient')
  const { data } = await supabase.auth.getSession()
  const ouvertSansCompte = location.pathname.startsWith('/benevole') || location.pathname.startsWith('/login')
  if (!data.session && !ouvertSansCompte) {
    say('Connexion au compte de démo…')
    const { error } = await supabase.auth.signInWithPassword(DEMO_ADMIN)
    if (error) throw error
  }
  if (location.pathname === '/' || location.pathname === '/demo.html') history.replaceState(null, '', '/admin')

  const { mountApp } = await appModule
  mountApp()
  demo.timings.boot = performance.now() - t0
}

boot().catch((err) => {
  console.error('[démo] échec du démarrage', err)
  say(`La démo n'a pas pu démarrer : ${err instanceof Error ? err.message : String(err)}`)
})
