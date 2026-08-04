// Données d'exemple + rendu HTML pour la prévisualisation des gabarits de
// carte adhérent (module Adhérents, étape 5). Mêmes principes que
// lib/cerfaPreview.ts, réutilise directement fetchOrganisationAssets /
// fetchOrganisationPreviewOverrides (génériques, pas spécifiques au Cerfa).

export const CARTE_PREVIEW_PLACEHOLDERS: Record<string, string> = {
  organisation_nom: 'Wat Velouvanaram',
  adherent_civilite: 'Monsieur',
  adherent_nom_complet: 'Jean DUPONT',
  // Optionnel — uniquement renseigné pour les adhérents importés (legacy) ou,
  // à terme, incrémenté automatiquement à la création (cf. backlog CLAUDE.md).
  adherent_id_externe: 'ADH-0042',
  adhesion_date_debut: '15/01/2026',
  adhesion_date_fin: '15/01/2027',
  president_nom: 'Nicolas Boulom',
  president_titre: 'Président',
}

// Pas d'obligation légale ici (contrairement au Cerfa) — juste de quoi
// éviter une carte vide.
export const CARTE_MANDATORY_KEYS = ['adherent_nom_complet'] as const

export function getMissingMandatoryCartePlaceholders(html: string): string[] {
  return CARTE_MANDATORY_KEYS.filter((key) => !html.includes(`{{${key}}}`))
}

export function renderCartePreviewHtml(
  html: string,
  css: string,
  extraPlaceholders: Record<string, string> = {},
): string {
  let body = html
  for (const [key, value] of Object.entries({ ...CARTE_PREVIEW_PLACEHOLDERS, ...extraPlaceholders })) {
    body = body.split(`{{${key}}}`).join(value)
  }
  // Centré sur fond gris pour l'aperçu — la carte fait ~324×204px à l'écran
  // (85,6×54mm), sans ça elle s'affiche minuscule en haut à gauche.
  return `<!doctype html><html><head><meta charset="utf-8"><style>body { margin: 0; min-height: 100vh; display: flex; align-items: center; justify-content: center; background: #f1f5f9; } ${css}</style></head><body>${body}</body></html>`
}
