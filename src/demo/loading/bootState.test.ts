import { describe, expect, it } from 'vitest'
import { createBootStore, overallPercent, startFromPath } from './bootState'

describe('startFromPath', () => {
  it('ouvre l’espace bénévole sur un lien bénévole, le tableau de bord sinon', () => {
    expect(startFromPath('/benevole')).toBe('benevole')
    expect(startFromPath('/login/benevole')).toBe('benevole')
    expect(startFromPath('/admin/dons')).toBe('admin')
    expect(startFromPath('/')).toBe('admin')
  })
})

describe('overallPercent', () => {
  it('suit le téléchargement puis avance par étape jusqu’à 100', () => {
    const store = createBootStore({ start: 'admin' })
    expect(overallPercent(store.get())).toBe(0)
    store.set({ download: { fraction: 0.5, loadedBytes: 1, totalBytes: 2 } })
    expect(overallPercent(store.get())).toBe(40)
    store.set({ phase: 'prepare' })
    const prepare = overallPercent(store.get())
    store.set({ prepareStep: 'seed' })
    expect(overallPercent(store.get())).toBeGreaterThan(prepare)
    store.set({ phase: 'open' })
    expect(overallPercent(store.get())).toBeLessThan(100)
    store.set({ phase: 'ready' })
    expect(overallPercent(store.get())).toBe(100)
  })

  it('prévient les abonnés à chaque changement', () => {
    const store = createBootStore({ start: 'admin' })
    let calls = 0
    const off = store.subscribe(() => calls++)
    store.set({ slow: true })
    off()
    store.set({ slow: false })
    expect(calls).toBe(1)
  })
})
