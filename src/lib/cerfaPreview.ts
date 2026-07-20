// Données d'exemple + rendu HTML pour la prévisualisation des templates de
// reçus fiscaux (étape 6, brief-cerfa.md §7). Mêmes placeholders que
// l'Edge Function generate-recu (brief §2.2), valeurs fictives cohérentes.

export const CERFA_PREVIEW_PLACEHOLDERS: Record<string, string> = {
  organisation_nom: 'Wat Velouvanaram',
  organisation_adresse: '5 All. Madame de Montespan',
  organisation_code_postal: '77600',
  organisation_ville: 'Bussy-Saint-Georges',
  organisation_rna: 'W751234567',
  organisation_siren: '123456789',
  organisation_objet_social: 'Association cultuelle bouddhiste lao',
  organisation_mention_legale: "Organisme d'intérêt général éligible au mécénat – article 200 du CGI",
  donateur_civilite: 'Monsieur',
  donateur_nom_complet: 'M. Jean DUPONT',
  donateur_adresse: '12 rue des Lilas',
  donateur_code_postal: '75011',
  donateur_ville: 'Paris',
  don_montant_chiffres: '150,00 €',
  don_montant_lettres: 'Cent cinquante euros',
  don_annee: '2026',
  recu_numero_ordre: '2026-042',
  recu_date_generation: '18/07/2026',
  type_reduction: '66%',
}

// Placeholders obligatoires sur un reçu Cerfa légalement valide (voir
// docs/regles-recus-fiscaux.md) — tous sauf donateur_civilite (redondant avec
// donateur_nom_complet) et type_reduction (informatif, pas une obligation
// légale d'impression). RNA/SIREN : un seul des deux suffit, même règle que
// la validation organisation (cerfaValidation.ts).
export const CERFA_MANDATORY_KEYS = [
  'organisation_nom', 'organisation_adresse', 'organisation_code_postal', 'organisation_ville',
  'organisation_objet_social', 'organisation_mention_legale',
  'donateur_nom_complet', 'donateur_adresse', 'donateur_code_postal', 'donateur_ville',
  'don_montant_chiffres', 'don_montant_lettres', 'don_annee',
  'recu_numero_ordre', 'recu_date_generation',
] as const

export const CERFA_RNA_SIREN_GROUP = ['organisation_rna', 'organisation_siren'] as const

export function getMissingMandatoryPlaceholders(html: string): string[] {
  const missing: string[] = CERFA_MANDATORY_KEYS.filter((key) => !html.includes(`{{${key}}}`))
  const hasRnaOrSiren = CERFA_RNA_SIREN_GROUP.some((key) => html.includes(`{{${key}}}`))
  return hasRnaOrSiren ? missing : [...missing, 'organisation_rna ou organisation_siren']
}

export function renderCerfaPreviewHtml(html: string, css: string): string {
  let body = html
  for (const [key, value] of Object.entries(CERFA_PREVIEW_PLACEHOLDERS)) {
    body = body.split(`{{${key}}}`).join(value)
  }
  return `<!doctype html><html><head><meta charset="utf-8"><style>${css}</style></head><body>${body}</body></html>`
}
