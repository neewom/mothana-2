import { describe, expect, it } from 'vitest'
import {
  eurosToCentimes,
  isValidWalletCode,
  normalizeWalletCode,
  paymentRequestErrorMessage,
  paymentRequestReasonMessage,
  paymentRequestStatusLabel,
} from './paiementVendeur'

describe('paiement vendeur', () => {
  it('convertit un montant en centimes sans accepter plus de deux décimales', () => {
    expect(eurosToCentimes('12')).toBe(1200)
    expect(eurosToCentimes('12,34')).toBe(1234)
    expect(eurosToCentimes('0.01')).toBe(1)
    expect(eurosToCentimes('12.345')).toBeNull()
    expect(eurosToCentimes('0')).toBeNull()
    expect(eurosToCentimes('abc')).toBeNull()
    expect(eurosToCentimes('21474836.48')).toBeNull()
  })

  it('normalise et valide le code public du portefeuille', () => {
    expect(normalizeWalletCode(' abcd-2345 gh ')).toBe('ABCD2345GH')
    expect(isValidWalletCode('abcd-2345-gh')).toBe(true)
    expect(isValidWalletCode('code trop court')).toBe(false)
    expect(isValidWalletCode('ABCD1234EF')).toBe(false)
  })

  it('mappe les raisons métier en français sans révéler le solde', () => {
    expect(paymentRequestReasonMessage('SOLDE_INSUFFISANT')).toBe('Solde insuffisant pour ce paiement.')
    expect(paymentRequestReasonMessage('AUTRE_EVENEMENT')).toBe('Ce portefeuille appartient à un autre événement.')
    expect(paymentRequestReasonMessage('INCONNUE')).toBe('La demande de paiement n’a pas pu être traitée.')
  })

  it('extrait une raison connue du message RPC et masque les erreurs techniques', () => {
    expect(paymentRequestErrorMessage('PostgresError: ACCES_INTERDIT')).toContain('session bénévole')
    expect(paymentRequestErrorMessage('network failure')).toBe(
      'Le service de paiement est momentanément indisponible. Réessayez.',
    )
  })

  it('libelle chaque statut de demande', () => {
    expect(paymentRequestStatusLabel('en_attente')).toBe('En attente de validation')
    expect(paymentRequestStatusLabel('validee')).toBe('Paiement validé')
    expect(paymentRequestStatusLabel('refusee')).toBe('Paiement refusé')
    expect(paymentRequestStatusLabel('expiree')).toBe('Demande expirée')
    expect(paymentRequestStatusLabel('annulee')).toBe('Demande annulée')
  })
})
