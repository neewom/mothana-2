// Stockage local de la démo : une base PGlite dans IndexedDB, plus la session supabase-js dans
// localStorage. Rien n'est écrit avant le démarrage de la démo (src/demo/main.tsx), ni depuis la
// landing ou l'application normale. Module sans dépendance lourde : le bandeau l'importe.

export const DEMO_DB_NAME = 'samakan-demo'
// PGlite range la base dans IndexedDB sous le nom /pglite/<dataDir>.
const DEMO_IDB_NAME = `/pglite/${DEMO_DB_NAME}`
// Clé de session de supabase-js : sb-<premier label de l'hôte de VITE_SUPABASE_URL>-auth-token.
const SESSION_KEY_PREFIX = 'sb-demo'

let closeDatabase: (() => Promise<void>) | null = null

/** Appelé au démarrage : permet de fermer la base avant de l'effacer. */
export function registerDatabaseCloser(close: () => Promise<void>): void {
  closeDatabase = close
}

/** Supprime la base IndexedDB de la démo (à appeler base fermée). */
export function deleteDemoDatabase(): Promise<void> {
  return new Promise((resolve) => {
    const req = indexedDB.deleteDatabase(DEMO_IDB_NAME)
    req.onsuccess = req.onerror = req.onblocked = () => resolve()
  })
}

/** Efface toute la démo (base, session) puis repart de zéro sur le tableau de bord. */
export async function resetDemo(): Promise<void> {
  await closeDatabase?.().catch(() => undefined)
  await deleteDemoDatabase()
  for (const k of Object.keys(localStorage)) if (k.startsWith(SESSION_KEY_PREFIX)) localStorage.removeItem(k)
  sessionStorage.clear()
  location.assign('/admin')
}
