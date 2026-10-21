import { describe, expect, it } from 'vitest'
import { neutraliserCellule, toCsv } from './csvExport'

describe('neutraliserCellule', () => {
  it('préfixe d’une apostrophe un texte qui serait lu comme une formule', () => {
    expect(neutraliserCellule('=HYPERLINK("http://x","clic")')).toBe('\'=HYPERLINK("http://x","clic")')
    expect(neutraliserCellule('+33612345678')).toBe("'+33612345678")
    expect(neutraliserCellule('-2+3')).toBe("'-2+3")
    expect(neutraliserCellule('@SUM(A1)')).toBe("'@SUM(A1)")
    expect(neutraliserCellule('\t=1+1')).toBe("'\t=1+1")
    expect(neutraliserCellule('\r=1+1')).toBe("'\r=1+1")
  })

  it('laisse intacts le texte normal, la chaîne vide et les nombres', () => {
    expect(neutraliserCellule('BOULOM')).toBe('BOULOM')
    expect(neutraliserCellule('')).toBe('')
    expect(neutraliserCellule(-50)).toBe(-50)
    expect(neutraliserCellule(1234.5)).toBe(1234.5)
  })

  it('laisse intacts les montants déjà formatés, négatifs compris', () => {
    for (const montant of ['1234,50', '-12,50', '-12', '-1234.5', '-1 234,50', '-1 234,50']) {
      expect(neutraliserCellule(montant)).toBe(montant)
    }
  })
})

describe('toCsv', () => {
  it('neutralise les cellules et échappe toujours ; et guillemets', () => {
    const csv = toCsv([{ Nom: '=HYPERLINK("http://x","clic")', Ville: 'Paris; 1er', Montant: '-12,50', Total: -3 }])
    expect(csv).toBe('Nom;Ville;Montant;Total\r\n"\'=HYPERLINK(""http://x"",""clic"")";"Paris; 1er";-12,50;-3')
  })
})
