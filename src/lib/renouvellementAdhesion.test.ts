import { describe, expect, it } from 'vitest'
import {
  empreinteSecretRenouvellement,
  extraireSecretRenouvellement,
  formatDateFinAdhesion,
  valeursPreremplies,
} from './renouvellementAdhesion'
import { champsAdhesionPayload } from './champsAdhesion'
import { empreinteSecret } from '../../supabase/functions/send-mailing-brevo/lienRenouvellement'
import {
  confirmationRenouvellementHtml,
  dateFinPublique,
  etatPublic,
  isSecretHash,
} from '../../supabase/functions/soumettre-renouvellement-adhesion/renouvellement'
import { notificationAdminsHtml, sujetNotificationAdmins } from '../../supabase/functions/soumettre-demande-adhesion/notificationAdmins'

const SECRET = '0123456789abcdef'.repeat(4)

describe('extraireSecretRenouvellement', () => {
  it('lit un secret de 64 hex dans le fragment', () => {
    expect(extraireSecretRenouvellement(`#${SECRET}`)).toBe(SECRET)
    expect(extraireSecretRenouvellement(SECRET.toUpperCase())).toBe(SECRET)
    expect(extraireSecretRenouvellement(`#${SECRET}\u200B `)).toBe(SECRET)
  })

  it('refuse un fragment absent, tronqué ou mal formé', () => {
    expect(extraireSecretRenouvellement('')).toBeNull()
    expect(extraireSecretRenouvellement('#')).toBeNull()
    expect(extraireSecretRenouvellement(`#${SECRET.slice(1)}`)).toBeNull()
    expect(extraireSecretRenouvellement(`#${SECRET.slice(1)}z`)).toBeNull()
    expect(extraireSecretRenouvellement('#%E0%A4%A')).toBeNull()
  })
})

describe('empreinteSecretRenouvellement', () => {
  it('calcule la même empreinte que send-mailing-brevo', async () => {
    const empreinte = empreinteSecretRenouvellement(SECRET)
    expect(empreinte).toMatch(/^[0-9a-f]{64}$/)
    expect(empreinte).toBe(await empreinteSecret(SECRET))
    expect(isSecretHash(empreinte)).toBe(true)
  })
})

describe('valeursPreremplies', () => {
  it('reprend la fiche, sans date de naissance', () => {
    const v = valeursPreremplies({
      civilite: 2, nom: 'DUPONT', prenom: 'Marie', adresse: '1 rue A', code_postal: '75 001', ville: 'Paris',
      pays: null, telephone: '06 12 34 56 78', courriel: 'marie@exemple.fr',
    })
    expect(v).toMatchObject({ civilite: 2, nom: 'DUPONT', prenom: 'Marie', codePostal: '75001', pays: 'France', telephone: '06 12 34 56 78', dateNaissance: '' })
    expect(champsAdhesionPayload(v).date_naissance).toBeNull()
  })

  it('civilité inconnue ou champs absents : valeurs vides', () => {
    const v = valeursPreremplies({
      civilite: 0, nom: null, prenom: null, adresse: null, code_postal: null, ville: null, pays: 'Belgique', telephone: null, courriel: null,
    })
    expect(v).toMatchObject({ civilite: 0, nom: '', prenom: '', codePostal: '', pays: 'Belgique', courriel: '' })
  })
})

describe('formatDateFinAdhesion', () => {
  it('formate une date AAAA-MM-JJ, sinon null', () => {
    expect(formatDateFinAdhesion('2026-12-31')).toBe('31 décembre 2026')
    expect(formatDateFinAdhesion(null)).toBeNull()
    expect(formatDateFinAdhesion('31/12/2026')).toBeNull()
  })
})

describe('Edge Functions de renouvellement (parties pures)', () => {
  it('etatPublic : toute valeur inattendue devient lien_invalide', () => {
    expect(etatPublic('deja_envoye')).toBe('deja_envoye')
    expect(etatPublic('deja_renouvele')).toBe('deja_renouvele')
    expect(etatPublic('lien_expire')).toBe('lien_expire')
    expect(etatPublic('valide')).toBe('lien_invalide')
    expect(etatPublic('revoque')).toBe('lien_invalide')
    expect(etatPublic(undefined)).toBe('lien_invalide')
  })

  it('dateFinPublique : seulement une date', () => {
    expect(dateFinPublique('2026-12-31')).toBe('2026-12-31')
    expect(dateFinPublique('<script>')).toBeNull()
    expect(dateFinPublique(null)).toBeNull()
  })

  it('confirmation : texte saisi échappé', () => {
    const html = confirmationRenouvellementHtml('<b>Jean</b>', 'Asso & Co')
    expect(html).toContain('&lt;b&gt;Jean&lt;/b&gt;')
    expect(html).toContain('Asso &amp; Co')
    expect(html).not.toContain('<b>Jean')
  })

  it('notification des comptes : texte propre au renouvellement, sans donnée du demandeur', () => {
    const html = notificationAdminsHtml('https://samakan.fr/admin/adherents/demandes', 'renouvellement')
    expect(html).toContain('Nouvelle demande de renouvellement')
    expect(html).not.toMatch(/@|Bonjour /)
    expect(sujetNotificationAdmins('renouvellement')).toBe('Nouvelle demande de renouvellement à examiner')
    expect(sujetNotificationAdmins()).toBe("Nouvelle demande d'adhésion à examiner")
    expect(notificationAdminsHtml('https://samakan.fr/x')).toContain("Nouvelle demande d'adhésion")
  })
})
