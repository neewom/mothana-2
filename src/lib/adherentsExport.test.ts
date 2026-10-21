import { describe, expect, it } from 'vitest'
import type { Adherent } from '../types'
import { lignesExportAdherents, nomFichierExportAdherents } from './adherentsExport'

const adherent: Adherent = {
  id: 'a1',
  organisation_id: 'o1',
  id_externe: '12',
  civilite: 2,
  nom: 'VONGSA',
  prenom: 'Amphone',
  date_naissance: '1980-03-07',
  adresse: '3 rue des Lilas',
  code_postal: '77000',
  ville: 'Melun',
  pays: 'France',
  telephone: '0601020304',
  courriel: 'a@exemple.fr',
  statut: 'actif',
  statuts_acceptes: true,
  consent_rgpd: true,
  mailing_opt_out: false,
  mailing_opt_out_at: null,
  tags: ['Bureau', 'Courrier'],
  email_invalide_at: null,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
}
const today = '2026-10-17'

describe('lignesExportAdherents', () => {
  it('exporte Nom et Prénom puis seulement les colonnes affichées, dans l’ordre du tableau', () => {
    const [ligne] = lignesExportAdherents([adherent], new Map(), ['localisation', 'adresse'], today)
    expect(Object.keys(ligne)).toEqual(['Nom', 'Prénom', 'Adresse', 'Code postal', 'Ville', 'Pays'])
    expect(ligne).toEqual({ Nom: 'VONGSA', 'Prénom': 'Amphone', Adresse: '3 rue des Lilas', 'Code postal': '77000', Ville: 'Melun', Pays: 'France' })
  })

  it('suit l’ordre du tableau : la civilité avant le nom', () => {
    const [ligne] = lignesExportAdherents([adherent], new Map(), ['listes', 'civilite', 'date_naissance'], today)
    expect(Object.keys(ligne)).toEqual(['Civilité', 'Nom', 'Prénom', 'Date de naissance', 'Listes'])
    expect(ligne['Civilité']).toBe('Madame')
    expect(ligne['Date de naissance']).toBe('07/03/1980')
    expect(ligne.Listes).toBe('Bureau, Courrier')
  })

  it('formate l’adhésion comme dans le tableau et laisse vides les champs absents', () => {
    const vide = { ...adherent, prenom: null, civilite: 0 as const, courriel: null, pays: null }
    const adhesions = new Map([['a1', { date_debut: '2025-09-30', date_fin: '2026-09-30' }]])
    const [ligne] = lignesExportAdherents([vide], adhesions, ['civilite', 'adhesion', 'email', 'localisation'], today)
    expect(ligne).toMatchObject({ 'Civilité': '', 'Prénom': '', 'Adhésion': 'Expirée depuis le 30/09/2026', Email: '', Pays: '' })
    expect(lignesExportAdherents([adherent], new Map(), ['adhesion'], today)[0]['Adhésion']).toBe('Aucune adhésion')
  })

  it('exporte la date d’adhésion de la dernière adhésion, juste après la colonne Adhésion', () => {
    const adhesions = new Map([['a1', { date_debut: '2026-03-15', date_fin: '2026-12-31' }]])
    const [ligne] = lignesExportAdherents([adherent], adhesions, ['date_adhesion', 'email', 'adhesion'], today)
    expect(Object.keys(ligne)).toEqual(['Nom', 'Prénom', 'Adhésion', "Date d'adhésion", 'Email'])
    expect(ligne["Date d'adhésion"]).toBe('15/03/2026')
    expect(lignesExportAdherents([adherent], new Map(), ['date_adhesion'], today)[0]["Date d'adhésion"]).toBe('')
  })
})

describe('nomFichierExportAdherents', () => {
  it('nomme le fichier d’après l’état ou la sélection', () => {
    expect(nomFichierExportAdherents('expire', false, today)).toBe('adherents_expires_2026-10-17.csv')
    expect(nomFichierExportAdherents('a_jour', false, today)).toBe('adherents_actifs_2026-10-17.csv')
    expect(nomFichierExportAdherents('all', true, today)).toBe('adherents_selection_2026-10-17.csv')
  })
})
