import { isRecette } from '../lib/environment'

export default function RecetteBanner() {
  if (!isRecette()) return null

  return (
    <div className="flex items-center justify-center bg-amber-500 px-4 py-1.5 text-sm font-medium text-amber-950">
      Environnement de test
    </div>
  )
}
