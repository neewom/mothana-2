import { assertEquals } from 'jsr:@std/assert@1'
import { enLots, nomsPiecesJointes, libelleExclusion, libelleSelection, lignesDestinataires, raisonExclusion } from './detailCampagne.ts'

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

Deno.test('libelleSelection : statut, liste relue, liste introuvable', () => {
  assertEquals(libelleSelection('actif', null, null), 'Tous sauf archivés')
  assertEquals(libelleSelection('archive', null, null), 'Adhérents archivés')
  assertEquals(libelleSelection('tous', null, null), 'Tous les adhérents')
  assertEquals(libelleSelection('tous', 'Bureau', 'Bureau'), 'Liste : Bureau')
  assertEquals(libelleSelection('tous', 'Ancienne', null), 'Liste : Ancienne')
})

Deno.test('libelleExclusion', () => {
  assertEquals(libelleExclusion(null, null), null)
  assertEquals(libelleExclusion('Bénévoles', 'Bénévoles'), 'Sauf liste : Bénévoles')
})

Deno.test('raisonExclusion : même classement que mailingRecipients', () => {
  const base = { id: '1', nom: 'N', prenom: null, email_invalide_at: null }
  assertEquals(raisonExclusion({ ...base, courriel: null }, EMAIL_REGEX), 'email_manquant')
  assertEquals(raisonExclusion({ ...base, courriel: '   ' }, EMAIL_REGEX), 'email_manquant')
  assertEquals(raisonExclusion({ ...base, courriel: 'pas un email' }, EMAIL_REGEX), 'email_invalide')
  assertEquals(raisonExclusion({ ...base, courriel: 'a@b.fr', email_invalide_at: '2026-01-01' }, EMAIL_REGEX), 'email_rejete')
  assertEquals(raisonExclusion({ ...base, courriel: ' a@b.fr ' }, EMAIL_REGEX), null)
})

Deno.test('lignesDestinataires : nom et email figés, statut et raison', () => {
  const lignes = lignesDestinataires(
    [
      { id: 'a', nom: 'Dupont', prenom: 'Marie', courriel: ' m@d.fr ', email_invalide_at: null },
      { id: 'b', nom: 'Martin', prenom: null, courriel: '', email_invalide_at: null },
    ],
    'c1',
    'o1',
    EMAIL_REGEX,
  )
  assertEquals(lignes, [
    { campagne_id: 'c1', organisation_id: 'o1', adherent_id: 'a', nom: 'Marie Dupont', courriel: 'm@d.fr', statut: 'envoye', raison_exclusion: null },
    { campagne_id: 'c1', organisation_id: 'o1', adherent_id: 'b', nom: 'Martin', courriel: null, statut: 'exclu', raison_exclusion: 'email_manquant' },
  ])
})

Deno.test('enLots', () => {
  assertEquals(enLots([1, 2, 3, 4, 5], 2), [[1, 2], [3, 4], [5]])
  assertEquals(enLots([], 2), [])
})

Deno.test('nomsPiecesJointes : noms tels que reçus, 3 au plus, 255 caractères chacun, vide si aucune', () => {
  assertEquals(nomsPiecesJointes([], 3), [])
  assertEquals(nomsPiecesJointes([{ nom: 'convocation.pdf' }, { nom: 'plan.png' }], 3), ['convocation.pdf', 'plan.png'])
  assertEquals(nomsPiecesJointes([{ nom: 'a' }, { nom: 'b' }, { nom: 'c' }, { nom: 'd' }], 3), ['a', 'b', 'c'])
  assertEquals(nomsPiecesJointes([{ nom: 'x'.repeat(300) }], 3)[0].length, 255)
  // Emoji à la 255e position : jamais coupé en deux.
  assertEquals(nomsPiecesJointes([{ nom: 'x'.repeat(254) + '📎' + 'y'.repeat(10) }], 3)[0], 'x'.repeat(254) + '📎')
})
