import AdminAccountsManager from '../components/AdminAccountsManager'
import ParametresSection from '../components/ParametresSection'
import { StatusNotice } from '../components/ui/status-notice'
import { useAuth } from '../hooks/useAuth'

// Paramètres › Équipe : contributeurs, sortis de « Mon compte ». Réservé aux admins de
// l'organisation, comme avant (le contributeur ne gère pas les comptes ; le super-admin les
// gère depuis son tableau de bord). Aucun changement de droits : la RLS reste la garde réelle.
export default function ParametresEquipePage() {
  const { auth } = useAuth()

  return (
    <div className="-m-6 min-h-[calc(100%+3rem)] space-y-6 bg-paper p-6 font-registre">
      <div>
        <h1 className="text-2xl font-bold text-ink md:text-3xl">Équipe</h1>
        <p className="mt-1 text-sm text-ink-muted">Comptes ayant accès à l’espace d’administration de votre organisation.</p>
      </div>

      {auth.type === 'admin' && auth.role === 'admin' ? (
        <ParametresSection title="Contributeurs" description="Comptes supplémentaires ayant les mêmes accès que vous, sans droit de gestion des comptes.">
          <AdminAccountsManager
            organisationId={auth.organisationId}
            filterRoles={['contributeur']}
            heading="Contributeurs de l'organisation"
            addButtonLabel="Ajouter un contributeur"
            newFormTitle="Nouveau contributeur"
            emptyLabel="Aucun contributeur pour cette organisation."
          />
        </ParametresSection>
      ) : (
        <StatusNotice tone="warning">La gestion de l’équipe est réservée aux administrateurs de l’organisation.</StatusNotice>
      )}
    </div>
  )
}
