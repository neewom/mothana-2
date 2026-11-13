import { afterEach, describe, expect, it, vi } from 'vitest'
import { getDemoUrl } from './environment'

describe('getDemoUrl', () => {
  afterEach(() => vi.unstubAllGlobals())

  it.each(['samakan.fr', 'www.samakan.fr', 'mothana.vercel.app'])('pointe vers la démo de prod depuis %s', (hote) => {
    expect(getDemoUrl(hote)).toBe('https://demo.samakan.fr')
  })

  it.each(['test.samakan.fr', 'localhost', '100.107.87.80', 'demo.samakan.fr'])(
    'pointe vers la démo de recette depuis %s',
    (hote) => {
      expect(getDemoUrl(hote)).toBe('https://demo-test.samakan.fr')
    },
  )

  it("lit l'hôte courant par défaut", () => {
    vi.stubGlobal('window', { location: { hostname: 'www.samakan.fr' } })
    expect(getDemoUrl()).toBe('https://demo.samakan.fr')
    vi.stubGlobal('window', { location: { hostname: 'test.samakan.fr' } })
    expect(getDemoUrl()).toBe('https://demo-test.samakan.fr')
  })
})
