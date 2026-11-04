import type { RecuLot, RecuLotType } from '../types/recusLot'

/**
 * Lot encore actif côté serveur : en cours, ou arrêté alors qu'une exécution tient encore le bail
 * (le reçu en cours de génération au moment de l'arrêt se termine et est compté ensuite).
 */
export function lotActif(lot: Pick<RecuLot, 'statut' | 'traitement_jusqu_a'>, maintenant: number): boolean {
  if (lot.statut === 'en_cours') return true
  return lot.statut === 'arrete' && !!lot.traitement_jusqu_a && new Date(lot.traitement_jusqu_a).getTime() > maintenant
}

/** Reçus traités d'un lot : générés ou envoyés, en échec définitif, à vérifier (envoi ambigu). */
export function lotTraites(lot: Pick<RecuLot, 'nb_faits' | 'nb_echecs'> & Partial<Pick<RecuLot, 'nb_a_verifier'>>): number {
  return lot.nb_faits + lot.nb_echecs + (lot.nb_a_verifier ?? 0)
}

/**
 * Temps restant estimé d'un lot en cours (ms), au rythme moyen observé depuis son lancement.
 * null tant qu'aucun reçu n'est traité (le premier passage de la tâche planifiée a lieu dans la
 * minute) ou si le lot n'est plus en cours.
 */
export function estimerTempsRestant(
  lot: Pick<RecuLot, 'statut' | 'cree_le' | 'nb_total' | 'nb_faits' | 'nb_echecs'>,
  maintenant: number,
): number | null {
  if (lot.statut !== 'en_cours') return null
  const traites = lotTraites(lot)
  const ecoule = maintenant - new Date(lot.cree_le).getTime()
  if (traites <= 0 || ecoule <= 0) return null
  const restants = Math.max(0, lot.nb_total - traites)
  return Math.round((ecoule / traites) * restants)
}

// Rythme mesuré du traitement serveur (carte 1) : ≈ 25 reçus par passage de la tâche planifiée,
// un passage par minute.
const RECUS_PAR_MINUTE = 25

/** Durée prévisible d'un lot de n reçus (ms), avant lancement : premier passage dans la minute compris. */
export function estimerDureeLot(n: number): number {
  return (Math.ceil(n / RECUS_PAR_MINUTE) + 1) * 60_000
}

/** Durée approximative : « moins d'une minute », « environ 12 min », « environ 1 h 05 ». */
export function formatDureeApprox(ms: number): string {
  const minutes = Math.round(ms / 60_000)
  if (minutes < 1) return "moins d'une minute"
  if (minutes < 60) return `environ ${minutes} min`
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return `environ ${h} h ${String(m).padStart(2, '0')}`
}

/** Temps restant : « moins d'une minute restante », « environ 12 min restantes »… */
export function formatTempsRestant(ms: number): string {
  const minutes = Math.round(ms / 60_000)
  return `${formatDureeApprox(ms)} ${minutes >= 2 ? 'restantes' : 'restante'}`
}

/** Message affiché pour une erreur des RPC lancer_lot_recus / arreter_lot_recus. */
export function messageErreurLot(message: string | undefined | null): string {
  const m = message ?? ''
  if (m.includes('LOT_DEJA_EN_COURS')) return 'Un lot est déjà en cours pour cette année.'
  if (m.includes('AUCUN_RECU_MANQUANT')) return 'Aucun reçu manquant prêt à générer pour cette année.'
  if (m.includes('LOT_NON_EN_COURS')) return "Ce lot n'est plus en cours."
  if (m.includes('ACCES_REFUSE')) return "Vous n'avez pas les droits pour gérer les lots de reçus de cette organisation."
  if (m.includes('ANNEE_INVALIDE')) return 'Année invalide.'
  if (m.includes('AUCUN_RECU_A_ENVOYER')) return 'Aucun reçu à envoyer pour cette année.'
  if (m.includes('ENVOI_EN_COURS')) return "L'envoi arrêté termine l'email en cours : réessayez dans quelques minutes."
  if (m.includes('GENERATION_EN_COURS')) return 'Une génération des reçus de cette année est en cours : attendez sa fin pour lancer l’envoi.'
  if (m.includes('LOT_INTROUVABLE')) return 'Ce lot est introuvable : rechargez la page.'
  // Code inconnu : jamais affiché brut.
  return 'Une erreur est survenue. Réessayez ou rechargez la page.'
}

/** Message de lancement d'un lot, avec le nombre de reçus retenu par le serveur (null : inconnu). */
export function messageLancementLot(type: RecuLotType, nbTotal: number | null): string {
  const action = type === 'envoi' ? 'Envoi' : 'Génération'
  const accord = type === 'envoi' ? 'lancé' : 'lancée'
  if (nbTotal === null) return `${action} des reçus ${accord}`
  return `${action} de ${new Intl.NumberFormat('fr-FR').format(nbTotal)} reçu${nbTotal > 1 ? 's' : ''} ${accord}`
}

// ---------------------------------------------------------------------------
// Lots d'envoi (carte « Reçus en lot 4/5 ») : rythme réglé par l'organisation
// ---------------------------------------------------------------------------

export interface RythmeEnvoi {
  parJour: number
  parMinute: number
}

// Mêmes défauts et bornes que public.rythme_envoi_recus (recus_lots_envoi.sql).
export const RYTHME_ENVOI_DEFAUT: RythmeEnvoi = { parJour: 250, parMinute: 5 }
export const RYTHME_ENVOI_BORNES = { parJour: { min: 1, max: 10_000 }, parMinute: { min: 1, max: 60 } }

/** Valeur stockée (modele_recu_pdf.envoi_lot_par_jour / _par_minute) → rythme, défaut hors bornes. */
export function rythmeEnvoi(modele: { envoi_lot_par_jour?: unknown; envoi_lot_par_minute?: unknown } | null | undefined): RythmeEnvoi {
  const lire = (v: unknown, b: { min: number; max: number }, defaut: number) =>
    typeof v === 'number' && Number.isInteger(v) && v >= b.min && v <= b.max ? v : defaut
  return {
    parJour: lire(modele?.envoi_lot_par_jour, RYTHME_ENVOI_BORNES.parJour, RYTHME_ENVOI_DEFAUT.parJour),
    parMinute: lire(modele?.envoi_lot_par_minute, RYTHME_ENVOI_BORNES.parMinute, RYTHME_ENVOI_DEFAUT.parMinute),
  }
}

/**
 * Durée prévisible de l'envoi de n emails (ms) au rythme donné : la tâche planifiée passe chaque
 * minute ; au-delà du quota du jour (diminué des envois des dernières 24 h), l'envoi reprend 24 h
 * après le début de chaque tranche.
 */
export function estimerDureeEnvoi(n: number, rythme: RythmeEnvoi, envoyes24h = 0): number {
  if (n <= 0) return 0
  const minutesTranche = (k: number) => Math.ceil(k / rythme.parMinute)
  const premiere = Math.max(0, rythme.parJour - envoyes24h)
  if (n <= premiere) return (minutesTranche(n) + 1) * 60_000
  const reste = n - premiere
  const tranchesSuivantes = Math.ceil(reste / rythme.parJour)
  const derniere = reste - (tranchesSuivantes - 1) * rythme.parJour
  return (tranchesSuivantes * 24 * 60 + minutesTranche(derniere) + 1) * 60_000
}

/** « environ 12 min », « environ 2 h 05 », « environ 4 jours ». */
export function formatDureeEnvoi(ms: number): string {
  const jours = ms / 86_400_000
  if (jours < 1) return formatDureeApprox(ms)
  const arrondi = Math.ceil(jours)
  return `environ ${arrondi} jour${arrondi > 1 ? 's' : ''}`
}
