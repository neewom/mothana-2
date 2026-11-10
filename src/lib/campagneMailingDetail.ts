// Détail d'une campagne mailing dans l'historique (carte « Emailing : détail figé et notes »,
// 2026-11-09) : libellés et filtre de recherche des destinataires, logique pure.

export type RaisonExclusionCampagne = 'email_manquant' | 'email_invalide' | 'email_rejete'

/** Mêmes raisons que l'aperçu avant envoi (APERCU_COPY de CampagneMailingPage). */
export const RAISON_EXCLUSION_LABELS: Record<RaisonExclusionCampagne, string> = {
  email_manquant: 'Email manquant',
  email_invalide: 'Format d’email invalide',
  email_rejete: 'Adresse rejetée',
}

export const NON_ENREGISTRE = 'Non enregistré (campagne antérieure)'

/** Une campagne envoyée avant la carte n'a ni sélection ni destinataires enregistrés. */
export function estCampagneAnterieure(c: { selection_label: string | null }): boolean {
  return c.selection_label === null
}

/**
 * Nom de l'expéditeur : nom affiché du compte de l'organisation ; un compte hors de
 * l'organisation (super-admin) ou supprimé reste « Un administrateur ».
 */
export function libelleAuteur(envoyePar: string | null, auteurs: ReadonlyMap<string, string>): string {
  if (!envoyePar) return '—'
  return auteurs.get(envoyePar)?.trim() || 'Un administrateur'
}

/**
 * Document de l'aperçu du message (iframe `sandbox` sans scripts ni même origine) : styles
 * minimaux, images contenues, liens ouverts dans un nouvel onglet (`allow-popups`).
 */
export function documentApercuMessage(corpsHtml: string): string {
  return `<!doctype html><html lang="fr"><head><meta charset="utf-8"><base target="_blank"><style>
body{margin:12px;font-family:system-ui,-apple-system,"Segoe UI",sans-serif;font-size:14px;line-height:1.5;overflow-wrap:anywhere}
img{max-width:100%;height:auto}p{margin:0 0 .75em}
</style></head><body>${corpsHtml}</body></html>`
}
