import { assertEquals } from 'jsr:@std/assert@1'
import { adresseComplete, adresseFigee, lignesDestinataires, raisonExclusion } from './detailCampagne.ts'
import { enLots, libelleExclusion, libelleSelection } from '../_shared/libellesCampagne.ts'

const complet = { adresse: '1 rue du Test', code_postal: '75000', ville: 'Paris' }

Deno.test('adresseComplete : adresse, code postal et ville requis, espaces = vide', () => {
  assertEquals(adresseComplete(complet), true)
  assertEquals(adresseComplete({ ...complet, adresse: null }), false)
  assertEquals(adresseComplete({ ...complet, code_postal: '  ' }), false)
  assertEquals(adresseComplete({ ...complet, ville: '' }), false)
  assertEquals(adresseComplete({ adresse: null, code_postal: null, ville: null }), false)
})

Deno.test('raisonExclusion : une seule raison, adresse incomplète', () => {
  assertEquals(raisonExclusion(complet), null)
  assertEquals(raisonExclusion({ ...complet, ville: null }), 'adresse_incomplete')
})

Deno.test('adresseFigee : adresse imprimée, partie connue ou null', () => {
  assertEquals(adresseFigee({ adresse: ' 1 rue du Test ', code_postal: '75000', ville: ' Paris ' }), '1 rue du Test, 75000 Paris')
  assertEquals(adresseFigee({ adresse: null, code_postal: '75000', ville: null }), '75000')
  assertEquals(adresseFigee({ adresse: '  ', code_postal: null, ville: '' }), null)
})

Deno.test('lignesDestinataires : nom et adresse figés, statut et raison', () => {
  const lignes = lignesDestinataires(
    [
      { id: 'a', nom: 'Dupont', prenom: 'Marie', ...complet },
      { id: 'b', nom: 'Martin', prenom: null, adresse: '2 place X', code_postal: null, ville: 'Lyon' },
    ],
    'c1',
    'o1',
  )
  assertEquals(lignes, [
    { campagne_id: 'c1', organisation_id: 'o1', adherent_id: 'a', nom: 'Marie Dupont', adresse: '1 rue du Test, 75000 Paris', statut: 'genere', raison_exclusion: null },
    { campagne_id: 'c1', organisation_id: 'o1', adherent_id: 'b', nom: 'Martin', adresse: '2 place X, Lyon', statut: 'exclu', raison_exclusion: 'adresse_incomplete' },
  ])
})

Deno.test('libellés partagés : sélection et exclusion', () => {
  assertEquals(libelleSelection('actif', null, null), 'Tous sauf archivés')
  assertEquals(libelleSelection('tous', 'Bureau', 'Bureau'), 'Liste : Bureau')
  assertEquals(libelleExclusion('Bénévoles', null), 'Sauf liste : Bénévoles')
  assertEquals(libelleExclusion(null, null), null)
  assertEquals(enLots([1, 2, 3], 2), [[1, 2], [3]])
})
