const LOCAL_DEMO_HOSTS = new Set(['localhost', '127.0.0.1', '100.107.87.80'])
const PUBLIC_HOSTS = new Set(['samakan.fr', 'www.samakan.fr', 'test.samakan.fr'])

export function normaliseSiteUrl(value: unknown): string | null {
  if (typeof value !== 'string' || value.length > 200) return null
  try {
    const url = new URL(value)
    const isLocalDemo = LOCAL_DEMO_HOSTS.has(url.hostname)
    if (!isLocalDemo && !PUBLIC_HOSTS.has(url.hostname)) return null
    if (!isLocalDemo && url.protocol !== 'https:') return null
    if (isLocalDemo && !['http:', 'https:'].includes(url.protocol)) return null
    return url.origin
  } catch {
    return null
  }
}

/** Origine de repli des liens Auth quand l'origine du client est une adresse IP. */
export const ORIGINE_AUTH_REPLI = 'https://test.samakan.fr'

const IPV4 = /^\d{1,3}(\.\d{1,3}){3}$/

/**
 * Origine à donner en `redirectTo` aux liens Auth Supabase (generateLink : invitation, relance).
 *
 * Le pare-feu Cloudflare placé devant Supabase répond 403 (page HTML) dès que `redirect_to`, mis
 * dans la query string par supabase-js, contient une IP littérale (ex. http://100.107.87.80:5175,
 * serveur de revue joint par Tailscale) : la requête n'atteint jamais GoTrue. Les redirections Auth
 * ne sont donc pas possibles sur une IP (cf. AGENTS.md, « Environnement de développement ») : on
 * renvoie alors vers la recette. Toute autre origine (localhost, samakan.fr, test.samakan.fr) est
 * rendue inchangée. Ne concerne que les redirections Auth : nos propres liens (confirmation
 * d'adresse, etc.) gardent l'origine du client.
 */
export function origineRedirectionAuth(siteUrl: string): string {
  try {
    const { hostname } = new URL(siteUrl)
    if (IPV4.test(hostname) || hostname.startsWith('[')) return ORIGINE_AUTH_REPLI
  } catch {
    // Valeur non analysable : rendue telle quelle, comme avant.
  }
  return siteUrl
}
