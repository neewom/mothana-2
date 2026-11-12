// Validation d'une demande d'inscription par le super-admin (carte https://trello.com/c/hNqpdZXL) :
// « Créer l'organisation » dans /super-admin.
//
//   1. super-admin seul (401 sans session valide, 403 sinon) ;
//   2. la demande en attente est réservée (passe en `acceptee`) avant toute création : deux clics
//      simultanés ne créent pas deux organisations ;
//   3. organisation créée par le cœur partagé (_shared/creerOrganisation.ts) : slug rendu unique,
//      dons + adhérents activés, RNA / SIREN reportés dans modele_recu_pdf ; en cas d'échec, la
//      demande revient en attente ;
//   4. admin créé et invité comme le fait create-admin (_shared/inviterAdmin.ts), avec l'invitation
//      dédiée à l'inscription. Si l'invitation échoue, la demande garde l'organisation et l'erreur :
//      un nouvel appel relance l'invitation seule (jamais de seconde organisation).
import { createClient, type SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { creerOrganisation } from '../_shared/creerOrganisation.ts'
import { inviterAdminDemande } from './invitation.ts'
import { normaliseSiteUrl } from '../_shared/siteUrl.ts'
import { slugDisponible, slugifyUrl } from '../_shared/slug.ts'
import { LONGUEURS_INSCRIPTION } from '../_shared/inscription.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

interface Demande {
  id: string
  nom_association: string
  ville: string
  rna: string | null
  siren: string | null
  prenom: string
  nom: string
  email: string
  statut: 'en_attente' | 'acceptee' | 'refusee'
  organisation_id: string | null
  admin_utilisateur_id: string | null
  invitation_envoyee_le: string | null
}

async function slugLibre(client: SupabaseClient, base: string): Promise<string> {
  // `base` ne contient que [a-z0-9-] (slugifyUrl) : aucun caractère spécial pour LIKE.
  const { data } = await client.from('organisations').select('slug').like('slug', `${base}%`)
  return slugDisponible(base, ((data ?? []) as { slug: string | null }[]).map((o) => o.slug ?? ''))
}

async function remettreEnAttente(client: SupabaseClient, id: string): Promise<void> {
  const { error } = await client
    .from('demandes_inscription')
    .update({ statut: 'en_attente', traitee_par: null, traitee_le: null })
    .eq('id', id)
  if (error) console.error('valider-demande-inscription : remise en attente impossible', id, error.message)
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'Méthode non autorisée' }, 405)

  // Demande réservée par cet appel et pas encore d'organisation : à remettre en attente si une
  // erreur imprévue interrompt le traitement.
  let reserveeSansOrganisation: { client: SupabaseClient; id: string } | null = null

  try {
    const token = (req.headers.get('Authorization') ?? '').replace('Bearer ', '')
    if (!token) return json({ error: 'Authorization header manquant' }, 401)

    const adminClient = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
      auth: { persistSession: false },
    })

    const { data: { user }, error: userError } = await adminClient.auth.getUser(token)
    if (userError || !user) return json({ error: 'Session invalide' }, 401)
    if (user.app_metadata?.is_super_admin !== true) return json({ error: 'Accès refusé — réservé au super-admin' }, 403)

    const body = await req.json().catch(() => null)
    const demandeId = body && typeof body.demande_id === 'string' ? body.demande_id : ''
    const siteUrl = normaliseSiteUrl(body?.site_url)
    if (!UUID.test(demandeId) || !siteUrl) return json({ error: 'Paramètres manquants : demande_id, site_url' }, 400)

    const { data: lue, error: lectureError } = await adminClient
      .from('demandes_inscription')
      .select('id, nom_association, ville, rna, siren, prenom, nom, email, statut, organisation_id, admin_utilisateur_id, invitation_envoyee_le')
      .eq('id', demandeId)
      .maybeSingle()
    if (lectureError) return json({ error: lectureError.message }, 500)
    if (!lue) return json({ error: 'Demande introuvable' }, 404)
    let demande = lue as Demande

    if (demande.statut === 'refusee') return json({ error: 'Cette demande a été refusée.' }, 409)
    if (demande.statut === 'acceptee' && demande.invitation_envoyee_le) {
      return json({ error: 'Cette demande a déjà été traitée.' }, 409)
    }

    if (demande.statut === 'en_attente') {
      const nom = typeof body?.nom === 'string' && body.nom.trim() ? body.nom.trim() : demande.nom_association
      if (nom.length < LONGUEURS_INSCRIPTION.nom_association.min || nom.length > LONGUEURS_INSCRIPTION.nom_association.max) {
        return json({ error: `Le nom doit compter entre ${LONGUEURS_INSCRIPTION.nom_association.min} et ${LONGUEURS_INSCRIPTION.nom_association.max} caractères.` }, 400)
      }
      const base = slugifyUrl(nom)
      if (!base) return json({ error: 'Nom invalide pour générer un identifiant', code: 'NOM_INVALIDE' }, 400)

      // Réservation : seule la requête qui fait passer la demande en `acceptee` poursuit.
      const { data: reservee } = await adminClient
        .from('demandes_inscription')
        .update({ statut: 'acceptee', traitee_par: user.id, traitee_le: new Date().toISOString() })
        .eq('id', demande.id)
        .eq('statut', 'en_attente')
        .select('id')
      if (!reservee || reservee.length === 0) return json({ error: 'Cette demande est déjà en cours de traitement.' }, 409)
      reserveeSansOrganisation = { client: adminClient, id: demande.id }

      const modeleRecuPdf: Record<string, string> = {}
      if (demande.rna) modeleRecuPdf.rna = demande.rna
      if (demande.siren) modeleRecuPdf.siren = demande.siren

      // Slug libre au moment de la lecture ; une création concurrente homonyme → on retente.
      const parametres = {
        nom,
        fonctionnalitesActivees: { dons: true, adherents: true },
        modeleRecuPdf: Object.keys(modeleRecuPdf).length > 0 ? modeleRecuPdf : undefined,
        ville: demande.ville,
      }
      let resultat = await creerOrganisation(adminClient, { ...parametres, slug: await slugLibre(adminClient, base) })
      for (let essai = 0; !resultat.ok && resultat.code === 'DOUBLON' && essai < 2; essai++) {
        resultat = await creerOrganisation(adminClient, { ...parametres, slug: await slugLibre(adminClient, base) })
      }

      if (!resultat.ok) {
        await remettreEnAttente(adminClient, demande.id)
        reserveeSansOrganisation = null
        console.error('valider-demande-inscription : création refusée', resultat.code, resultat.message)
        return json({ error: resultat.message, code: resultat.code }, resultat.code === 'ERREUR' ? 500 : 400)
      }
      reserveeSansOrganisation = null

      // Rattachement de l'organisation à la demande (retenté : sans lui, l'organisation serait
      // orpheline et la demande bloquée).
      let rattachement = await adminClient.from('demandes_inscription').update({ organisation_id: resultat.organisationId }).eq('id', demande.id)
      for (let essai = 0; rattachement.error && essai < 2; essai++) {
        rattachement = await adminClient.from('demandes_inscription').update({ organisation_id: resultat.organisationId }).eq('id', demande.id)
      }
      if (rattachement.error) {
        console.error('valider-demande-inscription : rattachement en échec', resultat.organisationId, rattachement.error.message)
        return json({
          error: `Organisation créée (${resultat.organisationId}) mais non rattachée à la demande : invite l'admin depuis la fiche de l'organisation.`,
          organisation_id: resultat.organisationId,
        }, 500)
      }
      demande = { ...demande, statut: 'acceptee', organisation_id: resultat.organisationId }
    }

    // Demande acceptée : (re)tentative de création de l'admin et de son invitation.
    if (!demande.organisation_id) {
      return json({ error: "L'organisation de cette demande n'existe plus : traite-la à la main." }, 409)
    }
    const erreurInvitation = await inviterAdminDemande(adminClient, {
      id: demande.id,
      prenom: demande.prenom,
      nom: demande.nom,
      email: demande.email,
      organisation_id: demande.organisation_id,
      admin_utilisateur_id: demande.admin_utilisateur_id,
    }, siteUrl)

    return json({
      organisation_id: demande.organisation_id,
      invitation_envoyee: !erreurInvitation,
      erreur_invitation: erreurInvitation,
    }, 200)
  } catch (err) {
    console.error('valider-demande-inscription :', err)
    if (reserveeSansOrganisation) await remettreEnAttente(reserveeSansOrganisation.client, reserveeSansOrganisation.id).catch(() => {})
    return json({ error: 'Erreur interne' }, 500)
  }
})
