import { describe, expect, it } from 'vitest'
import { walletAccessResendErrorMessage } from './walletAccessResend'

describe('walletAccessResendErrorMessage', () => {
  it('explique une collision sans proposer de fusion', () => {
    const message = walletAccessResendErrorMessage('EMAIL_DEJA_UTILISE')

    expect(message).toContain('déjà un autre portefeuille')
    expect(message).toContain('ne peuvent pas être fusionnés')
  })

  it('préserve le lien comme solution de repli si Resend échoue', () => {
    expect(walletAccessResendErrorMessage('EMAIL_NON_ENVOYE')).toContain('copiez-le')
  })

  it('ne révèle aucun détail serveur pour une erreur inconnue', () => {
    expect(walletAccessResendErrorMessage('INCONNUE')).toBe(
      'Le nouvel accès n’a pas pu être créé. Réessayez dans un instant.',
    )
  })
})
