// Point d'entrée de la démo (demo.html). Rien de ce dossier n'est chargé par l'application normale
// ni par la landing : la base (PGlite) et son stockage IndexedDB ne démarrent qu'ici.
// Les imports statiques de ce fichier restent légers (écran d'attente) ; le moteur, la couche
// Supabase locale et l'application se téléchargent en parallèle, dès l'ouverture de la page.
import { createRoot } from 'react-dom/client'
import '../index.css'
import { downloadEngine } from './engineDownload'
import { checkEnvironment, hasStoredDemo } from './environmentCheck'
import { installDemoFetch } from './fetchInterceptor'
import { createBootStore, startFromPath } from './loading/bootState'
import { LoadingScreen } from './loading/LoadingScreen'
import { registerDatabaseCloser, resetDemo } from './storage'

declare global {
  interface Window {
    /** Mesures et accès de test (smoke test Playwright, diagnostic). */
    __demo?: { timings: Record<string, number>; firstBoot: boolean; blocked: string[]; reset: () => Promise<void> }
  }
}

// Porte de sortie (« Connexion lente ? ») si la démo n'est toujours pas prête : 20 s après le
// démarrage du script, soit 22 à 24 s après le clic en 4G lente (page et script compris).
const SLOW_AFTER_MS = 20_000
// Au-delà, l'écran d'attente s'efface même si le premier écran n'a pas encore son titre.
const FIRST_SCREEN_TIMEOUT_MS = 10_000

const store = createBootStore({ start: startFromPath(location.pathname) })
const overlay = document.getElementById('demo-loading')
const appRoot = document.getElementById('root')

function dismissOverlay() {
  if (!overlay || overlay.dataset.state === 'closing') return
  overlay.dataset.state = 'closing'
  if (appRoot) appRoot.inert = false
  // Fondu de sortie (cf. demo.html), puis retrait.
  window.setTimeout(() => overlay.remove(), 200)
}

if (overlay) {
  if (appRoot) appRoot.inert = true
  createRoot(overlay).render(<LoadingScreen store={store} onDismiss={dismissOverlay} />)
}

/** Attend que le premier écran de l'application affiche son titre (tableau de bord, écran PIN…). */
function waitForFirstScreen(root: HTMLElement): Promise<void> {
  return new Promise((resolve) => {
    if (root.querySelector('h1')) return resolve()
    const observer = new MutationObserver(() => {
      if (root.querySelector('h1')) finish()
    })
    const timer = window.setTimeout(finish, FIRST_SCREEN_TIMEOUT_MS)
    function finish() {
      observer.disconnect()
      window.clearTimeout(timer)
      resolve()
    }
    observer.observe(root, { childList: true, subtree: true })
  })
}

// Adresses de départ remplacées par l'écran choisi ; une adresse précise (ex. /admin/dons) est gardée.
function isEntryPath(pathname: string): boolean {
  return ['/', '/demo.html', '/login'].includes(pathname) || pathname.startsWith('/login/') || pathname.startsWith('/benevole')
}

async function boot() {
  const t0 = performance.now()
  // ?mem : base en mémoire, rien n'est écrit dans IndexedDB (tests automatisés).
  const persist = !new URLSearchParams(location.search).has('mem')

  const unsupported = await checkEnvironment({ needsStorage: persist })
  if (unsupported) {
    store.set({ phase: 'unsupported', unsupported })
    return
  }
  const returning = persist && (await hasStoredDemo())
  store.set({ returning })

  const slowTimer = window.setTimeout(() => store.set({ slow: true }), SLOW_AFTER_MS)
  // Tout part en même temps : moteur (suivi), couche Supabase locale, application.
  const enginePromise = downloadEngine((download) => store.set({ download }))
  const backendModule = import('./backend')
  const appModule = import('./mountApp')
  // Pages du premier écran (chargées à la demande par l'application) : téléchargées dès
  // maintenant, elles sont prêtes au montage. Mêmes modules, donc mêmes fichiers, que ceux
  // de l'application.
  void Promise.all([import('../pages/AdminLayout'), import('../pages/DashboardPage'), import('../pages/BenevoleLoginPage')]).catch(() => undefined)

  const engine = await enginePromise
  const tEngine = performance.now() - t0
  store.set({ phase: 'prepare' })
  const { startDemoBackend, DEMO_ADMIN } = await backendModule
  const demo = await startDemoBackend({ persist, engine, onStep: (prepareStep) => store.set({ prepareStep }) })
  registerDatabaseCloser(() => demo.pg.close())
  const blocked = installDemoFetch(demo.backend)
  demo.timings.engine = tEngine
  window.__demo = { timings: demo.timings, firstBoot: demo.firstBoot, blocked, reset: resetDemo }

  // Le choix du point de départ se fige ici.
  store.set({ phase: 'open' })
  const start = store.get().start
  // Le client supabase de l'application est créé à son import : le fetch est déjà intercepté.
  const { supabase } = await import('../lib/supabaseClient')
  // Base neuve (première visite, nouvelle version de la démo, ?mem) : une session restée dans le
  // navigateur appartient à l'ancienne base et n'y vaut plus rien, on la retire.
  if (demo.firstBoot) await supabase.auth.signOut({ scope: 'local' })
  const { data } = await supabase.auth.getSession()
  const isAdminSession = data.session?.user.email === DEMO_ADMIN.email
  if (start === 'admin') {
    if (!isAdminSession) {
      if (data.session) await supabase.auth.signOut({ scope: 'local' })
      const { error } = await supabase.auth.signInWithPassword(DEMO_ADMIN)
      if (error) throw error
    }
    if (isEntryPath(location.pathname)) history.replaceState(null, '', '/admin')
  } else {
    // Bénévole : le vrai écran PIN, sauf si une session bénévole est déjà ouverte sur sa saisie.
    const benevoleSessionOnPage = !!data.session && !isAdminSession && location.pathname.startsWith('/benevole')
    if (!benevoleSessionOnPage) {
      if (data.session) await supabase.auth.signOut({ scope: 'local' })
      history.replaceState(null, '', '/login/benevole')
    }
  }

  demo.timings.session = performance.now() - t0
  const { mountApp } = await appModule
  demo.timings.appCode = performance.now() - t0
  mountApp()
  if (appRoot) await waitForFirstScreen(appRoot)
  window.clearTimeout(slowTimer)
  demo.timings.boot = performance.now() - t0
  store.set({ phase: 'ready' })
}

boot().catch((err) => {
  console.error('[démo] échec du démarrage', err)
  store.set({ phase: 'error', error: err instanceof Error ? err.message : String(err) })
})
