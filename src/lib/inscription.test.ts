import { describe, expect, it } from 'vitest'
import {
  CHAMP_PIEGE,
  corpsDemandeInscription,
  erreurChampInscription,
  erreursInscription,
  SAISIE_VIDE,
  suggestionDomaineEmail,
  type SaisieInscription,
} from './inscription'
import { validerDemandeInscription } from '../../supabase/functions/_shared/inscription'

const VALIDE: SaisieInscription = {
  ...SAISIE_VIDE,
  nom_association: 'Les Amis du Quartier',
  ville: 'Lyon',
  prenom: 'Camille',
  nom: 'Martin',
  email: 'camille@exemple.fr',
}

describe('règles de saisie de l’inscription', () => {
  it('champs obligatoires : nom de l’association, ville, prénom, nom, email', () => {
    expect(Object.keys(erreursInscription(SAISIE_VIDE, false)).sort()).toEqual(['email', 'nom', 'nom_association', 'prenom', 'ville'])
    expect(erreursInscription(VALIDE, false)).toEqual({})
  })

  it('RNA : W suivi de 9 chiffres, espaces et minuscules tolérés ; SIREN : 9 chiffres', () => {
    expect(erreurChampInscription('rna', { ...VALIDE, rna: 'w 751 234 567' }, false)).toBeNull()
    expect(erreurChampInscription('rna', { ...VALIDE, rna: 'W75123' }, false)).toMatch(/W, suivi de 9 chiffres/)
    expect(erreurChampInscription('rna', { ...VALIDE, rna: '751234567' }, false)).not.toBeNull()
    expect(erreurChampInscription('siren', { ...VALIDE, siren: '123 456 789' }, false)).toBeNull()
    expect(erreurChampInscription('siren', { ...VALIDE, siren: '12345678' }, false)).toBe('Le SIREN compte 9 chiffres.')
  })

  it('email : erreur dès la saisie tant que non conforme', () => {
    expect(erreurChampInscription('email', { ...VALIDE, email: 'c' }, false)).not.toBeNull()
    expect(erreurChampInscription('email', { ...VALIDE, email: 'c@exemple' }, false)).not.toBeNull()
    expect(erreurChampInscription('email', { ...VALIDE, email: ' Camille@Exemple.fr ' }, false)).toBeNull()
  })

  it('normalisation : RNA en majuscules sans espaces, email en minuscules, champs vides à null', () => {
    const r = validerDemandeInscription({ ...VALIDE, rna: 'w 751 234 567', email: ' Camille@Exemple.FR ', message: '  ' }, false)
    expect(r.ok && r.demande).toMatchObject({ rna: 'W751234567', siren: null, email: 'camille@exemple.fr', message: null })
  })
})

describe('case CGU (constante CGU_PUBLIEES)', () => {
  it('CGU non publiées : case ni exigée ni transmise', () => {
    expect(erreurChampInscription('cgu', VALIDE, false)).toBeNull()
    const corps = corpsDemandeInscription({ ...VALIDE, cgu_acceptees: true }, false, 'https://samakan.fr', '')
    expect(corps?.cgu_acceptees).toBe(false)
  })

  it('CGU publiées : case obligatoire, acceptation transmise (datée côté serveur)', () => {
    expect(erreurChampInscription('cgu', VALIDE, true)).toMatch(/CGU/)
    expect(corpsDemandeInscription(VALIDE, true, 'https://samakan.fr', '')).toBeNull()
    const corps = corpsDemandeInscription({ ...VALIDE, cgu_acceptees: true }, true, 'https://samakan.fr', '')
    expect(corps?.cgu_acceptees).toBe(true)
  })

  it('corps : site et champ piège transmis, null si un champ est en erreur', () => {
    const corps = corpsDemandeInscription(VALIDE, false, 'https://samakan.fr', 'robot')
    expect(corps).toMatchObject({ site_url: 'https://samakan.fr', [CHAMP_PIEGE]: 'robot' })
    expect(corpsDemandeInscription({ ...VALIDE, email: 'x' }, false, 'https://samakan.fr', '')).toBeNull()
  })
})

describe('suggestion de domaine', () => {
  it('propose la correction d’une faute courante, rien sinon', () => {
    expect(suggestionDomaineEmail('camille@gmial.com')).toBe('camille@gmail.com')
    expect(suggestionDomaineEmail('Camille@HOTMIAL.FR')).toBe('Camille@hotmail.fr')
    expect(suggestionDomaineEmail('camille@gmail.com')).toBeNull()
    expect(suggestionDomaineEmail('camille')).toBeNull()
  })
})
