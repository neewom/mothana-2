import { describe, expect, it } from 'vitest'
import { comparerOrdreAttribution, raisonExclusion, recusAGenerer, recusExclus } from './recusAGenerer'

const ok = { blocking: false, missing: [] }

describe('recusAGenerer', () => {
  it('ne garde que les reçus pas encore générés, dans l’ordre des lignes', () => {
    const rows = [
      { id: 'a', recu: null, validation: ok },
      { id: 'b', recu: { id: 'r1' }, validation: ok },
      { id: 'c', recu: null, validation: ok },
    ]
    expect(recusAGenerer(rows, false).map((r) => r.id)).toEqual(['a', 'c'])
  })

  it('écarte les fiches bloquées ou incomplètes', () => {
    const rows = [
      { id: 'a', recu: null, validation: { blocking: true, missing: [] } },
      { id: 'b', recu: null, validation: { blocking: false, missing: ['adresse'] } },
      { id: 'c', recu: null, validation: ok },
    ]
    expect(recusAGenerer(rows, false).map((r) => r.id)).toEqual(['c'])
  })

  it('ne génère rien si l’organisation est incomplète', () => {
    expect(recusAGenerer([{ recu: null, validation: ok }], true)).toEqual([])
  })

  it('renvoie une liste vide quand tous les reçus sont déjà générés', () => {
    expect(recusAGenerer([{ recu: { id: 'r1' }, validation: ok }], false)).toEqual([])
  })
})

describe('recusExclus', () => {
  const rows = [
    { id: 'a', recu: null, validation: { blocking: true, missing: [], message: 'Civilité du donateur manquante' } },
    { id: 'b', recu: null, validation: { blocking: false, missing: ['adresse'] } },
    { id: 'c', recu: null, validation: ok },
    { id: 'd', recu: { id: 'r1' }, validation: { blocking: false, missing: ['ville'] } },
  ]

  it('liste les fiches incomplètes sans reçu, complément exact de recusAGenerer', () => {
    expect(recusExclus(rows, false).map((r) => r.id)).toEqual(['a', 'b'])
    const sansRecu = rows.filter((r) => !r.recu).map((r) => r.id)
    const partition = [...recusAGenerer(rows, false), ...recusExclus(rows, false)].map((r) => r.id).sort()
    expect(partition).toEqual(sansRecu)
  })

  it('ne liste rien si l’organisation est incomplète', () => {
    expect(recusExclus(rows, true)).toEqual([])
  })
})

describe('raisonExclusion', () => {
  it('reprend le message de blocage, sinon les champs manquants', () => {
    expect(raisonExclusion({ blocking: true, missing: [], message: 'Don au nom d’une famille' })).toBe('Don au nom d’une famille')
    expect(raisonExclusion({ blocking: false, missing: ['adresse', 'ville'] })).toBe('Champs manquants : adresse, ville.')
    expect(raisonExclusion(ok)).toBe('')
  })
})

// Liste de référence partagée avec supabase/tests/recus_lots.sql (recus_manquants_lot, collation
// fr-x-icu) : les deux tests doivent garder les mêmes entrées et le même ordre attendu.
const FIXTURE_ORDRE: [string, string | null][] = [
  ['Éric', 'Jean'], ['eric', 'Anne'], ['Martin', null], ['MARTIN', 'Paul'], ['martin', 'Luc'],
  ['Le Gall', 'Yann'], ['Le-Gall', 'Yann'], ['Legall', 'Yann'], ['Müller', 'Hans'], ['Muller', 'Hans'],
  ["N'Diaye", 'Awa'], ['Ndiaye', 'Awa'], ['de la Tour', 'Marie'], ['Delatour', 'Marie'], ['Œuvre', null],
  ['Oeuvre', null], ['Zoé', 'Zoé'], ['Zoe', 'Zoe'], ['Durand', 'Émile'], ['Durand', 'Emile'],
  ['Dupont', 'Jean'], ['Dupont', 'Jean'],
]
const ORDRE_ATTENDU = [
  'de la Tour/Marie', 'Delatour/Marie', 'Dupont/Jean#01', 'Dupont/Jean#09', 'Durand/Emile', 'Durand/Émile',
  'eric/Anne', 'Éric/Jean', 'Le Gall/Yann', 'Le-Gall/Yann', 'Legall/Yann', 'martin/Luc', 'Martin/',
  'MARTIN/Paul', 'Muller/Hans', 'Müller/Hans', "N'Diaye/Awa", 'Ndiaye/Awa', 'Oeuvre/', 'Œuvre/',
  'Zoe/Zoe', 'Zoé/Zoé',
]

describe('comparerOrdreAttribution', () => {
  it('trie par nom puis prénom (comparaison française), puis identifiant du profil', () => {
    const lignes = FIXTURE_ORDRE.map(([nom, prenom], i) => ({
      // Les deux « Dupont Jean » ne diffèrent que par l'identifiant (le 21e reçoit le plus grand).
      profil: { id: `00000000-0000-4000-8000-0000000000${i === 20 ? '09' : i === 21 ? '01' : String(i + 10)}`, personnes: { nom, prenom } },
    }))
    const libelle = (l: (typeof lignes)[number]) =>
      `${l.profil.personnes.nom}/${l.profil.personnes.prenom ?? ''}` +
      (l.profil.personnes.nom === 'Dupont' ? `#${l.profil.id.slice(-2)}` : '')
    expect([...lignes].sort(comparerOrdreAttribution).map(libelle)).toEqual(ORDRE_ATTENDU)
    expect([...lignes].reverse().sort(comparerOrdreAttribution).map(libelle)).toEqual(ORDRE_ATTENDU)
  })
})
