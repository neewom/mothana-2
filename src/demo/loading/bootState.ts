// État du démarrage de la démo, partagé entre main.tsx (qui le fait avancer) et l'écran d'attente
// (qui l'affiche et y inscrit le choix du point de départ). Petit magasin sans dépendance, lu
// par React via useSyncExternalStore.
import type { DownloadProgress } from '../engineDownload'
import type { BackendStep } from '../backend'

export type BootPhase = 'download' | 'prepare' | 'open' | 'ready' | 'error' | 'unsupported'
/** Pourquoi la démo ne peut pas tourner dans ce navigateur. */
export type UnsupportedReason = 'insecure' | 'storage'
export type StartPoint = 'admin' | 'benevole'

export interface BootState {
  phase: BootPhase
  download: DownloadProgress
  /** Sous-étape de la préparation : base ouverte, schéma, jeu de données. */
  prepareStep: 'database' | BackendStep
  /** Visite suivante (base déjà dans ce navigateur) ; `null` tant qu'on ne le sait pas. */
  returning: boolean | null
  start: StartPoint
  /** Vrai après le délai de la porte de sortie (connexion lente). */
  slow: boolean
  error: string | null
  unsupported: UnsupportedReason | null
}

export interface BootStore {
  get(): BootState
  set(patch: Partial<BootState>): void
  subscribe(listener: () => void): () => void
}

export function createBootStore(initial: Pick<BootState, 'start'>): BootStore {
  let state: BootState = {
    phase: 'download',
    download: { fraction: 0, loadedBytes: null, totalBytes: null },
    prepareStep: 'database',
    returning: null,
    slow: false,
    error: null,
    unsupported: null,
    ...initial,
  }
  const listeners = new Set<() => void>()
  return {
    get: () => state,
    set(patch) {
      state = { ...state, ...patch }
      listeners.forEach((l) => l())
    },
    subscribe(listener) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
  }
}

/** Point de départ déduit de l'adresse ouverte (lien direct vers l'espace bénévole). */
export function startFromPath(pathname: string): StartPoint {
  return pathname.startsWith('/benevole') || pathname.startsWith('/login/benevole') ? 'benevole' : 'admin'
}

// Part de la barre réservée à chaque étape : le téléchargement est l'essentiel de l'attente
// au premier passage ; la préparation (schéma, jeu de données) prend quelques secondes.
const DOWNLOAD_SHARE = 80
const PREPARE_SHARE: Record<BootState['prepareStep'], number> = { database: 82, schema: 86, seed: 90 }

/** Avancement global, de 0 à 100. */
export function overallPercent(state: BootState): number {
  switch (state.phase) {
    case 'download':
      return Math.round(state.download.fraction * DOWNLOAD_SHARE)
    case 'prepare':
      return PREPARE_SHARE[state.prepareStep]
    case 'open':
      return 95
    case 'ready':
      return 100
    case 'error':
    case 'unsupported':
      return Math.round(state.download.fraction * DOWNLOAD_SHARE)
  }
}
