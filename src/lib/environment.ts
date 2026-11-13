const PROD_HOSTNAMES = ['samakan.fr', 'www.samakan.fr', 'mothana.vercel.app']
const STAGING_SUPABASE_PROJECT_REF = 'cxngcmvxktddhyxboyyx'

export function isRecette(): boolean {
  return !PROD_HOSTNAMES.includes(window.location.hostname)
}

export function isStagingSupabaseProject(): boolean {
  const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
  return !!url && url.includes(STAGING_SUPABASE_PROJECT_REF)
}

// En prod, `mothana.vercel.app` reste un alias fonctionnel mais ne doit jamais apparaître
// dans un lien envoyé par email — on force le domaine canonique quel que soit l'alias visité.
export function getCanonicalSiteUrl(): string {
  return isRecette() ? window.location.origin : 'https://samakan.fr'
}

const DEMO_URL_PROD = 'https://demo.samakan.fr'
const DEMO_URL_RECETTE = 'https://demo-test.samakan.fr'

const DEMO_URLS = [DEMO_URL_PROD, DEMO_URL_RECETTE]

// Démo publique (bouton « Voir la démo » de la landing) : depuis une démo, la démo courante (un
// visiteur qui retombe sur la landing ne change pas de démo) ; sinon la démo de prod depuis un
// domaine de prod, celle de recette partout ailleurs (test.samakan.fr, serveurs locaux).
export function getDemoUrl(hostname: string = window.location.hostname): string {
  const currentDemo = DEMO_URLS.find((url) => new URL(url).hostname === hostname)
  if (currentDemo) return currentDemo
  return PROD_HOSTNAMES.includes(hostname) ? DEMO_URL_PROD : DEMO_URL_RECETTE
}
