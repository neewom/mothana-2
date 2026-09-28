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

  it('ignore les caractères invisibles ajoutés lors de la copie du lien', () => {
    const secret = 'a'.repeat(64)
    const copiedSecret = `${secret.slice(0, 20)}\u200B${secret.slice(20, 44)}\u2060${secret.slice(44)}`
    expect(extractPortefeuilleSecret(`#${encodeURIComponent(copiedSecret)}`)).toBe(secret)
  })

  it('calcule le SHA-256 envoyé au backend', async () => {
    await expect(hashPortefeuilleSecret('abc')).resolves.toBe(
      'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
    )
  })

  it('calcule le SHA-256 sans dépendre de Web Crypto', async () => {
    const originalCrypto = globalThis.crypto
    Object.defineProperty(globalThis, 'crypto', { configurable: true, value: undefined })

    try {
      await expect(hashPortefeuilleSecret('abc')).resolves.toBe(
        'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
      )
    } finally {
      Object.defineProperty(globalThis, 'crypto', { configurable: true, value: originalCrypto })
    }
  })

  it('formate les montants et les types de mouvement', () => {
    expect(formatCentimes(1234)).toContain('12,34')
    expect(libelleMouvement('credit_initial')).toBe('Crédit initial')
    expect(libelleMouvement('credit_recharge')).toBe('Recharge')
    expect(libelleMouvement('debit')).toBe('Paiement')
  })
})
