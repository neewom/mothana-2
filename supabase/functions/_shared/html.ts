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

// Authentification Basic de Gotenberg (carte « protéger Gotenberg », 2026-10) : l'en-tête
// n'est envoyé que si les deux secrets GOTENBERG_USERNAME et GOTENBERG_PASSWORD sont posés ;
// sinon l'appel reste strictement identique. Gotenberg ignore l'en-tête tant que son
// authentification n'est pas activée, ce qui permet de déployer avant de l'activer.
// Jamais journaliser l'identifiant, le mot de passe ni l'en-tête.
export interface ConversionPdfOptions {
  // Délai maximal de la conversion (défaut : GOTENBERG_TIMEOUT_MS).
  timeoutMs?: number
  // Injectables pour les tests ; par défaut l'environnement Deno et le fetch global.
  env?: (nom: string) => string | undefined
  fetchFn?: typeof fetch
}

export function enTetesGotenberg(env: (nom: string) => string | undefined): Record<string, string> {
  const username = env('GOTENBERG_USERNAME')
  const password = env('GOTENBERG_PASSWORD')
  if (!username || !password) return {}
  const octets = new TextEncoder().encode(`${username}:${password}`)
  return { Authorization: `Basic ${btoa(String.fromCharCode(...octets))}` }
}

export async function convertirHtmlEnPdf(
  gotenbergUrl: string,
  form: FormData,
  options: ConversionPdfOptions = {},
): Promise<Response> {
  const env = options.env ?? ((nom: string) => Deno.env.get(nom))
  const fetchFn = options.fetchFn ?? fetch
  const headers = enTetesGotenberg(env)
  const response = await fetchFn(`${gotenbergUrl}/forms/chromium/convert/html`, {
    method: 'POST',
    body: form,
    signal: AbortSignal.timeout(options.timeoutMs ?? GOTENBERG_TIMEOUT_MS),
    ...(Object.keys(headers).length > 0 ? { headers } : {}),
  })
  if (response.status === 401) {
    console.error(
      headers.Authorization
        ? 'Gotenberg 401 : identifiants refusés — vérifier que les secrets GOTENBERG_USERNAME / GOTENBERG_PASSWORD correspondent à ceux du service Gotenberg.'
        : 'Gotenberg 401 : authentification exigée par le service mais secrets GOTENBERG_USERNAME / GOTENBERG_PASSWORD absents.',
    )
  }
  return response
}
