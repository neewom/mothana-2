import { describe, expect, it } from 'vitest'
import {
  paymentDecisionReasonMessage,
  paymentRequestRevision,
  sellerPaymentTopic,
  timestampRevision,
} from './couponPaymentRealtime'

describe('coupon payment realtime helpers', () => {
  it('derives the seller topic from the payment request only', () => {
    expect(sellerPaymentTopic('6a160aec-fd08-4b6f-a420-169de9f38934'))
      .toBe('coupon-payment:6a160aec-fd08-4b6f-a420-169de9f38934')
  })

  it('keeps timestamp microseconds in a monotonic numeric revision', () => {
    expect(timestampRevision('2026-09-30T12:34:56.123456Z'))
      .toBe(1790771696123456)
    expect(timestampRevision('2026-09-30T12:34:56.123457Z'))
      .toBeGreaterThan(timestampRevision('2026-09-30T12:34:56.123456Z'))
  })

  it('advances the revision when a still-pending row expires locally', () => {
    const updatedAt = '2026-09-30T12:00:00.000001Z'
    const expiresAt = '2026-09-30T12:01:30.000001Z'

    expect(paymentRequestRevision(updatedAt, expiresAt, 'en_attente', Date.parse('2026-09-30T12:01:29Z')))
      .toBe(timestampRevision(updatedAt))
    expect(paymentRequestRevision(updatedAt, expiresAt, 'en_attente', Date.parse('2026-09-30T12:01:31Z')))
      .toBe(timestampRevision(expiresAt))
  })

  it('maps decision failures without exposing internal data', () => {
    expect(paymentDecisionReasonMessage('SOLDE_INSUFFISANT'))
      .toBe('Le solde disponible ne permet plus ce paiement.')
    expect(paymentDecisionReasonMessage('UNKNOWN'))
      .toBe('La décision n’a pas pu être enregistrée. Réessayez.')
  })
})
