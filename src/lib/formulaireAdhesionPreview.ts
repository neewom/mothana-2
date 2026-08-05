// Données par défaut + rendu HTML pour l'en-tête/pied de page personnalisables
// du formulaire public de demande d'adhésion (le formulaire central reste
// inchangé, cf. CLAUDE.md § Adhérents). Même mécanique de placeholders
// {{asset_<identifiant>}} que les templates Cerfa/carte adhérent (cerfaPreview.ts).

// Reproduit exactement l'en-tête codé en dur historique de DemandeAdhesionPage
// (titre + nom organisation) : c'est la valeur pré-remplie dans l'éditeur tant
// que l'organisation n'a rien personnalisé, pour que l'admin parte de l'existant.
export const DEFAULT_FORMULAIRE_ADHESION_HEADER_HTML = `<div class="demande-adhesion-header">
  <h1>Demande d'adhésion</h1>
  <p>{{organisation_nom}}</p>
</div>`

export const DEFAULT_FORMULAIRE_ADHESION_FOOTER_HTML = ''

export const DEFAULT_FORMULAIRE_ADHESION_CSS = `.demande-adhesion-header {
  text-align: center;
  margin-bottom: 24px;
}
.demande-adhesion-header h1 {
  font-size: 24px;
  font-weight: 700;
  color: #0f172a;
  margin: 0;
}
.demande-adhesion-header p {
  margin-top: 4px;
  font-size: 14px;
  color: #64748b;
}`

export const FORMULAIRE_ADHESION_PREVIEW_PLACEHOLDERS: Record<string, string> = {
  organisation_nom: 'Wat Velouvanaram',
}

export function substituteFormulaireAdhesionPlaceholders(
  html: string,
  values: Record<string, string>,
): string {
  let body = html
  for (const [key, value] of Object.entries(values)) {
    body = body.split(`{{${key}}}`).join(value)
  }
  return body
}

// Aperçu iframe côté éditeur (admin only) : le formulaire central est un
// simple bloc de substitution visuelle, il n'est jamais personnalisable.
export function renderFormulaireAdhesionPreviewHtml(
  headerHtml: string,
  footerHtml: string,
  css: string,
  extraPlaceholders: Record<string, string> = {},
): string {
  const values = { ...FORMULAIRE_ADHESION_PREVIEW_PLACEHOLDERS, ...extraPlaceholders }
  const header = substituteFormulaireAdhesionPlaceholders(headerHtml, values)
  const footer = substituteFormulaireAdhesionPlaceholders(footerHtml, values)

  return `<!doctype html><html><head><meta charset="utf-8"><style>
    body { margin: 0; padding: 24px; background: #f8fafc; font-family: ui-sans-serif, system-ui, sans-serif; }
    .formulaire-adhesion-preview-wrap { max-width: 480px; margin: 0 auto; }
    .formulaire-central-stub {
      border: 1px dashed #cbd5e1;
      border-radius: 12px;
      padding: 32px 16px;
      text-align: center;
      color: #94a3b8;
      font-size: 13px;
      background: #ffffff;
    }
    ${css}
  </style></head><body>
    <div class="formulaire-adhesion-preview-wrap">
      ${header}
      <div class="formulaire-central-stub">Formulaire (contenu central, inchangé)</div>
      ${footer}
    </div>
  </body></html>`
}
