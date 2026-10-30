import { describe, expect, it } from 'vitest'
import {
  avecBoutonRenouvellement,
  empreinteSecret,
  lienRenouvellement,
  origineSite,
  utiliseLienRenouvellement,
} from '../../supabase/functions/send-mailing-brevo/lienRenouvellement'

const RECETTE = 'https://cxngcmvxktddhyxboyyx.supabase.co'
const PROD = 'https://bocqfdhmxmleracrwvbu.supabase.co'

describe('utiliseLienRenouvellement', () => {
  it('détecte le paramètre, avec ou sans espaces', () => {
    expect(utiliseLienRenouvellement('<p>Bonjour {{params.lien_renouvellement}}</p>')).toBe(true)
    expect(utiliseLienRenouvellement('<a href="{{ params.lien_renouvellement }}">ici</a>')).toBe(true)
  })

  it('ignore une campagne sans le lien', () => {
    expect(utiliseLienRenouvellement('<p>Bonjour {{params.prenom}}</p>')).toBe(false)
  })
})

describe('avecBoutonRenouvellement', () => {
  it('transforme le paramètre nu en bouton', () => {
    const html = avecBoutonRenouvellement('<p>{{params.lien_renouvellement}}</p>')
    expect(html).toContain('<a href="{{params.lien_renouvellement}}"')
    expect(html).toContain('Renouveler mon adhésion</a>')
    expect(html.match(/params\.lien_renouvellement/g)).toHaveLength(1)
  })

  it('laisse intact un lien posé à la main', () => {
    const html = '<p><a href="{{params.lien_renouvellement}}">Mon lien</a></p>'
    expect(avecBoutonRenouvellement(html)).toBe(html)
  })
})

describe('origineSite', () => {
  it('reprend une origine autorisée', () => {
    expect(origineSite('https://test.samakan.fr', RECETTE)).toBe('https://test.samakan.fr')
    expect(origineSite('http://100.107.87.80:5174', RECETTE)).toBe('http://100.107.87.80:5174')
  })

  it('se replie sur le site de l’environnement pour une origine falsifiée ou absente', () => {
    expect(origineSite('https://samakan.fr.piege.example', PROD)).toBe('https://samakan.fr')
    expect(origineSite(undefined, RECETTE)).toBe('https://test.samakan.fr')
    expect(origineSite('javascript:alert(1)', PROD)).toBe('https://samakan.fr')
  })
})

describe('lienRenouvellement', () => {
  it('porte le secret dans le fragment', () => {
    expect(lienRenouvellement('https://test.samakan.fr', 'association-demo-staging', 'ab'.repeat(32)))
      .toBe(`https://test.samakan.fr/adhesion/association-demo-staging/renouveler#${'ab'.repeat(32)}`)
  })
})

describe('empreinteSecret', () => {
  it('calcule le SHA-256 hexadécimal de la chaîne (même formule que le porte-monnaie)', async () => {
    expect(await empreinteSecret('abc')).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad')
  })
})
