import { useOrganisationId } from '../hooks/useOrganisationId'
import ParametresSection from '../components/ParametresSection'
import HistoriqueModificationsSection from '../components/HistoriqueModificationsSection'

export default function ParametresSuiviPage() {
  const organisationId = useOrganisationId()

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Paramètres — Suivi</h1>
        <p className="mt-1 text-sm text-slate-600">Journal des actions effectuées sur les adhérents et les demandes d'adhésion.</p>
      </div>

      <ParametresSection
        title="Historique des modifications"
        description="Journal des actions effectuées sur les adhérents et les demandes d'adhésion (création, modification, archivage, ratification, refus)."
      >
        {organisationId && <HistoriqueModificationsSection organisationId={organisationId} />}
      </ParametresSection>
    </div>
  )
}
