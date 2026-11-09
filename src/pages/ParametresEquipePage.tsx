import { useEffect, useState } from 'react'
import AdminAccountsManager from '../components/AdminAccountsManager'
import CodesPinSection from '../components/parametres/CodesPinSection'
import ParametresGroupe from '../components/parametres/ParametresGroupe'
import { Button } from '../components/ui/button'
import { PageHeader } from '../components/ui/page-header'
import { StatusNotice } from '../components/ui/status-notice'
import { useAdminOutletContext } from '../hooks/useAdminOutletContext'
import { useAuth } from '../hooks/useAuth'
import { useOrganisationId } from '../hooks/useOrganisationId'
import { supabase } from '../lib/supabaseClient'

// Paramètres › Équipe et accès (fusion des pages Équipe et Codes PIN, 2026-11-09) : comptes de
// l'équipe puis codes PIN partagés. Visible pour l'admin de l'organisation et pour le super-admin
// en mode Consulter (règle du 2026-11-09 : le super-admin a accès à tout) ; pas pour un membre
// (rôle `contributeur` en base). L'admin ne gère que les membres ; le super-admin gère aussi les
// administrateurs (rôle au choix, changement de rôle), comme depuis son tableau de bord.
// La garde réelle reste côté serveur (create-admin, disable-admin, changer_role_compte,
// definir_notification_demandes, codes_pin).
export default function ParametresEquipePage() {
  const { auth } = useAuth()
  const organisationId = useOrganisationId()
  const { fonctionnalitesActivees } = useAdminOutletContext()
  const isSuperAdmin = auth.type === 'super_admin'
  const canManageTeam = isSuperAdmin || (auth.type === 'admin' && auth.role === 'admin')
  // Interrupteur de l'organisation (Adhérents › Paramètres) : grise les cases par compte s'il est coupé.
  const [notificationsEquipeActives, setNotificationsEquipeActives] = useState(true)
  // Formulaire d'ajout ouvert depuis l'action de l'en-tête.
  const [addFormOpen, setAddFormOpen] = useState(false)

  useEffect(() => {
    if (!organisationId || !canManageTeam) return
    let cancelled = false
    supabase
      .from('organisations')
      .select('notif_demandes_adhesion')
      .eq('id', organisationId)
      .single()
      .then(({ data }) => {
        if (!cancelled && data) setNotificationsEquipeActives((data as { notif_demandes_adhesion: boolean }).notif_demandes_adhesion)
      })
    return () => {
      cancelled = true
    }
  }, [organisationId, canManageTeam])

  return (
    <div className="-m-6 min-h-[calc(100%+3rem)] space-y-6 bg-paper p-6 font-registre">
      <PageHeader
        title="Équipe et accès"
        subtitle="Comptes ayant accès à l’espace d’administration et codes PIN des bénévoles et des vendeurs."
        actions={
          canManageTeam ? (
            <Button type="button" onClick={() => setAddFormOpen(true)} disabled={addFormOpen}>
              Ajouter un membre
            </Button>
          ) : undefined
        }
      />

      {canManageTeam && organisationId ? (
        <>
          {/* Un seul niveau de titre pour ce bloc (passe impeccable du 2026-11-09). */}
          <ParametresGroupe
            id="comptes"
            title="Comptes de l'équipe"
            description={
              isSuperAdmin
                ? 'Les membres ont les mêmes accès que les administrateurs, sans droit de gestion des comptes.'
                : 'Les membres ont les mêmes accès que les administrateurs, sans droit de gestion des comptes. Vous pouvez ajouter des membres ; pour ajouter un administrateur, contactez Samakan.'
            }
          >
            <AdminAccountsManager
              organisationId={organisationId}
              showRoleBadge
              canManageRoles={isSuperAdmin}
              manageableRoles={isSuperAdmin ? undefined : ['contributeur']}
              heading={null}
              newFormTitle="Nouveau membre"
              addFormOpen={addFormOpen}
              onAddFormOpenChange={setAddFormOpen}
              emptyLabel="Aucun compte pour cette organisation."
              notificationsEquipeActives={notificationsEquipeActives}
            />
          </ParametresGroupe>

          <CodesPinSection organisationId={organisationId} avecVendeur={!!fonctionnalitesActivees?.evenements} />
        </>
      ) : (
        <StatusNotice tone="warning">La gestion de l’équipe et des accès est réservée aux administrateurs de l’organisation.</StatusNotice>
      )}
    </div>
  )
}
