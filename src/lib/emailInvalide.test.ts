import { describe, expect, it } from 'vitest'
import { libelleRejetEmail } from './emailInvalide'

describe('libelleRejetEmail', () => {
  it('donne un libellé lisible selon l’événement et la raison', () => {
    expect(libelleRejetEmail('hard_bounce', '550 5.1.1 User unknown')).toBe('Adresse inexistante (rejet définitif)')
    expect(libelleRejetEmail('error', 'Unable to find MX of domain exemple.fr')).toBe('Domaine introuvable')
    expect(libelleRejetEmail('blocked', null)).toBe('Adresse bloquée par Brevo après des rejets')
    expect(libelleRejetEmail('error', 'Mailbox full')).toBe('Mailbox full')
  })

  it('renvoie null pour un ancien marquage sans événement ni raison', () => {
    expect(libelleRejetEmail(null, null)).toBeNull()
  })
})
