import { describe, expect, it } from 'vitest'
import { classerRejet, estDomaineIntrouvable, evenementDepuisStatistiques, normaliserEmail } from '../../supabase/functions/_shared/brevoRejets'

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

  it('marque un soft bounce seulement si le domaine est introuvable (raison réelle Brevo)', () => {
    for (const e of ['softBounce', 'soft_bounce']) {
      expect(classerRejet(e, MX_INTROUVABLE)).toEqual({ marquer: true, evenement: 'soft_bounce', raison: MX_INTROUVABLE })
      expect(classerRejet(e, 'Unable to find MX of domain hotmail.co')).toMatchObject({ marquer: true })
    }
  })

  it('ne marque pas un soft bounce dû au domaine de l’expéditeur, marque celui du destinataire', () => {
    expect(classerRejet('softBounce', '450 4.1.8 <comite@watbussy.fr>: Sender address rejected: Domain not found'))
      .toEqual({ marquer: false, motif: 'cote_expediteur' })
    expect(classerRejet('soft_bounce', EXPEDITEUR_NON_VALIDE)).toEqual({ marquer: false, motif: 'cote_expediteur' })
    expect(classerRejet('softBounce', '450 4.1.2 <a@hotmail.co>: Recipient address rejected: Domain not found'))
      .toMatchObject({ marquer: true, evenement: 'soft_bounce' })
  })

  it('ignore les soft bounces temporaires (boîte pleine, serveur indisponible, sans raison)', () => {
    for (const raison of [
      '452 4.2.2 The email account that you tried to reach is over quota',
      'Mailbox full',
      '421 4.7.0 Try again later, closing connection',
      'Connection timed out',
      '',
      null,
    ]) {
      expect(classerRejet('softBounce', raison), String(raison)).toEqual({ marquer: false, motif: 'rejet_temporaire' })
    }
  })

  it('ignore les autres événements', () => {
    for (const e of ['delivered', 'softBounces', 'hardBounces', 'opened', undefined, 42]) {
      expect(classerRejet(e, MX_INTROUVABLE)).toEqual({ marquer: false, motif: 'evenement_non_concerne' })
    }
  })

  it('tronque une raison très longue', () => {
    const r = classerRejet('error', 'x'.repeat(800))
    expect(r.marquer && r.raison?.length).toBe(500)
  })
})

describe('estDomaineIntrouvable', () => {
  it('reconnaît les raisons « domaine introuvable »', () => {
    expect(estDomaineIntrouvable(MX_INTROUVABLE)).toBe(true)
    expect(estDomaineIntrouvable('550 NXDOMAIN')).toBe(true)
    expect(estDomaineIntrouvable('Mailbox full')).toBe(false)
    expect(estDomaineIntrouvable(null)).toBe(false)
  })
})

describe('evenementDepuisStatistiques', () => {
  it('traduit les noms de l’API statistiques vers ceux du webhook (constaté sur staging)', () => {
    expect(evenementDepuisStatistiques('softBounces')).toBe('softBounce')
    expect(evenementDepuisStatistiques('hardBounces')).toBe('hardBounce')
    expect(evenementDepuisStatistiques('error')).toBe('error')
    expect(evenementDepuisStatistiques('delivered')).toBeNull()
    expect(classerRejet(evenementDepuisStatistiques('softBounces'), MX_INTROUVABLE)).toMatchObject({ marquer: true, evenement: 'soft_bounce' })
  })
})

describe('normaliserEmail', () => {
  it('ignore la casse et les espaces de bord (repli par adresse du webhook)', () => {
    expect(normaliserEmail('  Lea.Martin@Example.ORG \n')).toBe('lea.martin@example.org')
    expect(normaliserEmail('\tLEA.MARTIN@example.org')).toBe(normaliserEmail('lea.martin@EXAMPLE.org '))
  })
})
