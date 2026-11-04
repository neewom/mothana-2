import { createClient, type SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { genererRecu } from '../_shared/genererRecu.ts'
import { secretsEgaux } from '../_shared/webhookSecret.ts'
import { classerResultatLot } from './resultat.ts'

// Traitement des lots de reçus fiscaux côté serveur (carte « Reçus en lot 1/5 »,
// migration recus_lots.sql). Appelée chaque minute par pg_cron + pg_net
// (public.planifier_traitement_lots_recus), seulement quand un lot attend : la tâche planifiée ne fait
// qu'une lecture sinon.
//
// Une exécution prend un lot à la fois (bail en base : une seule exécution par lot, les numéros sont
// attribués dans l'ordre des lignes), génère ses lignes par rang avec le cœur partagé de generate-recu
// (_shared/genererRecu.ts) jusqu'à MAX_LIGNES ou BUDGET_MS, puis libère le bail. Erreur passagère
// (Gotenberg, réseau, Storage, conflit) : la ligne est retentée au passage suivant (3 tentatives au
// total) et le lot n'avance pas d'ici là, pour garder l'ordre des numéros. Erreur définitive (fiche
// incomplète, aucun don, numéro de donateur absent…) : la ligne passe en échec avec la raison.
//
// Déploiement (le secret partagé remplace la vérification JWT : appel de pg_net, sans utilisateur) :
//   npx supabase functions deploy traiter-lots-recus --no-verify-jwt
// Secrets, une fois par projet (jamais dans le dépôt) :
//   S=$(openssl rand -hex 32)
//   npx supabase secrets set TRAITER_LOTS_RECUS_SECRET=$S
//   SQL : select vault.create_secret('<S>', 'traiter_lots_recus_secret');
//         select vault.create_secret('https://<ref>.supabase.co/functions/v1/traiter-lots-recus', 'traiter_lots_recus_url');

// Paquet par exécution : la limite de temps CPU d'une Edge Function (2 s, entrées/sorties non comptées)
// et la durée murale (150 s en gratuit, 400 s en Pro) bornent une exécution ; la tâche repasse chaque minute.
const MAX_LIGNES = 25
const BUDGET_MS = 90_000
// Bail renouvelé à chaque ligne : couvre largement une génération (Gotenberg compris).
const BAIL_SECONDES = 180

interface Lot {
  lot_id: string
  organisation_id: string
  annee: number
  cree_par: string | null
}

interface Ligne {
  ligne_id: string
  profil_participant_id: string
  tentatives: number
}

async function traiter(adminClient: SupabaseClient, gotenbergUrl: string): Promise<Record<string, number>> {
  const debut = Date.now()
  const bilan = { lots: 0, faits: 0, echecs: 0, reessais: 0 }
  const vus: string[] = []

  while (bilan.faits + bilan.echecs + bilan.reessais < MAX_LIGNES && Date.now() - debut < BUDGET_MS) {
    const { data: lots, error: lotError } = await adminClient.rpc('prendre_lot_recus', {
      p_bail_secondes: BAIL_SECONDES,
      p_exclure: vus,
    })
    if (lotError) {
      console.error('prendre_lot_recus error:', lotError)
      break
    }
    const lot = (lots as Lot[] | null)?.[0]
    if (!lot) break
    vus.push(lot.lot_id)
    bilan.lots++

    try {
      while (bilan.faits + bilan.echecs + bilan.reessais < MAX_LIGNES && Date.now() - debut < BUDGET_MS) {
        const { data: lignes, error: ligneError } = await adminClient.rpc('ligne_suivante_lot_recus', {
          p_lot_id: lot.lot_id,
          p_bail_secondes: BAIL_SECONDES,
        })
        if (ligneError) {
          console.error('ligne_suivante_lot_recus error:', ligneError)
          break
        }
        const ligne = (lignes as Ligne[] | null)?.[0]
        if (!ligne) break // lot terminé ou arrêté

        let classe
        try {
          const resultat = await genererRecu(adminClient, {
            organisationId: lot.organisation_id,
            profilParticipantId: ligne.profil_participant_id,
            annee: lot.annee,
            generePar: lot.cree_par,
            gotenbergUrl,
            seulementSiAbsent: true,
          })
          classe = classerResultatLot(resultat)
        } catch (err) {
          console.error('traiter-lots-recus generation error:', err)
          classe = classerResultatLot(null, err)
        }

        const { data: statut, error: finError } = await adminClient.rpc('terminer_ligne_lot_recus', {
          p_ligne_id: ligne.ligne_id,
          p_resultat: classe.resultat,
          p_erreur: classe.erreur,
          p_recu_id: classe.recuId,
          p_recu_preexistant: classe.recuPreexistant,
        })
        if (finError) {
          // La ligne reste « en_cours » : reprise au passage suivant (un reçu déjà créé est reconnu).
          console.error('terminer_ligne_lot_recus error:', finError)
          break
        }
        if (statut === 'fait') bilan.faits++
        else if (statut === 'echec') bilan.echecs++
        else {
          // Erreur passagère : ce lot attend le passage suivant (ordre des numéros conservé).
          bilan.reessais++
          break
        }
      }
    } finally {
      const { error: libererError } = await adminClient.rpc('liberer_lot_recus', { p_lot_id: lot.lot_id })
      if (libererError) console.error('liberer_lot_recus error:', libererError)
    }
  }

  return bilan
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Méthode non autorisée' }), { status: 405 })
  }

  const attendu = Deno.env.get('TRAITER_LOTS_RECUS_SECRET') ?? null
  if (!secretsEgaux(req.headers.get('x-traitement-secret'), attendu)) {
    return new Response(JSON.stringify({ error: 'Non autorisé' }), { status: 401 })
  }

  const adminClient = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
    auth: { persistSession: false },
  })
  const gotenbergUrl = Deno.env.get('GOTENBERG_URL')!

  // Réponse immédiate (pg_net n'attend pas) ; le traitement continue en tâche de fond jusqu'à son budget.
  const travail = traiter(adminClient, gotenbergUrl)
    .then((bilan) => console.log('traiter-lots-recus:', JSON.stringify(bilan)))
    .catch((err) => console.error('traiter-lots-recus error:', err))
  // EdgeRuntime : global du runtime Supabase (absent en local avec deno test / deno run)
  const runtime = (globalThis as { EdgeRuntime?: { waitUntil(p: Promise<unknown>): void } }).EdgeRuntime
  if (runtime?.waitUntil) {
    runtime.waitUntil(travail)
    return new Response(JSON.stringify({ ok: true }), { status: 202, headers: { 'Content-Type': 'application/json' } })
  }
  await travail
  return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { 'Content-Type': 'application/json' } })
})
