import { describe, expect, it } from 'vitest'
import { fitStrokes } from './signatureStrokes'

describe('fitStrokes', () => {
  it('renvoie null sans point', () => {
    expect(fitStrokes([], 500, 160)).toBeNull()
    expect(fitStrokes([[]], 500, 160)).toBeNull()
  })

  it('réduit un grand tracé pour qu’il tienne dans la zone, centré', () => {
    const t = fitStrokes([[{ x: 100, y: 100 }, { x: 1100, y: 500 }]], 500, 160, 8)!
    // largeur 1000 → 484 utiles, hauteur 400 → 144 utiles : la hauteur contraint.
    expect(t.scale).toBeCloseTo(144 / 400)
    const map = (x: number, y: number) => [x * t.scale + t.offsetX, y * t.scale + t.offsetY]
    const [x1, y1] = map(100, 100)
    const [x2, y2] = map(1100, 500)
    expect(y1).toBeCloseTo(8)
    expect(y2).toBeCloseTo(152)
    expect((x1 + x2) / 2).toBeCloseTo(250)
    expect(x1).toBeGreaterThanOrEqual(0)
    expect(x2).toBeLessThanOrEqual(500)
  })

  it('n’agrandit pas un petit tracé au-delà de maxScale', () => {
    const t = fitStrokes([[{ x: 0, y: 0 }, { x: 50, y: 20 }]], 500, 160, 8, 1)!
    expect(t.scale).toBe(1)
  })

  it('accepte un point isolé (cadre nul)', () => {
    const t = fitStrokes([[{ x: 10, y: 10 }]], 500, 160)!
    expect(Number.isFinite(t.scale)).toBe(true)
  })
})
