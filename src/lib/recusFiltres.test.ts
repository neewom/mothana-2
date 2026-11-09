import { describe, expect, it } from 'vitest'
import {
  RECUS_FILTRES_VIDES, envoiVersionActuelle, filtrerRecus, nombreFiltresRecus, statutEnvoi, statutGeneration,
} from './recusFiltres'
import { recusAGenerer, recusExclus } from './recusAGenerer'

const ok = { blocking: false, missing: [] }
const famille = { blocking: true, missing: [], message: "Les dons enregistrés au nom d'une famille…" }
const incomplete = { blocking: true, missing: ['adresse'] }

const genere = { date_generation: '2026-03-01T10:00:00Z', email_envoye_at: null }
const envoye = { date_generation: '2026-03-01T10:00:00Z', email_envoye_at: '2026-03-02T08:00:00Z' }
// Régénéré après l'envoi : la date d'envoi reste, mais elle portait la version précédente.
const regenereApresEnvoi = { date_generation: '2026-03-05T10:00:00Z', email_envoye_at: '2026-03-02T08:00:00Z' }

const avecEmail = { personnes: { email: 'a@exemple.fr' } }
const sansEmail = { personnes: { email: null } }

const rows = [
  { id: 'a', recu: null, validation: ok, profil: avecEmail },
  { id: 'b', recu: null, validation: incomplete, profil: sansEmail },
  { id: 'c', recu: null, validation: famille, profil: avecEmail },
  { id: 'd', recu: genere, validation: ok, profil: avecEmail },
  { id: 'e', recu: envoye, validation: ok, profil: avecEmail },
  { id: 'f', recu: regenereApresEnvoi, validation: ok, profil: avecEmail },
  { id: 'g', recu: envoye, validation: incomplete, profil: avecEmail },
  { id: 'h', recu: genere, validation: ok, profil: { personnes: { email: '  ' } } },
]

describe('statutGeneration', () => {
  it('classe chaque ligne dans une seule des trois classes', () => {
    expect(rows.map(statutGeneration)).toEqual([
      'non_genere', 'a_completer', 'a_completer', 'genere', 'genere', 'genere', 'genere', 'genere',
    ])
  })

  it('recoupe les règles du lot de génération (prêts à générer / exclus)', () => {
    const nonGeneres = rows.filter((r) => statutGeneration(r) === 'non_genere').map((r) => r.id)
    const aCompleter = rows.filter((r) => statutGeneration(r) === 'a_completer').map((r) => r.id)
    expect(nonGeneres).toEqual(recusAGenerer(rows, false).map((r) => r.id))
    expect(aCompleter).toEqual(recusExclus(rows, false).map((r) => r.id))
  })
})

describe('statutEnvoi', () => {
  it('ne vaut rien sans reçu', () => {
    expect(statutEnvoi(null, 'a@exemple.fr')).toBeNull()
  })

  it('distingue envoyé et non envoyé', () => {
    expect(statutEnvoi(genere, 'a@exemple.fr')).toBe('non_envoye')
    expect(statutEnvoi(envoye, 'a@exemple.fr')).toBe('envoye')
    expect(envoiVersionActuelle(envoye)).toBe(envoye.email_envoye_at)
  })

  it('tient pour non envoyée une version régénérée après le dernier envoi', () => {
    expect(statutEnvoi(regenereApresEnvoi, 'a@exemple.fr')).toBe('non_envoye')
    expect(envoiVersionActuelle(regenereApresEnvoi)).toBeNull()
  })
})

describe('statutEnvoi sans adresse', () => {
  it('classe à part un reçu non envoyé sans adresse email (vide ou blanche)', () => {
    expect(statutEnvoi(genere, null)).toBe('sans_email')
    expect(statutEnvoi(genere, ' ')).toBe('sans_email')
  })

  it('garde « envoyé » même si l’adresse a été retirée depuis', () => {
    expect(statutEnvoi(envoye, null)).toBe('envoye')
  })
})

describe('filtrerRecus', () => {
  const ids = (f: Parameters<typeof filtrerRecus>[1]) => filtrerRecus(rows, f).map((r) => r.id)

  it('sans filtre, garde tout', () => {
    expect(ids(RECUS_FILTRES_VIDES)).toEqual(rows.map((r) => r.id))
  })

  it('filtre par génération', () => {
    expect(ids({ generation: 'genere', envoi: '' })).toEqual(['d', 'e', 'f', 'g', 'h'])
    expect(ids({ generation: 'non_genere', envoi: '' })).toEqual(['a'])
    expect(ids({ generation: 'a_completer', envoi: '' })).toEqual(['b', 'c'])
  })

  it('filtre par envoi, sur les reçus générés seulement', () => {
    expect(ids({ generation: '', envoi: 'non_envoye' })).toEqual(['d', 'f'])
    expect(ids({ generation: '', envoi: 'envoye' })).toEqual(['e', 'g'])
    expect(ids({ generation: '', envoi: 'sans_email' })).toEqual(['h'])
  })

  it('combine les deux filtres', () => {
    expect(ids({ generation: 'non_genere', envoi: 'envoye' })).toEqual([])
  })

  it('compte les filtres actifs', () => {
    expect(nombreFiltresRecus(RECUS_FILTRES_VIDES)).toBe(0)
    expect(nombreFiltresRecus({ generation: 'genere', envoi: 'envoye' })).toBe(2)
  })
})
