const PROD_HOSTNAMES = ['samakan.fr', 'www.samakan.fr', 'mothana.vercel.app']
const STAGING_SUPABASE_PROJECT_REF = 'cxngcmvxktddhyxboyyx'

export function isRecette(): boolean {
  return !PROD_HOSTNAMES.includes(window.location.hostname)
}

export function isStagingSupabaseProject(): boolean {
  const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
  return !!url && url.includes(STAGING_SUPABASE_PROJECT_REF)
}
