// deno test --no-lock supabase/functions/_shared/brevo.test.ts
import { cibleRejet, tagsEmailRecu, verifierExpediteurBrevo } from './brevo.ts'

function vrai(condition: boolean, message: string) {
  if (!condition) throw new Error(message)
}

const PROFIL = '0b6d1a52-2f39-4c7e-9a51-0b8cbb2d8f10'

Deno.test('rejet sans tag : adhérent (campagnes mailing, comportement inchangé)', () => {
  vrai(cibleRejet({}).type === 'adherent', 'sans tag')
  vrai(cibleRejet({ tags: ['campagne'], tag: 'campagne' }).type === 'adherent', 'autre tag')
})

Deno.test('rejet d\'un reçu : profil lu dans `tags` ou dans `tag` (JSON)', () => {
  const parTableau = cibleRejet({ tags: tagsEmailRecu(PROFIL) })
  vrai(parTableau.type === 'recu' && parTableau.profilParticipantId === PROFIL, JSON.stringify(parTableau))
  const parChaine = cibleRejet({ tag: JSON.stringify(tagsEmailRecu(PROFIL)) })
  vrai(parChaine.type === 'recu' && parChaine.profilParticipantId === PROFIL, JSON.stringify(parChaine))
  // Forme relevée sur l'API statistiques Brevo (2026-11-04) : tags joints par des virgules.
  const parVirgules = cibleRejet({ tag: `recu-fiscal,profil:${PROFIL}` })
  vrai(parVirgules.type === 'recu' && parVirgules.profilParticipantId === PROFIL, JSON.stringify(parVirgules))
})

Deno.test('rejet d\'un reçu avec un profil mal formé : profil inconnu', () => {
  const cible = cibleRejet({ tags: ['recu-fiscal', 'profil:1 or 1=1'] })
  vrai(cible.type === 'recu' && cible.profilParticipantId === null, JSON.stringify(cible))
})

function fetchSenders(status: number, senders: unknown): typeof fetch {
  return (() => Promise.resolve(new Response(JSON.stringify({ senders }), { status }))) as typeof fetch
}

Deno.test('vérification de l\'expéditeur : valide, non valide, impossible', async () => {
  vrai(await verifierExpediteurBrevo('k', 'Contact@Asso.fr ', 't', fetchSenders(200, [{ email: 'contact@asso.fr', active: true }])) === 'valide', 'valide')
  vrai(await verifierExpediteurBrevo('k', 'contact@asso.fr', 't', fetchSenders(200, [{ email: 'contact@asso.fr', active: false }])) === 'non_valide', 'inactif')
  vrai(await verifierExpediteurBrevo('k', 'contact@asso.fr', 't', fetchSenders(403, [])) === 'impossible', '403')
})
