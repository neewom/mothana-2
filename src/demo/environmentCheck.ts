// Vérifications faites avant de télécharger le moteur : sans elles, la démo échouerait plus loin
// sur une erreur technique (tinbase signe ses jetons avec crypto.subtle, absent hors contexte
// sécurisé ; la base vit dans IndexedDB, refusé par certaines navigations privées).
import type { UnsupportedReason } from './loading/bootState'
import { DEMO_DB_NAME } from './storage'

const PROBE_DB = 'samakan-demo-probe'

/** IndexedDB utilisable : ouverture d'une base d'essai, aussitôt supprimée. */
function canUseIndexedDb(timeoutMs = 5000): Promise<boolean> {
  return new Promise((resolve) => {
    let settled = false
    const done = (ok: boolean) => {
      if (settled) return
      settled = true
      resolve(ok)
    }
    const timer = window.setTimeout(() => done(false), timeoutMs)
    try {
      const req = indexedDB.open(PROBE_DB)
      req.onsuccess = () => {
        window.clearTimeout(timer)
        req.result.close()
        indexedDB.deleteDatabase(PROBE_DB)
        done(true)
      }
      req.onerror = () => {
        window.clearTimeout(timer)
        done(false)
      }
    } catch {
      window.clearTimeout(timer)
      done(false)
    }
  })
}

/** Raison pour laquelle la démo ne peut pas tourner ici, ou `null` si tout est en place. */
export async function checkEnvironment({ needsStorage }: { needsStorage: boolean }): Promise<UnsupportedReason | null> {
  if (!window.isSecureContext || !globalThis.crypto?.subtle || typeof globalThis.crypto.randomUUID !== 'function') return 'insecure'
  if (needsStorage && (typeof indexedDB === 'undefined' || !(await canUseIndexedDb()))) return 'storage'
  return null
}

/** Vrai si la base de la démo existe déjà dans ce navigateur (visite suivante). */
export async function hasStoredDemo(): Promise<boolean> {
  try {
    const dbs = await indexedDB.databases?.()
    return !!dbs?.some((d) => d.name === `/pglite/${DEMO_DB_NAME}`)
  } catch {
    return false
  }
}
