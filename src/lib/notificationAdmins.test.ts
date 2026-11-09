import { describe, expect, it } from 'vitest'
import { lienPageDemandes, notificationAdminsHtml } from '../../supabase/functions/soumettre-demande-adhesion/notificationAdmins'

const RECETTE = 'https://cxngcmvxktddhyxboyyx.supabase.co'
const PROD = 'https://bocqfdhmxmleracrwvbu.supabase.co'

describe('lienPageDemandes', () => {
  it('reprend une origine autorisée', () => {
    expect(lienPageDemandes('https://test.samakan.fr', RECETTE)).toBe('https://test.samakan.fr/admin/adherents/renouvellements')
    expect(lienPageDemandes('https://samakan.fr/adhesion/wat', PROD)).toBe('https://samakan.fr/admin/adherents/renouvellements')
  })

  it('ne suit jamais une origine falsifiée ou absente : site de l’environnement', () => {
    expect(lienPageDemandes('https://samakan.fr.piege.example', PROD)).toBe('https://samakan.fr/admin/adherents/renouvellements')
    expect(lienPageDemandes('javascript:alert(1)', PROD)).toBe('https://samakan.fr/admin/adherents/renouvellements')
    expect(lienPageDemandes(undefined, PROD)).toBe('https://samakan.fr/admin/adherents/renouvellements')
    expect(lienPageDemandes('http://samakan.fr', PROD)).toBe('https://samakan.fr/admin/adherents/renouvellements')
    expect(lienPageDemandes('https://evil.example', RECETTE)).toBe('https://test.samakan.fr/admin/adherents/renouvellements')
  })
})

describe('notificationAdminsHtml', () => {
  it('contient le lien et aucune donnée du demandeur', () => {
    const html = notificationAdminsHtml('https://samakan.fr/admin/adherents/renouvellements')
    expect(html).toContain('href="https://samakan.fr/admin/adherents/renouvellements"')
    expect(html).not.toMatch(/@|Bonjour /)
  })
})

describe('notificationAdminsHtml — renouvellement', () => {
  it('parle de validation, jamais de ratification ni de conseil', () => {
    const html = notificationAdminsHtml('https://samakan.fr/admin/adherents/renouvellements', 'renouvellement')
    expect(html).toContain('Voir les renouvellements')
    expect(html).toContain('à valider')
    expect(html).not.toMatch(/ratif|conseil d|examiner/i)
  })
})
