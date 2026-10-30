// Échappement des valeurs injectées dans les aperçus de gabarits (reçus, cartes adhérent).
// Même règle que l'Edge Function (supabase/functions/_shared/html.ts) pour que l'aperçu
// corresponde au PDF : aucune balise saisie ne passe, seuls les retours à la ligne
// deviennent des `<br>`.

export function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;')
}

// Échappe strictement puis rend les retours à la ligne (`\n`, `\r\n`, `\r`) en `<br>`.
export function escapeHtmlTexte(value: string): string {
  return escapeHtml(value).replace(/\r\n|\r|\n/g, '<br>')
}

// Remplace les {{variables}} connues d'un gabarit par leurs valeurs échappées ;
// `fragmentsHtml` liste les clés dont la valeur est un fragment HTML voulu (ex. dons_detail),
// insérées telles quelles. Une variable inconnue reste visible (`{{x}}`) dans l'aperçu.
export function substitutePreviewPlaceholders(
  html: string,
  values: Record<string, string>,
  fragmentsHtml: ReadonlySet<string> = new Set(),
): string {
  return html.replace(/\{\{(\w+)\}\}/g, (match, key: string) => {
    if (!Object.hasOwn(values, key)) return match
    const value = values[key]
    return fragmentsHtml.has(key) ? value : escapeHtmlTexte(value)
  })
}
