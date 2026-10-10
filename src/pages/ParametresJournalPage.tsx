import { useOrganisationId } from '../hooks/useOrganisationId'
import ParametresSection from '../components/ParametresSection'
import HistoriqueModificationsSection from '../components/HistoriqueModificationsSection'

// « Journal des adhérents » tant qu'il ne couvre que les adhérents et les demandes d'adhésion
// (l'extension aux dons est un sujet séparé).
export default function ParametresJournalPage() {
  const organisationId = useOrganisationId()

  return (
    <div className="-m-6 min-h-[calc(100%+3rem)] space-y-6 bg-paper p-6 font-registre">
      <div>
        <h1 className="text-2xl font-bold text-ink md:text-3xl">Journal des adhérents</h1>
        <p className="mt-1 text-sm text-ink-muted">Actions effectuées sur les adhérents et les demandes d'adhésion.</p>
      </div>

      <ParametresSection
        title="Historique des modifications"
        description="Création, modification, archivage, ratification et refus, avec leur auteur."
      >
        {organisationId && <HistoriqueModificationsSection organisationId={organisationId} />}
      </ParametresSection>
    </div>
  )
}
