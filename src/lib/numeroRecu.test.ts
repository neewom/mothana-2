import { describe, expect, it } from 'vitest'
import { exempleNumeroRecu, formatNumeroRecu } from './numeroRecu'

describe('formatNumeroRecu', () => {
  it('vaut séquence par défaut', () => {
    expect(formatNumeroRecu(undefined)).toBe('sequence')
    expect(formatNumeroRecu('autre')).toBe('sequence')
    expect(formatNumeroRecu('donateur')).toBe('donateur')
  })
})

describe('exempleNumeroRecu', () => {
  it('séquence : même forme que next_numero_recu (3 chiffres minimum)', () => {
    expect(exempleNumeroRecu('sequence', 2026)).toBe('2026-001')
    expect(exempleNumeroRecu('sequence', 2026, { numeroDepart: 42 })).toBe('2026-042')
    expect(exempleNumeroRecu('sequence', 2026, { numeroDepart: 1500 })).toBe('2026-1500')
    expect(exempleNumeroRecu('sequence', 2026, { numeroDepart: 0 })).toBe('2026-001')
  })

  it('donateur : année + numéro de donateur tel quel', () => {
    expect(exempleNumeroRecu('donateur', 2026)).toBe('2026-2803')
    expect(exempleNumeroRecu('donateur', 2026, { numeroDonateur: '446' })).toBe('2026-446')
  })
})
