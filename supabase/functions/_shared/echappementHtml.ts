// Échappement HTML et remplacement des {{variables}} d'un gabarit. Audit sécurité 2026-10-24 :
// toute valeur injectée dans un gabarit est échappée. Module pur (aucune API Deno) : importé par
// html.ts (documents Gotenberg), recuEmail.ts et le front (aperçu de l'email de reçu).

export function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;')
}

// Échappe strictement une valeur texte (aucune balise conservée, `<br>` saisi compris), puis
// rend ses retours à la ligne (`\n`, `\r\n`, `\r`) en `<br>`, ajoutés après l'échappement.
export function escapeHtmlTexte(value: string): string {
  return escapeHtml(value).replace(/\r\n|\r|\n/g, '<br>')
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
    const value = (Object.hasOwn(values, key) ? values[key] : undefined) ?? ''
    return fragmentsHtml.has(key) ? value : escapeHtmlTexte(value)
  })
}
