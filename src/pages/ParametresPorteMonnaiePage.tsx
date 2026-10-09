import { useState } from 'react'
import CouponDonneesPersonnellesSection from '../components/CouponDonneesPersonnellesSection'
import { useOrganisationId } from '../hooks/useOrganisationId'
import { useUnsavedChangesGuard } from '../hooks/useUnsavedChangesGuard'

// Paramètres › Porte-monnaie (module evenements) : données personnelles des acheteurs (durée
// de conservation, politique de confidentialité), sorties de l'ancienne page Organisation.
export default function ParametresPorteMonnaiePage() {
  const organisationId = useOrganisationId()
  const [dirty, setDirty] = useState(false)
  const guardDialog = useUnsavedChangesGuard(dirty)

  return (
    <div className="-m-6 min-h-[calc(100%+3rem)] space-y-6 bg-paper p-6 font-registre">
      <div>
        <h1 className="text-2xl font-bold text-ink md:text-3xl">Porte-monnaie</h1>
        <p className="mt-1 text-sm text-ink-muted">Réglages du porte-monnaie événementiel.</p>
      </div>
      <CouponDonneesPersonnellesSection organisationId={organisationId} onDirtyChange={setDirty} />
      {guardDialog}
    </div>
  )
}
