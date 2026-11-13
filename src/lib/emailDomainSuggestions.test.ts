import { describe, expect, it } from 'vitest'
import { EMAIL_DOMAINS, getEmailDomainSuggestions } from './emailDomainSuggestions'

describe('getEmailDomainSuggestions', () => {
  it('ne propose rien sans @', () => {
    expect(getEmailDomainSuggestions('')).toEqual([])
    expect(getEmailDomainSuggestions('jean.dupont')).toEqual([])
  })

  it('ne propose rien sans partie locale', () => {
    expect(getEmailDomainSuggestions('@')).toEqual([])
    expect(getEmailDomainSuggestions('@gm')).toEqual([])
  })

  it('propose la liste complète juste après le @', () => {
    expect(getEmailDomainSuggestions('jean@')).toEqual(EMAIL_DOMAINS.map((d) => `jean@${d}`))
  })

  it('filtre par début de domaine', () => {
    expect(getEmailDomainSuggestions('jean@ho')).toEqual(['jean@hotmail.fr', 'jean@hotmail.com'])
    expect(getEmailDomainSuggestions('jean@gm')).toEqual(['jean@gmail.com'])
    expect(getEmailDomainSuggestions('jean@hotmail.')).toEqual(['jean@hotmail.fr', 'jean@hotmail.com'])
  })

  it('ignore la casse du domaine tapé et garde la partie locale telle quelle', () => {
    expect(getEmailDomainSuggestions('Jean.Dupont@HO')).toEqual(['Jean.Dupont@hotmail.fr', 'Jean.Dupont@hotmail.com'])
  })

  it('ferme la liste quand le domaine tapé correspond exactement', () => {
    expect(getEmailDomainSuggestions('jean@gmail.com')).toEqual([])
    expect(getEmailDomainSuggestions('jean@hotmail.fr')).toEqual([])
    expect(getEmailDomainSuggestions('jean@GMAIL.COM')).toEqual([])
  })

  it('ne propose rien pour un domaine inconnu', () => {
    expect(getEmailDomainSuggestions('jean@mon-asso.org')).toEqual([])
    expect(getEmailDomainSuggestions('jean@gmail.co.uk')).toEqual([])
  })

  it('ne propose rien sur une saisie qui ne peut plus devenir une adresse valide', () => {
    expect(getEmailDomainSuggestions('jean@@')).toEqual([])
    expect(getEmailDomainSuggestions('jean@gm@')).toEqual([])
    expect(getEmailDomainSuggestions('jean@g m')).toEqual([])
    expect(getEmailDomainSuggestions('jean dupont@')).toEqual([])
  })

  it('accepte une liste de domaines personnalisée', () => {
    expect(getEmailDomainSuggestions('a@b', ['b.fr', 'c.fr'])).toEqual(['a@b.fr'])
  })
})
