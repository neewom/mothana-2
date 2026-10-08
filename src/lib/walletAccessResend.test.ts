import { describe, expect, it } from 'vitest'
import { walletAccessResendErrorCode, walletAccessResendErrorMessage } from './walletAccessResend'

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

describe('walletAccessResendErrorCode', () => {
  it('relit le code métier dans le corps d’une réponse non-2xx', async () => {
    const error = { context: new Response(JSON.stringify({ error: 'ACCES_INTERDIT' }), { status: 403 }) }

    await expect(walletAccessResendErrorCode(error)).resolves.toBe('ACCES_INTERDIT')
  })

  it('retourne null sans réponse HTTP exploitable', async () => {
    await expect(walletAccessResendErrorCode(new Error('réseau'))).resolves.toBeNull()
    await expect(walletAccessResendErrorCode({ context: new Response('pas du json', { status: 500 }) })).resolves.toBeNull()
    await expect(walletAccessResendErrorCode(null)).resolves.toBeNull()
  })
})
