import { describe, expect, it } from 'vitest'
import { classerRejet } from '../../supabase/functions/_shared/brevoRejets'

// Raisons réelles relevées dans l'API statistiques Brevo (staging).
const EXPEDITEUR_NON_VALIDE = 'Sending has been rejected because the sender you used contact@samakan.fr is not valid. Validate your sender or authenticate your domain'
const MX_INTROUVABLE = 'Unable to find MX of domain exemple.fr'

describe('classerRejet', () => {
  it('ne marque jamais sur une erreur d’expéditeur (cas réel du 21/10)', () => {
    expect(classerRejet('error', EXPEDITEUR_NON_VALIDE)).toEqual({ marquer: false, motif: 'cote_expediteur' })
    for (const raison of [
      'Your account is suspended',
      'Account has been deactivated',
      'Not enough credits to send the email',
      'Sending limit exceeded for today',
      'Your Brevo account is under validation',
    ]) {
      expect(classerRejet('blocked', raison), raison).toEqual({ marquer: false, motif: 'cote_expediteur' })
    }
  })

  it('marque les rejets destinataire qui parlent de compte ou de quota (raisons fréquentes chez Wat)', () => {
    for (const raison of [
      '550-5.1.1 The email account that you tried to reach does not exist',
      '552 5.2.2 The email account that you tried to reach is over quota',
      'Recipient account disabled',
    ]) {
      for (const evenement of ['error', 'blocked']) {
        expect(classerRejet(evenement, raison), `${evenement} : ${raison}`).toMatchObject({ marquer: true })
      }
    }
  })

  it('marque une erreur propre au destinataire, avec sa raison', () => {
    expect(classerRejet('error', MX_INTROUVABLE)).toEqual({ marquer: true, evenement: 'error', raison: MX_INTROUVABLE })
    expect(classerRejet('blocked', null)).toEqual({ marquer: true, evenement: 'blocked', raison: null })
  })

  it('marque toujours les rejets définitifs, quel que soit le nom de l’événement', () => {
    expect(classerRejet('hardBounce', '550 5.1.1 User unknown')).toEqual({ marquer: true, evenement: 'hard_bounce', raison: '550 5.1.1 User unknown' })
    expect(classerRejet('hard_bounce', '')).toEqual({ marquer: true, evenement: 'hard_bounce', raison: null })
    expect(classerRejet('invalid', undefined)).toEqual({ marquer: true, evenement: 'invalid_email', raison: null })
    expect(classerRejet('invalid_email', 'x')).toMatchObject({ marquer: true, evenement: 'invalid_email' })
  })

  it('ignore les autres événements', () => {
    for (const e of ['delivered', 'softBounce', 'soft_bounce', 'opened', undefined, 42]) {
      expect(classerRejet(e, MX_INTROUVABLE)).toEqual({ marquer: false, motif: 'evenement_non_concerne' })
    }
  })

  it('tronque une raison très longue', () => {
    const r = classerRejet('error', 'x'.repeat(800))
    expect(r.marquer && r.raison?.length).toBe(500)
  })
})
