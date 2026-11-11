import { lazy, type ComponentType } from 'react'

const RELOAD_KEY = 'samakan:chunk-reload-at'
/** Fenêtre pendant laquelle un second échec n'entraîne plus de rechargement (anti-boucle). */
export const RELOAD_GUARD_MS = 30_000

/** Pose l'horodatage du rechargement ; false si un rechargement récent existe ou si le stockage est indisponible. */
function claimReload(now: number): boolean {
  try {
    const last = Number(window.sessionStorage.getItem(RELOAD_KEY))
    if (Number.isFinite(last) && last > 0 && now - last < RELOAD_GUARD_MS) return false
    window.sessionStorage.setItem(RELOAD_KEY, String(now))
    return true
  } catch {
    return false
  }
}

/**
 * Charge un module de page ; si le chargement échoue (fichier disparu après un nouveau
 * déploiement), recharge la page une seule fois. Si l'échec se reproduit juste après ce
 * rechargement, ou si le stockage de session est indisponible (pas de garde-fou contre une
 * boucle), l'erreur remonte. Le garde-fou est horodaté plutôt qu'effacé au premier succès :
 * après rechargement, le layout se charge bien alors que la page fille peut encore échouer.
 */
export async function loadWithReload<M>(load: () => Promise<M>, now: () => number = Date.now): Promise<M> {
  try {
    return await load()
  } catch (error) {
    if (claimReload(now())) {
      window.location.reload()
      // La page se recharge : on ne résout jamais, pour ne pas afficher d'erreur entre-temps.
      return new Promise<never>(() => {})
    }
    throw error
  }
}

/** `React.lazy` qui survit à un nouveau déploiement (voir loadWithReload). */
export function lazyWithReload<T extends ComponentType<object>>(load: () => Promise<{ default: T }>) {
  return lazy(() => loadWithReload(load))
}
