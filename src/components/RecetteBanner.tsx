const PROD_HOSTNAMES = ['samakan.fr', 'www.samakan.fr', 'mothana.vercel.app']

function isRecette(): boolean {
  return !PROD_HOSTNAMES.includes(window.location.hostname)
}

export default function RecetteBanner() {
  if (!isRecette()) return null

  return (
    <div className="flex items-center justify-center bg-amber-500 px-4 py-1.5 text-sm font-medium text-amber-950">
      Environnement de test
    </div>
  )
}
