// Rendu HTML des documents envoyés à Gotenberg (reçus, cartes, étiquettes, QR portefeuille).
// Audit sécurité 2026-10-24 : toute valeur injectée dans un gabarit est échappée — des
// données saisies par des visiteurs (demande d'adhésion) arrivent jusque dans ces PDF.

export function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;')
}

// Échappe une valeur texte en gardant les retours à la ligne `<br>` déjà saisis dans
// certains champs de configuration (ex. objet social d'une organisation réelle) : seule
// balise conservée, sans attribut, donc sans contenu actif possible.
export function escapeHtmlTexte(value: string): string {
  return escapeHtml(value).replace(/&lt;br\s*\/?&gt;/gi, '<br>')
}

// Remplace les {{variables}} d'un gabarit par leurs valeurs échappées. `fragmentsHtml` liste
// les clés dont la valeur est un fragment HTML construit par la fonction elle-même à partir
// de parties déjà échappées (ex. dons_detail) : insérées telles quelles.
export function renderTemplate(
  html: string,
  values: Record<string, string>,
  fragmentsHtml: ReadonlySet<string> = new Set(),
): string {
  return html.replace(/\{\{(\w+)\}\}/g, (_, key: string) => {
    const value = values[key] ?? ''
    return fragmentsHtml.has(key) ? value : escapeHtmlTexte(value)
  })
}

// Délai maximal d'une conversion Gotenberg : une planche de plusieurs centaines d'étiquettes
// reste sous la dizaine de secondes ; au-delà, le service est considéré indisponible.
export const GOTENBERG_TIMEOUT_MS = 60_000

export function convertirHtmlEnPdf(gotenbergUrl: string, form: FormData): Promise<Response> {
  return fetch(`${gotenbergUrl}/forms/chromium/convert/html`, {
    method: 'POST',
    body: form,
    signal: AbortSignal.timeout(GOTENBERG_TIMEOUT_MS),
  })
}
