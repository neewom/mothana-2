import { describe, expect, it } from 'vitest'
import { classifyMailingRecipients, MAILING_EMAIL_REGEX } from './mailingRecipients'

interface Contact {
  id: string
  courriel: string | null
  mailing_opt_out: boolean
}

function contact(id: string, courriel: string | null, mailingOptOut = false): Contact {
  return { id, courriel, mailing_opt_out: mailingOptOut }
}

describe('mailing recipients', () => {
  it('utilise la règle de validation appliquée avant envoi', () => {
    expect(MAILING_EMAIL_REGEX.test('membre@example.org')).toBe(true)
    expect(MAILING_EMAIL_REGEX.test('adresse-invalide')).toBe(false)
  })

  it('sépare les emails manquants des emails invalides', () => {
    const groups = classifyMailingRecipients([
      contact('null', null),
      contact('blank', '   '),
      contact('invalid', 'adresse-invalide'),
      contact('valid', ' membre@example.org '),
    ])

    expect(groups.missingEmail.map(({ id }) => id)).toEqual(['null', 'blank'])
    expect(groups.invalidEmail.map(({ id }) => id)).toEqual(['invalid'])
    expect(groups.deliverable.map(({ id }) => id)).toEqual(['valid'])
  })

  it('classe toujours un opt-out parmi les contacts refusés', () => {
    const groups = classifyMailingRecipients([
      contact('valid-opt-out', 'membre@example.org', true),
      contact('missing-opt-out', null, true),
      contact('invalid-opt-out', 'adresse-invalide', true),
    ])

    expect(groups.optedOut.map(({ id }) => id)).toEqual([
      'valid-opt-out',
      'missing-opt-out',
      'invalid-opt-out',
    ])
    expect(groups.deliverable).toHaveLength(0)
    expect(groups.missingEmail).toHaveLength(0)
    expect(groups.invalidEmail).toHaveLength(0)
  })

  it('place chaque contact dans une seule catégorie', () => {
    const contacts = [
      contact('valid', 'membre@example.org'),
      contact('missing', null),
      contact('invalid', 'adresse-invalide'),
      contact('opt-out', 'refus@example.org', true),
    ]
    const groups = classifyMailingRecipients(contacts)

    const classifiedIds = Object.values(groups).flat().map(({ id }) => id)
    expect(classifiedIds).toHaveLength(contacts.length)
    expect(new Set(classifiedIds).size).toBe(contacts.length)
  })
})
