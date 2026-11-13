import { readFileSync, statSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { formatMegabytes, summarizeDownload } from './engineDownload'

describe('summarizeDownload', () => {
  it('ne donne pas de mégaoctets tant que les en-têtes ne sont pas tous reçus', () => {
    const p = summarizeDownload([
      { decodedTotal: 100, decodedLoaded: 50, transferTotal: 40 },
      { decodedTotal: 100, decodedLoaded: 0, transferTotal: undefined },
    ])
    expect(p.fraction).toBe(0.25)
    expect(p.loadedBytes).toBeNull()
    expect(p.totalBytes).toBeNull()
  })

  it('convertit l’avancement décompressé en octets transférés (fichiers compressés)', () => {
    const p = summarizeDownload([
      { decodedTotal: 9_000_000, decodedLoaded: 4_500_000, transferTotal: 2_400_000 },
      { decodedTotal: 6_000_000, decodedLoaded: 6_000_000, transferTotal: 1_000_000 },
    ])
    expect(p.fraction).toBeCloseTo(0.7)
    expect(p.loadedBytes).toBe(2_200_000)
    expect(p.totalBytes).toBe(3_400_000)
  })

  it('reste sans mégaoctets si un fichier compressé arrive sans Content-Length', () => {
    const p = summarizeDownload([{ decodedTotal: 100, decodedLoaded: 100, transferTotal: null }])
    expect(p.fraction).toBe(1)
    expect(p.totalBytes).toBeNull()
  })

  it('plafonne un fichier plus long que prévu', () => {
    const p = summarizeDownload([{ decodedTotal: 100, decodedLoaded: 150, transferTotal: 100 }])
    expect(p.fraction).toBe(1)
    expect(p.loadedBytes).toBe(100)
  })
})

describe('formatMegabytes', () => {
  it('écrit les mégaoctets à la française, une décimale', () => {
    expect(formatMegabytes(3_400_000)).toBe('3,4')
    expect(formatMegabytes(0)).toBe('0,0')
  })
})

describe('ENGINE_FILES', () => {
  it('a les tailles des fichiers de la version installée de PGlite', () => {
    // engineFiles.ts importe les fichiers en ?url (Vite) : on lit ici ses constantes seules.
    const source = readFileSync(new URL('./engineFiles.ts', import.meta.url), 'utf8')
    const entries = [...source.matchAll(/bytes: (\d+), source: '([^']+)'/g)]
    expect(entries).toHaveLength(3)
    for (const [, bytes, file] of entries) {
      expect(statSync(new URL(`../../node_modules/${file}`, import.meta.url)).size, file).toBe(Number(bytes))
    }
  })
})
