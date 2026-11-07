import type { RecuLot } from '../types/recusLot'

/**
 * Lot encore actif côté serveur : en cours, ou arrêté alors qu'une exécution tient encore le bail
 * (le reçu en cours de génération au moment de l'arrêt se termine et est compté ensuite).
 */
export function lotActif(lot: Pick<RecuLot, 'statut' | 'traitement_jusqu_a'>, maintenant: number): boolean {
  if (lot.statut === 'en_cours') return true
  return lot.statut === 'arrete' && !!lot.traitement_jusqu_a && new Date(lot.traitement_jusqu_a).getTime() > maintenant
}

/** Reçus traités (générés ou en échec définitif) d'un lot. */
export function lotTraites(lot: Pick<RecuLot, 'nb_faits' | 'nb_echecs'>): number {
  return lot.nb_faits + lot.nb_echecs
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
  if (m.includes('LOT_INTROUVABLE')) return 'Ce lot est introuvable : rechargez la page.'
  // Code inconnu : jamais affiché brut.
  return 'Une erreur est survenue. Réessayez ou rechargez la page.'
}

/** Message de lancement d'un lot, avec le nombre de reçus retenu par le serveur (null : inconnu). */
export function messageLancementLot(nbTotal: number | null): string {
  if (nbTotal === null) return 'Génération des reçus lancée'
  return `Génération de ${new Intl.NumberFormat('fr-FR').format(nbTotal)} reçu${nbTotal > 1 ? 's' : ''} lancée`
}
