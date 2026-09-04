import { isRecette } from '../lib/environment'

export default function RecetteBanner() {
  if (!isRecette()) return null

  return (
    <div className="flex items-center justify-center bg-warning px-4 py-1.5 font-registre text-sm font-medium text-white">
      Environnement de test
    </div>
  )
}
