// Remplace src/components/RecetteBanner.tsx dans le build de la démo (substitution faite par
// vite.demo.config.ts) : le bandeau de la démo prend la place du bandeau « Environnement de test ».
import { DemoBanner } from './DemoBanner'

export default function RecetteBannerSlot() {
  return <DemoBanner />
}
