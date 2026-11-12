// deno test --no-lock supabase/functions/_shared/creerOrganisation.test.ts
import { argumentsCreation, creerOrganisation, MESSAGE_DOUBLON, MESSAGE_NOM_INVALIDE, MESSAGE_SLUG_INVALIDE, type ClientRpc } from './creerOrganisation.ts'
import { DEFAULT_CERFA_TEMPLATES } from './defaultCerfaTemplates.ts'
import { DEFAULT_CARTE_ADHERENT_NOM } from './defaultCarteAdherentTemplate.ts'

function vrai(condition: boolean, message: string) {
  if (!condition) throw new Error(message)
}

function clientFactice(reponse: { data: unknown; error: { code?: string; message: string } | null }) {
  const appels: { fn: string; args: Record<string, unknown> }[] = []
  const client: ClientRpc = {
    rpc(fn, args) {
      appels.push({ fn, args })
      return Promise.resolve(reponse)
    },
  }
  return { client, appels }
}

Deno.test('arguments : slug dérivé du nom, modèles par défaut, options nulles', () => {
  const r = argumentsCreation({ nom: 'Les Amis du Quartier — Élan' })
  vrai(r.ok, 'valide')
  if (!r.ok) return
  vrai(r.args.p_slug === 'les-amis-du-quartier-elan', `slug ${r.args.p_slug}`)
  const recus = r.args.p_templates_recu as { type_cerfa: string }[]
  vrai(recus.length === DEFAULT_CERFA_TEMPLATES.length, 'tous les modèles de reçus')
  vrai(recus.map((t) => t.type_cerfa).join(',') === '11580,16216', 'types Cerfa')
  vrai((r.args.p_template_carte as { nom: string }).nom === DEFAULT_CARTE_ADHERENT_NOM, 'modèle de carte')
  vrai(r.args.p_fonctionnalites_activees === null && r.args.p_modele_recu_pdf === null, 'options nulles')
})

Deno.test('arguments : slug et options fournis (inscription)', () => {
  const r = argumentsCreation({ nom: 'Asso', slug: 'asso-2', fonctionnalitesActivees: { dons: true }, modeleRecuPdf: { rna: 'W123' } })
  vrai(r.ok && r.args.p_slug === 'asso-2', 'slug imposé')
  vrai(r.ok && (r.args.p_modele_recu_pdf as { rna: string }).rna === 'W123', 'modèle de reçu')
})

Deno.test('nom vide ou sans caractère utile : refusé sans appel serveur', async () => {
  for (const nom of ['', '   ', '!!!']) {
    const { client, appels } = clientFactice({ data: 'x', error: null })
    const r = await creerOrganisation(client, { nom })
    vrai(!r.ok && r.code === 'NOM_INVALIDE' && r.message === MESSAGE_NOM_INVALIDE, `nom « ${nom} »`)
    vrai(appels.length === 0, 'aucun appel')
  }
})

Deno.test('succès : id renvoyé, une seule fonction SQL appelée', async () => {
  const { client, appels } = clientFactice({ data: 'org-1', error: null })
  const r = await creerOrganisation(client, { nom: 'Asso' })
  vrai(r.ok && r.organisationId === 'org-1', 'id')
  vrai(appels.length === 1 && appels[0].fn === 'creer_organisation', 'un appel')
})

Deno.test('doublon de slug : message habituel', async () => {
  const { client } = clientFactice({
    data: null,
    error: { code: '23505', message: 'duplicate key value violates unique constraint "organisations_slug_unique"' },
  })
  const r = await creerOrganisation(client, { nom: 'Asso' })
  vrai(!r.ok && r.code === 'DOUBLON' && r.message === MESSAGE_DOUBLON, 'doublon')
})

Deno.test('autre erreur : remontée telle quelle', async () => {
  const { client } = clientFactice({ data: null, error: { code: '23514', message: 'check violation' } })
  const r = await creerOrganisation(client, { nom: 'Asso' })
  vrai(!r.ok && r.code === 'ERREUR' && r.message === 'check violation', 'erreur')
})

Deno.test('fonctionnalités : seules dons et adherents passent (jamais evenements ni credit_manuel)', () => {
  const r = argumentsCreation({
    nom: 'Asso',
    fonctionnalitesActivees: { dons: true, adherents: true, evenements: true, credit_manuel: true },
  })
  vrai(r.ok && JSON.stringify(r.args.p_fonctionnalites_activees) === '{"dons":true,"adherents":true}', 'filtrées')
  const seules = argumentsCreation({ nom: 'Asso', fonctionnalitesActivees: { evenements: true } })
  vrai(seules.ok && seules.args.p_fonctionnalites_activees === null, 'rien d’autorisé : valeur par défaut')
})

Deno.test('slug invalide renvoyé par la fonction SQL : code et message propres', async () => {
  const { client } = clientFactice({ data: null, error: { code: '22023', message: 'SLUG_INVALIDE' } })
  const r = await creerOrganisation(client, { nom: 'Asso', slug: 'Pas Un Slug' })
  vrai(!r.ok && r.code === 'SLUG_INVALIDE' && r.message === MESSAGE_SLUG_INVALIDE, 'slug invalide')
  const nom = await creerOrganisation(clientFactice({ data: null, error: { code: '22023', message: 'NOM_INVALIDE' } }).client, { nom: 'Asso' })
  vrai(!nom.ok && nom.code === 'NOM_INVALIDE', 'nom invalide')
})
