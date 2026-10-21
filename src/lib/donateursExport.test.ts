import { describe, expect, it } from 'vitest'
import type { Personne } from '../types'
import { lignesExportDonateurs, nomFichierExportDonateurs } from './donateursExport'

const personne = (p: Partial<Personne>) => ({ nom: 'X', prenom: null, civilite: null, ...p }) as Personne

describe('lignesExportDonateurs', () => {
  it('reprend les colonnes du tableau, dans le même ordre et l’ordre des lignes reçu', () => {
    const lignes = lignesExportDonateurs(
      [
        { id: 'b', personnes: personne({ nom: 'BOULOM', prenom: 'Nicolas', civilite: 1 }) },
        { id: 'a', personnes: personne({ nom: 'Association Lao', civilite: 6 }) },
      ],
      new Map([['b', 1234.5]]),
    )
    expect(Object.keys(lignes[0])).toEqual(['Civilité', 'Nom', 'Prénom', 'Total dons'])
    expect(lignes[0]).toEqual({ 'Civilité': 'Monsieur', Nom: 'BOULOM', 'Prénom': 'Nicolas', 'Total dons': '1234,50' })
    expect(lignes[1]).toEqual({ 'Civilité': 'Association', Nom: 'Association Lao', 'Prénom': '', 'Total dons': '0,00' })
  })
})

describe('nomFichierExportDonateurs', () => {
  it('signale une recherche active dans le nom du fichier', () => {
    expect(nomFichierExportDonateurs('2026-10-21', false)).toBe('donateurs_2026-10-21.csv')
    expect(nomFichierExportDonateurs('2026-10-21', true)).toBe('donateurs_recherche_2026-10-21.csv')
  })
})
