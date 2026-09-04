import { useOrganisationId } from '../hooks/useOrganisationId'
import ParametresSection from '../components/ParametresSection'
import HistoriqueModificationsSection from '../components/HistoriqueModificationsSection'

export default function ParametresSuiviPage() {
  const organisationId = useOrganisationId()

  return (
    <div className="-m-6 min-h-[calc(100%+3rem)] space-y-6 bg-paper p-6 font-registre">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-ink md:text-3xl">Paramètres — Historique</h1>
        <p className="mt-1 text-sm text-ink-muted">Journal des actions effectuées sur les adhérents et les demandes d'adhésion.</p>
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
