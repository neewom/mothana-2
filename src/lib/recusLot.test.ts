import { describe, expect, it } from 'vitest'
import { estimerDureeLot, estimerTempsRestant, formatDureeApprox, formatTempsRestant, lotActif, lotTraites, messageErreurLot, messageLancementLot } from './recusLot'

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
    expect(messageErreurLot('LOT_INTROUVABLE')).toBe('Ce lot est introuvable : rechargez la page.')
    // Code inconnu ou absent : message générique, jamais le code brut.
    expect(messageErreurLot('boom')).toBe('Une erreur est survenue. Réessayez ou rechargez la page.')
    expect(messageErreurLot(null)).toBe('Une erreur est survenue. Réessayez ou rechargez la page.')
  })
})

describe('messageLancementLot', () => {
  it('utilise le nombre de reçus retenu par le serveur', () => {
    expect(messageLancementLot(1)).toBe('Génération de 1 reçu lancée')
    expect(messageLancementLot(1234)).toBe('Génération de 1\u202f234 reçus lancée')
  })
  it('sans nombre connu, message sans compte', () => {
    expect(messageLancementLot(null)).toBe('Génération des reçus lancée')
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
