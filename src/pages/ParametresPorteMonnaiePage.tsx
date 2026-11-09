import { useState } from 'react'
import CouponDonneesPersonnellesSection from '../components/CouponDonneesPersonnellesSection'
import ParametresGroupe from '../components/parametres/ParametresGroupe'
import LectureSeuleNotice from '../components/parametres/LectureSeuleNotice'
import { useOrganisationId } from '../hooks/useOrganisationId'
import { usePeutModifierParametres } from '../hooks/usePeutModifierParametres'
import { useUnsavedChangesGuard } from '../hooks/useUnsavedChangesGuard'

// Activités › Paramètres (« Paramètres des activités », section Porte-monnaie, module evenements) : données personnelles des acheteurs (durée
// de conservation, politique de confidentialité), sorties de l'ancienne page Organisation.
export default function ParametresPorteMonnaiePage() {
  const organisationId = useOrganisationId()
  const peutModifier = usePeutModifierParametres()
  const [dirty, setDirty] = useState(false)
  const guardDialog = useUnsavedChangesGuard(dirty)

  return (
    <div className="-m-6 min-h-[calc(100%+3rem)] space-y-6 bg-paper p-6 font-registre">
      <div>
        <h1 className="text-2xl font-bold text-ink md:text-3xl">Paramètres des activités</h1>
        <p className="mt-1 text-sm text-ink-muted">Réglages du module Activités : données personnelles des acheteurs du porte-monnaie événementiel.</p>
      </div>
      {!peutModifier && <LectureSeuleNotice />}
      <ParametresGroupe id="parametres-porte-monnaie" title="Porte-monnaie">
        <CouponDonneesPersonnellesSection organisationId={organisationId} onDirtyChange={setDirty} lectureSeule={!peutModifier} />
      </ParametresGroupe>
      {guardDialog}
    </div>
  )
}
