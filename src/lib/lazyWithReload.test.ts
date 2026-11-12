import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { loadWithReload, RELOAD_GUARD_MS } from './lazyWithReload'

const KEY = 'samakan:chunk-reload-at'
const NOW = 1_000_000_000

function fakeWindow(storage: Map<string, string> | null) {
  const reload = vi.fn()
  const blocked = () => { throw new Error('blocked') }
  const sessionStorage = storage
    ? {
        getItem: (k: string) => storage.get(k) ?? null,
        setItem: (k: string, v: string) => void storage.set(k, v),
      }
    : { getItem: blocked, setItem: blocked }
  vi.stubGlobal('window', { sessionStorage, location: { reload } })
  return reload
}

const failing = () => Promise.reject(new Error('Failed to fetch dynamically imported module'))
const pending = Symbol('pending')
const settle = <T>(p: Promise<T>) => Promise.race([p, new Promise((r) => setTimeout(() => r(pending), 10))])

describe('loadWithReload', () => {
  let storage: Map<string, string>
  beforeEach(() => { storage = new Map() })
  afterEach(() => { vi.unstubAllGlobals() })

  it('renvoie le module sans recharger quand le chargement réussit', async () => {
    const reload = fakeWindow(storage)
    await expect(loadWithReload(() => Promise.resolve({ default: 'ok' }), () => NOW)).resolves.toEqual({ default: 'ok' })
    expect(reload).not.toHaveBeenCalled()
  })

  it('recharge la page une fois au premier échec, sans résoudre', async () => {
    const reload = fakeWindow(storage)
    expect(await settle(loadWithReload(failing, () => NOW))).toBe(pending)
    expect(reload).toHaveBeenCalledTimes(1)
    expect(storage.get(KEY)).toBe(String(NOW))
  })

  it('laisse remonter l’erreur si l’échec se reproduit juste après le rechargement', async () => {
    const reload = fakeWindow(storage)
    storage.set(KEY, String(NOW))
    // Un autre module (le layout) a pu se charger entre-temps : le garde-fou tient toujours.
    await loadWithReload(() => Promise.resolve('layout'), () => NOW + 500)
    await expect(loadWithReload(failing, () => NOW + 1000)).rejects.toThrow('Failed to fetch')
    expect(reload).not.toHaveBeenCalled()
  })

  it('recharge de nouveau lors d’un déploiement ultérieur, une fois la fenêtre passée', async () => {
    const reload = fakeWindow(storage)
    storage.set(KEY, String(NOW))
    expect(await settle(loadWithReload(failing, () => NOW + RELOAD_GUARD_MS + 1))).toBe(pending)
    expect(reload).toHaveBeenCalledTimes(1)
  })

  it('ne recharge pas si le stockage de session est indisponible (pas de boucle possible)', async () => {
    const reload = fakeWindow(null)
    await expect(loadWithReload(failing, () => NOW)).rejects.toThrow('Failed to fetch')
    expect(reload).not.toHaveBeenCalled()
  })
})
