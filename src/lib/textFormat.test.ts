import { describe, expect, it } from 'vitest'
import { sanitizePhone } from './textFormat'

describe('sanitizePhone', () => {
  it('garde chiffres et espaces', () => {
    expect(sanitizePhone('06 12 34 56 78')).toBe('06 12 34 56 78')
  })

  it('garde un seul « + » en tête pour un numéro international', () => {
    expect(sanitizePhone('+856 20 55 12 34')).toBe('+856 20 55 12 34')
    expect(sanitizePhone('++66 81')).toBe('+66 81')
  })

  it('retire les autres caractères, y compris un « + » ailleurs qu’en tête', () => {
    expect(sanitizePhone('06.12-34/56a78')).toBe('0612345678')
    expect(sanitizePhone('06 12+34')).toBe('06 1234')
  })
})
