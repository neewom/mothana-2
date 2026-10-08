import { describe, expect, it } from 'vitest'
import { pagesParametresACompleter, validateOrganisationCerfa } from './cerfaValidation'

describe('pagesParametresACompleter', () => {
  it('renvoie Organisation pour l’identité et Reçus fiscaux pour la mention légale', () => {
    expect(pagesParametresACompleter(['adresse', 'RNA ou SIREN']).map((p) => p.to)).toEqual(['/admin/parametres'])
    expect(pagesParametresACompleter(['mention légale']).map((p) => p.to)).toEqual(['/admin/parametres/recus-fiscaux'])
    expect(pagesParametresACompleter(['ville', 'mention légale']).map((p) => p.to)).toEqual(['/admin/parametres', '/admin/parametres/recus-fiscaux'])
    expect(pagesParametresACompleter([])).toEqual([])
  })

  it('couvre tous les champs que la validation peut signaler', () => {
    const missing = validateOrganisationCerfa({ adresse: null, code_postal: null, ville: null, modele_recu_pdf: {} } as never)
    expect(pagesParametresACompleter(missing)).toHaveLength(2)
  })
})
