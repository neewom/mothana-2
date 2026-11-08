// Rattrapage ponctuel des adresses invalides non signalées (carte Trello tr1BGQ5M, 2026-11-08).
//
// Pourquoi : avant le correctif du webhook (noms hard_bounce / hardBounce) et la souscription de
// softBounce (domaine introuvable), des rejets Brevo n'ont jamais marqué les fiches. Ce script
// relit les événements Brevo des N derniers jours (90 au plus, limite de l'API) de chaque
// organisation, les trie avec **le même `classerRejet`** que brevo-bounce-webhook (aucun refus
// côté expéditeur ne marque une fiche, un soft bounce ne compte que si le domaine est
// introuvable) et retrouve les fiches comme le webhook : tag `profil:` d'un reçu fiscal, sinon
// donateur par adresse (`profils_donateur_par_emails`) pour un reçu, sinon adhérents par adresse
// (`adherents_par_emails`).
//
// Par défaut le script N'ÉCRIT RIEN : il produit un CSV (organisation, type de fiche, id, nom,
// email, événement, raison, date, déjà marqué, livré depuis le rejet) à faire relire. Avec
// `--appliquer`, il marque uniquement les fiches non encore marquées (`email_invalide_at` nul,
// condition reprise dans l'UPDATE) et dont l'adresse n'a reçu aucun email livré après le rejet ;
// `email_invalide_at` prend la date du rejet. `--appliquer` exige `--projet <ref>` identique au
// projet de SUPABASE_URL (garde-fou contre une exécution sur le mauvais projet).
//
// Clé Brevo de chaque organisation lue dans organisation_secrets avec la clé service_role, passée
// en variable d'environnement (jamais en dur ni commitée).
//
// Usage (depuis la racine du dépôt) :
//   SUPABASE_URL=https://<ref>.supabase.co SUPABASE_SERVICE_ROLE_KEY=<clé> \
//     deno run --no-lock --allow-net --allow-env --allow-write scripts/brevo-rattrapage-rejets.ts \
//     (--organisation <uuid> | --toutes) [--jours 90] [--sortie rattrapage.csv] \
//     [--appliquer --projet <ref>]

import { createClient, type SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { parseArgs } from 'jsr:@std/cli@1/parse-args'
import { cibleRejet } from '../supabase/functions/_shared/brevo.ts'
import { classerRejet, evenementDepuisStatistiques, normaliserEmail } from '../supabase/functions/_shared/brevoRejets.ts'

const TYPES_REJET = ['hardBounces', 'softBounces', 'blocked', 'invalid', 'error'] as const
const TAILLE_PAGE = 2500
const TAILLE_LOT_IDS = 200

interface EvenementStat {
  email?: string
  date?: string
  event?: string
  reason?: string
  tag?: string
}

interface Rejet {
  email: string // normalisé
  evenementBrevo: string
  evenementNormalise: string
  raison: string | null
  date: string
  profilParticipantId: string | null
  type: 'adherent' | 'donateur'
}

interface Ligne {
  organisationId: string
  organisation: string
  type: 'adherent' | 'donateur'
  ficheId: string
  nom: string
  email: string
  rejet: Rejet
  dejaMarque: boolean
  livreeApresRejet: boolean
}

async function lireEvenements(apiKey: string, type: string, jours: number): Promise<EvenementStat[]> {
  const tous: EvenementStat[] = []
  for (let offset = 0; ; offset += TAILLE_PAGE) {
    const url = `https://api.brevo.com/v3/smtp/statistics/events?event=${type}&days=${jours}&limit=${TAILLE_PAGE}&offset=${offset}&sort=desc`
    const res = await fetch(url, { headers: { 'api-key': apiKey, Accept: 'application/json' } })
    const texte = await res.text()
    if (!res.ok) throw new Error(`Brevo ${type} : HTTP ${res.status} ${texte.slice(0, 200)}`)
    // Aucun événement : Brevo répond {} (constaté sur staging).
    const page = ((texte ? JSON.parse(texte) : {}).events ?? []) as EvenementStat[]
    tous.push(...page)
    if (page.length < TAILLE_PAGE) return tous
  }
}

function enLots<T>(liste: T[], taille: number): T[][] {
  const lots: T[][] = []
  for (let i = 0; i < liste.length; i += taille) lots.push(liste.slice(i, i + taille))
  return lots
}

function plusRecent(a: string, b: string): boolean {
  return new Date(a).getTime() > new Date(b).getTime()
}

async function traiterOrganisation(
  client: SupabaseClient,
  organisationId: string,
  nomOrganisation: string,
  apiKey: string,
  jours: number,
): Promise<{ lignes: Ligne[]; stats: Record<string, number> }> {
  const stats: Record<string, number> = { evenements: 0, cote_expediteur: 0, rejet_temporaire: 0, adresses_sans_fiche: 0 }

  // Rejet retenu par adresse et par cible : le plus récent qui marque.
  const adherentsParEmail = new Map<string, Rejet>()
  const donateursParEmail = new Map<string, Rejet>()
  const profilsParId = new Map<string, Rejet>()
  for (const type of TYPES_REJET) {
    for (const e of await lireEvenements(apiKey, type, jours)) {
      stats.evenements++
      if (!e.email || !e.date) continue
      const decision = classerRejet(evenementDepuisStatistiques(e.event), e.reason)
      if (!decision.marquer) {
        if (decision.motif in stats) stats[decision.motif]++
        continue
      }
      const cible = cibleRejet({ tag: e.tag })
      const rejet: Rejet = {
        email: normaliserEmail(e.email),
        evenementBrevo: e.event ?? '',
        evenementNormalise: decision.evenement,
        raison: decision.raison,
        date: e.date,
        profilParticipantId: cible.type === 'recu' ? cible.profilParticipantId : null,
        type: cible.type === 'adherent' ? 'adherent' : 'donateur',
      }
      const carte = cible.type === 'adherent' ? adherentsParEmail : cible.profilParticipantId ? profilsParId : donateursParEmail
      const cle = cible.type === 'recu' && cible.profilParticipantId ? cible.profilParticipantId : rejet.email
      const existant = carte.get(cle)
      if (!existant || plusRecent(rejet.date, existant.date)) carte.set(cle, rejet)
    }
  }

  // Dernière livraison par adresse : un email livré après le rejet rend le marquage douteux.
  const derniereLivraison = new Map<string, string>()
  const adresses = new Set([...adherentsParEmail.keys(), ...donateursParEmail.keys(), ...[...profilsParId.values()].map((r) => r.email)])
  if (adresses.size > 0) {
    for (const e of await lireEvenements(apiKey, 'delivered', jours)) {
      if (!e.email || !e.date) continue
      const email = normaliserEmail(e.email)
      if (!adresses.has(email)) continue
      const d = derniereLivraison.get(email)
      if (!d || plusRecent(e.date, d)) derniereLivraison.set(email, e.date)
    }
  }

  const ficheAdherent = new Map<string, Rejet>()
  if (adherentsParEmail.size > 0) {
    const { data, error } = await client.rpc('adherents_par_emails', {
      p_organisation_id: organisationId,
      p_emails: [...adherentsParEmail.keys()],
    })
    if (error) throw new Error(`adherents_par_emails : ${error.message}`)
    const trouves = new Set<string>()
    for (const a of (data ?? []) as { adherent_id: string; email_normalise: string }[]) {
      const rejet = adherentsParEmail.get(a.email_normalise)
      if (rejet) ficheAdherent.set(a.adherent_id, rejet)
      trouves.add(a.email_normalise)
    }
    stats.adresses_sans_fiche += [...adherentsParEmail.keys()].filter((e) => !trouves.has(e)).length
  }

  const ficheProfil = new Map<string, Rejet>(profilsParId)
  if (donateursParEmail.size > 0) {
    const { data, error } = await client.rpc('profils_donateur_par_emails', {
      p_organisation_id: organisationId,
      p_emails: [...donateursParEmail.keys()],
    })
    if (error) throw new Error(`profils_donateur_par_emails : ${error.message}`)
    const trouves = new Set<string>()
    for (const p of (data ?? []) as { profil_id: string; email_normalise: string }[]) {
      const rejet = donateursParEmail.get(p.email_normalise)
      if (rejet && !ficheProfil.has(p.profil_id)) ficheProfil.set(p.profil_id, rejet)
      trouves.add(p.email_normalise)
    }
    stats.adresses_sans_fiche += [...donateursParEmail.keys()].filter((e) => !trouves.has(e)).length
  }

  const lignes: Ligne[] = []
  const livreeApres = (r: Rejet) => {
    const d = derniereLivraison.get(r.email)
    return !!d && plusRecent(d, r.date)
  }

  for (const lot of enLots([...ficheAdherent.keys()], TAILLE_LOT_IDS)) {
    const { data, error } = await client
      .from('adherents')
      .select('id, nom, prenom, courriel, email_invalide_at')
      .eq('organisation_id', organisationId)
      .in('id', lot)
    if (error) throw new Error(`adherents : ${error.message}`)
    for (const a of data ?? []) {
      const rejet = ficheAdherent.get(a.id)!
      lignes.push({
        organisationId, organisation: nomOrganisation, type: 'adherent', ficheId: a.id,
        nom: [a.prenom, a.nom].filter(Boolean).join(' '), email: a.courriel ?? rejet.email, rejet,
        dejaMarque: a.email_invalide_at !== null, livreeApresRejet: livreeApres(rejet),
      })
    }
  }

  // Filtré par organisation : un tag `profil:` d'une autre organisation ne donne rien.
  const profilsTrouves = new Set<string>()
  for (const lot of enLots([...ficheProfil.keys()], TAILLE_LOT_IDS)) {
    const { data, error } = await client
      .from('profils_participant')
      .select('id, email_invalide_at, personnes!inner(nom, prenom, email)')
      .eq('organisation_id', organisationId)
      .in('id', lot)
    if (error) throw new Error(`profils_participant : ${error.message}`)
    for (const p of data ?? []) {
      profilsTrouves.add(p.id)
      const rejet = ficheProfil.get(p.id)!
      const personne = (Array.isArray(p.personnes) ? p.personnes[0] : p.personnes) as { nom?: string; prenom?: string; email?: string } | null
      lignes.push({
        organisationId, organisation: nomOrganisation, type: 'donateur', ficheId: p.id,
        nom: [personne?.prenom, personne?.nom].filter(Boolean).join(' '), email: personne?.email ?? rejet.email, rejet,
        dejaMarque: p.email_invalide_at !== null, livreeApresRejet: livreeApres(rejet),
      })
    }
  }
  stats.adresses_sans_fiche += [...profilsParId.keys()].filter((id) => !profilsTrouves.has(id)).length

  return { lignes, stats }
}

function champCsv(valeur: string): string {
  // Échappement CSV + neutralisation des formules (tableur).
  const v = /^[=+\-@]/.test(valeur) ? `'${valeur}` : valeur
  return /[";\n\r]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v
}

function versCsv(lignes: Ligne[]): string {
  const entete = ['organisation_id', 'organisation', 'type_fiche', 'fiche_id', 'nom', 'email', 'evenement_brevo', 'evenement',
    'raison', 'date_rejet', 'deja_marque', 'livre_apres_rejet', 'action']
  const corps = lignes.map((l) => [
    l.organisationId, l.organisation, l.type, l.ficheId, l.nom, l.email, l.rejet.evenementBrevo, l.rejet.evenementNormalise,
    l.rejet.raison ?? '', l.rejet.date, l.dejaMarque ? 'oui' : 'non', l.livreeApresRejet ? 'oui' : 'non', action(l),
  ].map((c) => champCsv(String(c))).join(';'))
  // BOM : accents lisibles à l'ouverture dans Excel.
  return '﻿' + [entete.join(';'), ...corps].join('\n') + '\n'
}

function action(l: Ligne): string {
  if (l.dejaMarque) return 'deja_marque'
  if (l.livreeApresRejet) return 'a_verifier_livre_depuis'
  return 'a_marquer'
}

async function appliquer(client: SupabaseClient, lignes: Ligne[]): Promise<number> {
  let marquees = 0
  for (const l of lignes.filter((x) => action(x) === 'a_marquer')) {
    const table = l.type === 'adherent' ? 'adherents' : 'profils_participant'
    const { data, error } = await client
      .from(table)
      .update({
        email_invalide_at: new Date(l.rejet.date).toISOString(),
        email_invalide_evenement: l.rejet.evenementNormalise,
        email_invalide_raison: l.rejet.raison,
      })
      .eq('organisation_id', l.organisationId)
      .eq('id', l.ficheId)
      .is('email_invalide_at', null)
      .select('id')
    if (error) throw new Error(`${table} ${l.ficheId} : ${error.message}`)
    marquees += data?.length ?? 0
  }
  return marquees
}

async function main() {
  const args = parseArgs(Deno.args, {
    string: ['organisation', 'jours', 'sortie', 'projet'],
    boolean: ['toutes', 'appliquer', 'aide'],
  })
  if (args.aide || (!args.organisation && !args.toutes) || (args.organisation && args.toutes)) {
    console.error('Usage : (--organisation <uuid> | --toutes) [--jours 90] [--sortie fichier.csv] [--appliquer --projet <ref>]')
    Deno.exit(args.aide ? 0 : 1)
  }
  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!supabaseUrl || !serviceRoleKey) {
    console.error('SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY sont requises (variables d’environnement).')
    Deno.exit(1)
  }
  const ref = new URL(supabaseUrl).hostname.split('.')[0]
  if (args.appliquer && args.projet !== ref) {
    console.error(`--appliquer exige --projet ${ref} (projet de SUPABASE_URL), pour confirmer la cible.`)
    Deno.exit(1)
  }
  const jours = Number(args.jours ?? 90)
  if (!Number.isInteger(jours) || jours < 1 || jours > 90) {
    console.error('--jours : entier entre 1 et 90 (limite de l’API Brevo).')
    Deno.exit(1)
  }
  const sortie = args.sortie ?? `rattrapage-rejets-${ref}-${new Date().toISOString().slice(0, 10)}.csv`
  console.error(`Projet ${ref} · ${jours} jours · ${args.appliquer ? 'MODE APPLICATION' : 'lecture seule'}`)

  const client = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } })
  let requete = client
    .from('organisation_secrets')
    .select('organisation_id, brevo_api_key, organisations(nom)')
    .not('brevo_api_key', 'is', null)
  if (args.organisation) requete = requete.eq('organisation_id', args.organisation)
  const { data: organisations, error } = await requete
  if (error) throw new Error(`organisation_secrets : ${error.message}`)
  if (!organisations?.length) {
    console.error('Aucune organisation avec une clé Brevo.')
    Deno.exit(1)
  }

  const toutes: Ligne[] = []
  for (const o of organisations) {
    const org = o.organisations as { nom?: string } | { nom?: string }[] | null
    const nom = (Array.isArray(org) ? org[0]?.nom : org?.nom) ?? ''
    try {
      const { lignes, stats } = await traiterOrganisation(client, o.organisation_id, nom, o.brevo_api_key as string, jours)
      toutes.push(...lignes)
      const aMarquer = lignes.filter((l) => action(l) === 'a_marquer').length
      console.error(`- ${nom} (${o.organisation_id}) : ${stats.evenements} événements, ${lignes.length} fiches concernées, ` +
        `${aMarquer} à marquer, ${lignes.filter((l) => l.dejaMarque).length} déjà marquées, ` +
        `${lignes.filter((l) => action(l) === 'a_verifier_livre_depuis').length} livrées depuis le rejet ; ignorés : ` +
        `${stats.cote_expediteur} côté expéditeur, ${stats.rejet_temporaire} soft bounces temporaires, ${stats.adresses_sans_fiche} adresses sans fiche`)
    } catch (err) {
      // Une organisation en erreur (clé Brevo révoquée…) n'interrompt pas les suivantes.
      console.error(`- ${nom} (${o.organisation_id}) : ERREUR ${err instanceof Error ? err.message : String(err)}`)
    }
  }

  await Deno.writeTextFile(sortie, versCsv(toutes))
  console.error(`CSV : ${sortie} (${toutes.length} lignes)`)

  if (args.appliquer) {
    const marquees = await appliquer(client, toutes)
    console.error(`Fiches marquées : ${marquees}`)
  }
}

if (import.meta.main) await main()
