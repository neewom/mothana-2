import { describe, expect, it } from 'vitest'
import {
  RAISON_SANS_EMAIL, RECUS_FILTRES_VIDES, type RecuStatutSource, envoiLigne, envoiVersionActuelle, exclusEnvoiParDonateur, filtrerRecus,
  nombreFiltresRecus, statutEnvoi, statutGeneration,
} from './recusFiltres'
import { recusAGenerer, recusExclus } from './recusAGenerer'

const ok = { blocking: false, missing: [] }
const famille = { blocking: true, missing: [], message: "Les dons enregistrés au nom d'une famille…" }
const incomplete = { blocking: true, missing: ['adresse'] }

const genere = { date_generation: '2026-03-01T10:00:00Z', email_envoye_at: null }
const envoye = { date_generation: '2026-03-01T10:00:00Z', email_envoye_at: '2026-03-02T08:00:00Z' }
// Régénéré après l'envoi : la date d'envoi reste, mais elle portait la version précédente.
const regenereApresEnvoi = { date_generation: '2026-03-05T10:00:00Z', email_envoye_at: '2026-03-02T08:00:00Z' }

// profil.id : clé des exclus du lot d'envoi (profil_participant_id).
const avecEmail = { id: 'p', personnes: { email: 'a@exemple.fr' } }
const sansEmail = { id: 'p', personnes: { email: null } }
const ligne = (recu: RecuStatutSource | null, email: string | null, id = 'p') => ({ recu, profil: { id, personnes: { email } } })

const rows = [
  { id: 'a', recu: null, validation: ok, profil: avecEmail },
  { id: 'b', recu: null, validation: incomplete, profil: sansEmail },
  { id: 'c', recu: null, validation: famille, profil: avecEmail },
  { id: 'd', recu: genere, validation: ok, profil: avecEmail },
  { id: 'e', recu: envoye, validation: ok, profil: avecEmail },
  { id: 'f', recu: regenereApresEnvoi, validation: ok, profil: avecEmail },
  { id: 'g', recu: envoye, validation: incomplete, profil: avecEmail },
  { id: 'h', recu: genere, validation: ok, profil: { id: 'h', personnes: { email: '  ' } } },
  { id: 'i', recu: genere, validation: ok, profil: { id: 'i', personnes: { email: 'pas-une-adresse' } } },
  { id: 'j', recu: genere, validation: ok, profil: { id: 'j', personnes: { email: 'rejete@exemple.fr' } } },
  { id: 'k', recu: genere, validation: ok, profil: { id: 'k', personnes: { email: 'incertain@exemple.fr' } } },
]

describe('statutGeneration', () => {
  it('classe chaque ligne dans une seule des trois classes', () => {
    expect(rows.map(statutGeneration)).toEqual([
      'non_genere', 'a_completer', 'a_completer', 'genere', 'genere', 'genere', 'genere', 'genere', 'genere', 'genere', 'genere',
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
    expect(statutEnvoi(ligne(null, 'a@exemple.fr'), null)).toBeNull()
  })

  it('distingue envoyé et non envoyé', () => {
    expect(statutEnvoi(ligne(genere, 'a@exemple.fr'), null)).toBe('non_envoye')
    expect(statutEnvoi(ligne(envoye, 'a@exemple.fr'), null)).toBe('envoye')
    expect(envoiVersionActuelle(envoye)).toBe(envoye.email_envoye_at)
  })

  it('tient pour non envoyée une version régénérée après le dernier envoi', () => {
    expect(statutEnvoi(ligne(regenereApresEnvoi, 'a@exemple.fr'), null)).toBe('non_envoye')
    expect(envoiVersionActuelle(regenereApresEnvoi)).toBeNull()
  })
})

describe('statutEnvoi sans récapitulatif serveur (repli)', () => {
  it('classe à part un reçu non envoyé sans adresse email (vide ou blanche)', () => {
    expect(statutEnvoi(ligne(genere, null), null)).toBe('non_envoyable')
    expect(statutEnvoi(ligne(genere, ' '), null)).toBe('non_envoyable')
    expect(envoiLigne(ligne(genere, null), null)).toEqual({ statut: 'non_envoyable', raison: RAISON_SANS_EMAIL })
  })

  it('garde « envoyé » même si l’adresse a été retirée depuis', () => {
    expect(statutEnvoi(ligne(envoye, null), null)).toBe('envoye')
  })
})

// Exclus tels que recapitulatif_envoi_lot_recus les renvoie (recus_envoi_lot, raison non nulle).
const exclusServeur = exclusEnvoiParDonateur([
  { profil_participant_id: 'h', raison: 'Aucune adresse email' },
  { profil_participant_id: 'i', raison: 'Adresse email au format invalide' },
  { profil_participant_id: 'j', raison: "Email invalide : un envoi précédent n'a pas pu être délivré (le 02/03/2026)" },
  { profil_participant_id: 'k', raison: "Envoi incertain lors d'un lot précédent : vérifiez…" },
])

describe('statutEnvoi avec les exclus du lot d’envoi', () => {
  it('écarte de « Non envoyé » les exclus du serveur, avec leur raison', () => {
    expect(envoiLigne(ligne(genere, 'pas-une-adresse', 'i'), exclusServeur))
      .toEqual({ statut: 'non_envoyable', raison: 'Adresse email au format invalide' })
    expect(statutEnvoi(ligne(genere, 'rejete@exemple.fr', 'j'), exclusServeur)).toBe('non_envoyable')
    expect(statutEnvoi(ligne(genere, 'incertain@exemple.fr', 'k'), exclusServeur)).toBe('non_envoyable')
  })

  it('suit le serveur et non la règle locale quand le récapitulatif est chargé', () => {
    // Adresse au format invalide hors des exclus (cas théorique) : non envoyé, comme pour le serveur.
    expect(statutEnvoi(ligne(genere, 'a@exemple.fr', 'z'), exclusServeur)).toBe('non_envoye')
    expect(statutEnvoi(ligne(genere, null, 'z'), new Map())).toBe('non_envoye')
  })

  it('garde « envoyé » pour un donateur exclu (la version actuelle est déjà partie)', () => {
    expect(statutEnvoi(ligne(envoye, 'rejete@exemple.fr', 'j'), exclusServeur)).toBe('envoye')
  })

  it('sans récapitulatif, aucune liste d’exclus', () => {
    expect(exclusEnvoiParDonateur(null)).toBeNull()
    expect(exclusEnvoiParDonateur(undefined)).toBeNull()
  })
})

describe('filtrerRecus', () => {
  const ids = (f: Parameters<typeof filtrerRecus>[1], exclus: Parameters<typeof filtrerRecus>[2] = null) =>
    filtrerRecus(rows, f, exclus).map((r) => r.id)

  it('sans filtre, garde tout', () => {
    expect(ids(RECUS_FILTRES_VIDES)).toEqual(rows.map((r) => r.id))
  })

  it('filtre par génération', () => {
    expect(ids({ generation: 'genere', envoi: '' })).toEqual(['d', 'e', 'f', 'g', 'h', 'i', 'j', 'k'])
    expect(ids({ generation: 'non_genere', envoi: '' })).toEqual(['a'])
    expect(ids({ generation: 'a_completer', envoi: '' })).toEqual(['b', 'c'])
  })

  it('filtre par envoi, sur les reçus générés seulement (repli sans récapitulatif)', () => {
    expect(ids({ generation: '', envoi: 'non_envoye' })).toEqual(['d', 'f', 'i', 'j', 'k'])
    expect(ids({ generation: '', envoi: 'envoye' })).toEqual(['e', 'g'])
    expect(ids({ generation: '', envoi: 'non_envoyable' })).toEqual(['h'])
  })

  it('« Non envoyé » = reçus du lot d’envoi quand le récapitulatif est chargé', () => {
    expect(ids({ generation: '', envoi: 'non_envoye' }, exclusServeur)).toEqual(['d', 'f'])
    expect(ids({ generation: '', envoi: 'non_envoyable' }, exclusServeur)).toEqual(['h', 'i', 'j', 'k'])
    expect(ids({ generation: '', envoi: 'envoye' }, exclusServeur)).toEqual(['e', 'g'])
  })

  it('combine les deux filtres', () => {
    expect(ids({ generation: 'non_genere', envoi: 'envoye' })).toEqual([])
  })

  it('compte les filtres actifs', () => {
    expect(nombreFiltresRecus(RECUS_FILTRES_VIDES)).toBe(0)
    expect(nombreFiltresRecus({ generation: 'genere', envoi: 'envoye' })).toBe(2)
  })
})
