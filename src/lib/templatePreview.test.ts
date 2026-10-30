import { describe, expect, it, vi } from 'vitest'

vi.mock('./supabaseClient', () => ({ supabase: {} }))

import { CERFA_PREVIEW_PLACEHOLDERS, renderCerfaPreviewHtml } from './cerfaPreview'
import { renderCartePreviewHtml } from './cartePreview'
import { escapeHtmlTexte, substitutePreviewPlaceholders } from './htmlEscape'

function bodyOf(document: string): string {
  return document.slice(document.indexOf('<body>') + '<body>'.length, document.lastIndexOf('</body>'))
}

describe('escapeHtmlTexte', () => {
  it('échappe tout puis rend les retours à la ligne en <br>', () => {
    expect(escapeHtmlTexte('a & b\r\nc\rd\ne')).toBe('a &amp; b<br>c<br>d<br>e')
  })
})

describe('renderCerfaPreviewHtml', () => {
  it("rend un objet social multiligne sur plusieurs lignes, comme le PDF", () => {
    const html = renderCerfaPreviewHtml('<p>{{organisation_objet_social}}</p>', '', {
      organisation_objet_social: 'Culte bouddhiste en France\nAssociation cultuelle',
    })
    expect(bodyOf(html)).toBe('<p>Culte bouddhiste en France<br>Association cultuelle</p>')
  })

  it('échappe un <br> saisi au lieu de le rendre', () => {
    const html = renderCerfaPreviewHtml('<p>{{organisation_objet_social}}</p>', '', {
      organisation_objet_social: 'ligne 1<br />ligne 2',
    })
    expect(bodyOf(html)).toBe('<p>ligne 1&lt;br /&gt;ligne 2</p>')
  })

  it('échappe une balise <script> saisie', () => {
    const html = renderCerfaPreviewHtml('<p>{{organisation_nom}}</p>', '', {
      organisation_nom: '<script>alert("x")</script>',
    })
    expect(bodyOf(html)).toBe('<p>&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;</p>')
    expect(html).not.toContain('<script>')
  })

  it('insère le fragment HTML dons_detail tel quel', () => {
    const html = renderCerfaPreviewHtml('<div>{{dons_detail}}</div>', '')
    expect(bodyOf(html)).toBe(`<div>${CERFA_PREVIEW_PLACEHOLDERS.dons_detail}</div>`)
  })

  it("garde une URL d'asset valide dans un attribut src (& → &amp;)", () => {
    const url = 'https://exemple.supabase.co/storage/v1/object/public/assets/logo.png?width=200&quality=80'
    const html = renderCerfaPreviewHtml('<img src="{{asset_logo}}">', '', { asset_logo: url })
    const body = bodyOf(html)
    expect(body).toBe(
      '<img src="https://exemple.supabase.co/storage/v1/object/public/assets/logo.png?width=200&amp;quality=80">',
    )
    // `&amp;` dans un attribut est décodé en `&` par le navigateur : l'URL chargée est l'originale.
    expect(body.replaceAll('&amp;', '&')).toBe(`<img src="${url}">`)
  })
})

describe('renderCartePreviewHtml', () => {
  it('échappe les valeurs et rend les retours à la ligne en <br>', () => {
    const html = renderCartePreviewHtml('<p>{{adherent_nom_complet}}</p><p>{{adherent_adresse}}</p>', '', {
      adherent_nom_complet: '<b>DUPONT</b>',
      adherent_adresse: '12 rue des Lilas\nBât. B',
    })
    expect(bodyOf(html)).toBe('<p>&lt;b&gt;DUPONT&lt;/b&gt;</p><p>12 rue des Lilas<br>Bât. B</p>')
  })
})

describe('substitutePreviewPlaceholders', () => {
  it("laisse visible une variable inconnue, comme avant", () => {
    expect(substitutePreviewPlaceholders('{{inconnue}} {{a}}', { a: 'x' })).toBe('{{inconnue}} x')
  })
})
