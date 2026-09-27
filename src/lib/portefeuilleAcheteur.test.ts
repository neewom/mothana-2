import { describe, expect, it } from 'vitest'
import {
  extractPortefeuilleSecret,
  formatCentimes,
  hashPortefeuilleSecret,
  libelleMouvement,
} from './portefeuilleAcheteur'

describe('portefeuille acheteur', () => {
  it('extrait un secret valide du fragment sans accepter une valeur trop courte', () => {
    const secret = 'a'.repeat(64)
    expect(extractPortefeuilleSecret(`#${secret}`)).toBe(secret)
    expect(extractPortefeuilleSecret('#trop-court')).toBeNull()
    expect(extractPortefeuilleSecret('')).toBeNull()
  })

  it('décode un fragment encodé', () => {
    const secret = `${'a'.repeat(32)}+suffixe`
    expect(extractPortefeuilleSecret(`#${encodeURIComponent(secret)}`)).toBe(secret)
  })

  it('calcule le SHA-256 envoyé au backend', async () => {
    await expect(hashPortefeuilleSecret('abc')).resolves.toBe(
      'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
    )
  })

  it('formate les montants et les types de mouvement', () => {
    expect(formatCentimes(1234)).toContain('12,34')
    expect(libelleMouvement('credit_initial')).toBe('Crédit initial')
    expect(libelleMouvement('credit_recharge')).toBe('Recharge')
    expect(libelleMouvement('debit')).toBe('Paiement')
  })
})
