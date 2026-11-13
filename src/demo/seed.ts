// Jeu de données de la démo, entièrement fictif (aucune donnée réelle), déterministe.
import { createClient } from '@supabase/supabase-js'
import type { PGlite } from '@electric-sql/pglite'
import type { TinbaseBackend } from 'tinbase'
import { creerOrganisation } from '../../supabase/functions/_shared/creerOrganisation.ts'

// Identifiants locaux au navigateur du visiteur : ils ne protègent rien et ne servent qu'à la démo.
export const DEMO_ADMIN = { email: 'demo@samakan.invalid', password: 'demo-samakan-local' }
export const DEMO_PIN = '123456'

const PRENOMS = ['Jean', 'Marie', 'Pierre', 'Sophie', 'Lucas', 'Camille', 'Thomas', 'Léa', 'Nicolas', 'Chloé', 'Antoine', 'Emma', 'Hugo', 'Manon', 'Paul', 'Julie', 'Louis', 'Sarah', 'Kevin', 'Inès', 'Malik', 'Aïcha', 'Minh', 'Linh', 'Somchai', 'Noy']
const NOMS = ['Martin', 'Bernard', 'Dubois', 'Thomas', 'Robert', 'Richard', 'Petit', 'Durand', 'Leroy', 'Moreau', 'Simon', 'Laurent', 'Lefebvre', 'Michel', 'Garcia', 'David', 'Bertrand', 'Roux', 'Vincent', 'Fournier', 'Nguyen', 'Tran', 'Phommachanh', 'Sisavath']
const VILLES: [string, string][] = [['75011', 'Paris'], ['69003', 'Lyon'], ['13005', 'Marseille'], ['31000', 'Toulouse'], ['33000', 'Bordeaux'], ['59000', 'Lille'], ['44000', 'Nantes'], ['67000', 'Strasbourg']]

// Générateur pseudo-aléatoire déterministe : même jeu de données à chaque remise à zéro.
function rng(seed: number) {
  let s = seed
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296
    return s / 4294967296
  }
}

const q = (v: string | number | null) => (v === null ? 'null' : typeof v === 'number' ? String(v) : `'${v.replace(/'/g, "''")}'`)

function isoDaysAgo(n: number): string {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return d.toISOString().slice(0, 10)
}

export async function seedDemo(backend: TinbaseBackend, pg: PGlite): Promise<void> {
  const service = createClient('http://demo.local', backend.serviceRoleKey, {
    global: { fetch: (input, init) => backend.fetch(new Request(input, init)) },
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const org = await creerOrganisation(service, {
    nom: 'Les Amis du Quartier (démo)',
    slug: 'demo',
    fonctionnalitesActivees: { dons: true, adherents: true, evenements: false },
    modeleRecuPdf: {
      rna: 'W000000000',
      objet_social: 'Animation culturelle et entraide de quartier',
      mention_legale: "Association loi 1901 d'intérêt général (articles 200 et 238 bis du CGI)",
    },
  })
  if (!org.ok) throw new Error(`Création de l'organisation de démo : ${org.message}`)
  const orgId = org.organisationId

  const { data: admin, error: adminErr } = await service.auth.admin.createUser({
    email: DEMO_ADMIN.email,
    password: DEMO_ADMIN.password,
    email_confirm: true,
    user_metadata: { nom_affiche: 'Admin démo' },
  })
  if (adminErr || !admin.user) throw new Error(`Compte admin de démo : ${adminErr?.message}`)

  // Compte technique bénévole, comme celui que crée verify-pin en production.
  const { error: benErr } = await service.auth.admin.createUser({
    email: `benevole-${orgId}@mothana.internal`,
    password: DEMO_ADMIN.password,
    email_confirm: true,
    app_metadata: { role: 'benevole', organisation_id: orgId },
  })
  if (benErr) throw new Error(`Compte bénévole de démo : ${benErr.message}`)

  const r = rng(42)
  const pick = <T,>(a: T[]) => a[Math.floor(r() * a.length)]
  const sql: string[] = []
  sql.push(`update public.organisations set adresse = '12 rue des Lilas', code_postal = '75011', ville = 'Paris', statuts_url = 'https://example.com/statuts-demo.pdf' where id = ${q(orgId)};`)
  sql.push(`update public.organisation_secrets set code_pin_benevole = ${q(DEMO_PIN)} where organisation_id = ${q(orgId)};`)
  sql.push(`insert into public.profils_organisation (utilisateur_id, organisation_id, role, nom_affiche) values (${q(admin.user.id)}, ${q(orgId)}, 'admin', 'Admin démo');`)

  const activites = ['Fête de quartier', 'Collecte de printemps', 'Repas solidaire', 'Assemblée générale']
  const activiteIds = activites.map(() => crypto.randomUUID())
  activites.forEach((nom, i) => sql.push(`insert into public.activites (id, organisation_id, nom, date_debut) values (${q(activiteIds[i])}, ${q(orgId)}, ${q(nom)}, ${q(isoDaysAgo(30 + i * 90))});`))

  // 40 donateurs, environ 140 dons sur deux ans.
  for (let i = 0; i < 40; i++) {
    const personneId = crypto.randomUUID()
    const participantId = crypto.randomUUID()
    const prenom = pick(PRENOMS)
    const nom = pick(NOMS)
    const [cp, ville] = pick(VILLES)
    const email = `${prenom}.${nom}${i}@example.com`.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    sql.push(`insert into public.personnes (id, civilite, nom, prenom, email, adresse, code_postal, ville, pays) values (${q(personneId)}, ${1 + Math.floor(r() * 2)}, ${q(nom)}, ${q(prenom)}, ${q(email)}, ${q(`${1 + Math.floor(r() * 80)} rue de la Paix`)}, ${q(cp)}, ${q(ville)}, 'France');`)
    sql.push(`insert into public.profils_participant (id, personne_id, organisation_id) values (${q(participantId)}, ${q(personneId)}, ${q(orgId)});`)
    const nbDons = 1 + Math.floor(r() * 6)
    for (let d = 0; d < nbDons; d++) {
      const montant = pick([10, 20, 20, 30, 50, 50, 100, 150, 200])
      const activite = r() < 0.4 ? q(pick(activiteIds)) : 'null'
      sql.push(`insert into public.dons (organisation_id, profil_participant_id, activite_id, montant, mode_paiement, date) values (${q(orgId)}, ${q(participantId)}, ${activite}, ${montant}, ${1 + Math.floor(r() * 4)}, ${q(isoDaysAgo(Math.floor(r() * 700)))});`)
    }
  }

  // 30 adhérents avec une ou deux adhésions (date_fin posée par le trigger).
  for (let i = 0; i < 30; i++) {
    const id = crypto.randomUUID()
    const prenom = pick(PRENOMS)
    const nom = pick(NOMS)
    const [cp, ville] = pick(VILLES)
    const tags = r() < 0.3 ? "'{Bénévoles}'" : "'{}'"
    sql.push(`insert into public.adherents (id, organisation_id, civilite, nom, prenom, code_postal, ville, courriel, telephone, tags, consent_rgpd) values (${q(id)}, ${q(orgId)}, ${1 + Math.floor(r() * 2)}, ${q(nom)}, ${q(prenom)}, ${q(cp)}, ${q(ville)}, ${q(`adherent${i}@example.com`)}, ${q(`06${String(10000000 + Math.floor(r() * 89999999))}`)}, ${tags}, true);`)
    const debut = Math.floor(r() * 500)
    sql.push(`insert into public.adhesions (adherent_id, date_debut, montant_cotisation, date_paiement_cotisation, mode_paiement) values (${q(id)}, ${q(isoDaysAgo(debut))}, 20, ${q(isoDaysAgo(debut))}, ${1 + Math.floor(r() * 4)});`)
  }

  await pg.exec(sql.join('\n'))
}
