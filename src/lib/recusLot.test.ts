import { describe, expect, it } from 'vitest'
import {
  estimerDureeEnvoi, estimerDureeLot, estimerTempsRestant, formatDureeApprox, formatDureeEnvoi, formatTempsRestant, lotActif,
  lotTraites, messageErreurLot, messageLancementLot, rythmeEnvoi,
} from './recusLot'

const lancement = '2026-11-04T10:00:00.000Z'
const t0 = new Date(lancement).getTime()
const lot = { statut: 'en_cours' as const, cree_le: lancement, nb_total: 100, nb_faits: 0, nb_echecs: 0 }

describe('estimerTempsRestant', () => {
  it('null tant qu’aucun reçu n’est traité', () => {
    expect(estimerTempsRestant(lot, t0 + 60_000)).toBeNull()
  })

  it('extrapole le rythme moyen depuis le lancement (échecs compris)', () => {
    // 25 traités en 2 min → 75 restants en 6 min
    expect(estimerTempsRestant({ ...lot, nb_faits: 20, nb_echecs: 5 }, t0 + 120_000)).toBe(360_000)
  })

  it('0 quand tout est traité, null quand le lot n’est plus en cours', () => {
    expect(estimerTempsRestant({ ...lot, nb_faits: 100 }, t0 + 60_000)).toBe(0)
    expect(estimerTempsRestant({ ...lot, statut: 'termine', nb_faits: 50 }, t0 + 60_000)).toBeNull()
  })
})

describe('formatDureeApprox', () => {
  it('arrondit à la minute', () => {
    expect(formatDureeApprox(20_000)).toBe("moins d'une minute")
    expect(formatDureeApprox(12 * 60_000)).toBe('environ 12 min')
    expect(formatDureeApprox(65 * 60_000)).toBe('environ 1 h 05')
  })
})

describe('lotTraites / messageErreurLot', () => {
  it('compte générés et échecs', () => {
    expect(lotTraites({ nb_faits: 3, nb_echecs: 2 })).toBe(5)
  })

  it('traduit les codes des RPC', () => {
    expect(messageErreurLot('LOT_DEJA_EN_COURS')).toBe('Un lot est déjà en cours pour cette année.')
    expect(messageErreurLot('AUCUN_RECU_MANQUANT')).toContain('Aucun reçu manquant')
    expect(messageErreurLot('ENVOI_EN_COURS')).toContain('réessayez dans quelques minutes')
    expect(messageErreurLot('GENERATION_EN_COURS')).toContain('génération')
    expect(messageErreurLot('BREVO_REQUIS')).toBe('Configurez Brevo dans Paramètres › Intégrations pour envoyer les reçus en lot.')
    expect(messageErreurLot('LOT_INTROUVABLE')).toBe('Ce lot est introuvable : rechargez la page.')
    // Code inconnu ou absent : message générique, jamais le code brut.
    expect(messageErreurLot('boom')).toBe('Une erreur est survenue. Réessayez ou rechargez la page.')
    expect(messageErreurLot(null)).toBe('Une erreur est survenue. Réessayez ou rechargez la page.')
  })
})

describe('messageLancementLot', () => {
  it('utilise le nombre de reçus retenu par le serveur', () => {
    expect(messageLancementLot('generation', 1)).toBe('Génération de 1 reçu lancée')
    expect(messageLancementLot('generation', 1234)).toBe('Génération de 1\u202f234 reçus lancée')
    expect(messageLancementLot('envoi', 3)).toBe('Envoi de 3 reçus lancé')
  })
  it('sans nombre connu, message sans compte', () => {
    expect(messageLancementLot('generation', null)).toBe('Génération des reçus lancée')
    expect(messageLancementLot('envoi', null)).toBe('Envoi des reçus lancé')
  })
})

describe('estimerDureeLot', () => {
  it('compte 25 reçus par minute plus le premier passage', () => {
    expect(estimerDureeLot(1)).toBe(2 * 60_000)
    expect(estimerDureeLot(1000)).toBe(41 * 60_000)
  })
})

describe('formatTempsRestant', () => {
  it('accorde selon la durée affichée', () => {
    expect(formatTempsRestant(20_000)).toBe("moins d'une minute restante")
    expect(formatTempsRestant(70_000)).toBe('environ 1 min restante')
    expect(formatTempsRestant(100_000)).toBe('environ 2 min restantes')
  })
})

describe('lotActif', () => {
  const now = new Date('2026-11-04T10:00:00Z').getTime()
  it('en cours, ou arrêté tant que le bail d’exécution court', () => {
    expect(lotActif({ statut: 'en_cours', traitement_jusqu_a: null }, now)).toBe(true)
    expect(lotActif({ statut: 'arrete', traitement_jusqu_a: '2026-11-04T10:01:00Z' }, now)).toBe(true)
    expect(lotActif({ statut: 'arrete', traitement_jusqu_a: '2026-11-04T09:59:00Z' }, now)).toBe(false)
    expect(lotActif({ statut: 'arrete', traitement_jusqu_a: null }, now)).toBe(false)
    expect(lotActif({ statut: 'termine', traitement_jusqu_a: null }, now)).toBe(false)
  })
})

describe('lots d’envoi', () => {
  it('rythmeEnvoi : valeurs stockées valides, sinon défauts', () => {
    expect(rythmeEnvoi(null)).toEqual({ parJour: 250, parMinute: 5 })
    expect(rythmeEnvoi({ envoi_lot_par_jour: 300, envoi_lot_par_minute: 10 })).toEqual({ parJour: 300, parMinute: 10 })
    expect(rythmeEnvoi({ envoi_lot_par_jour: 0, envoi_lot_par_minute: 61 })).toEqual({ parJour: 250, parMinute: 5 })
    expect(rythmeEnvoi({ envoi_lot_par_jour: '300', envoi_lot_par_minute: 2.5 })).toEqual({ parJour: 250, parMinute: 5 })
  })

  it('estimerDureeEnvoi : dans le quota du jour, à la minute ; au-delà, par tranches de 24 h', () => {
    const rythme = { parJour: 250, parMinute: 5 }
    expect(estimerDureeEnvoi(0, rythme)).toBe(0)
    // 12 emails à 5 par minute : 3 passages + le premier dans la minute
    expect(estimerDureeEnvoi(12, rythme)).toBe(4 * 60_000)
    // 1 000 emails à 250 par jour : 3 jours d'attente puis 50 min
    expect(estimerDureeEnvoi(1000, rythme)).toBe((3 * 24 * 60 + 50 + 1) * 60_000)
    expect(formatDureeEnvoi(estimerDureeEnvoi(1000, rythme))).toBe('environ 4 jours')
    // Quota déjà entamé : 240 envoyés ces dernières 24 h, 20 à envoyer → 10 aujourd'hui, 10 demain
    expect(estimerDureeEnvoi(20, rythme, 240)).toBe((24 * 60 + 2 + 1) * 60_000)
  })

  it('formatDureeEnvoi : minutes, heures puis jours', () => {
    expect(formatDureeEnvoi(12 * 60_000)).toBe('environ 12 min')
    expect(formatDureeEnvoi(25 * 3_600_000)).toBe('environ 2 jours')
  })

  it('lotTraites compte les envois à vérifier', () => {
    expect(lotTraites({ nb_faits: 3, nb_echecs: 1, nb_a_verifier: 2 })).toBe(6)
  })

  it('messageErreurLot : codes de l’envoi', () => {
    expect(messageErreurLot('AUCUN_RECU_A_ENVOYER')).toBe('Aucun reçu à envoyer pour cette année.')
    expect(messageErreurLot('GENERATION_EN_COURS')).toContain('génération')
  })
})
