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
