import { useEffect, useState } from 'react'
import AdminAccountsManager from '../components/AdminAccountsManager'
import ParametresSection from '../components/ParametresSection'
import { Button } from '../components/ui/button'
import { PageHeader } from '../components/ui/page-header'
import { StatusNotice } from '../components/ui/status-notice'
import { useAuth } from '../hooks/useAuth'
import { supabase } from '../lib/supabaseClient'

// Paramètres › Équipe : membres (rôle `contributeur` en base, libellé « membre » à l'écran),
// sortis de « Mon compte ». Réservé aux admins de l'organisation, comme avant (le membre ne gère
// pas les comptes ; le super-admin les gère depuis son tableau de bord). Aucun changement de
// droits : la RLS reste la garde réelle.
export default function ParametresEquipePage() {
  const { auth } = useAuth()
  const organisationId = auth.type === 'admin' ? auth.organisationId : null
  // Interrupteur de l'organisation (Adhérents › Paramètres) : grise les cases par compte s'il est coupé.
  const [notificationsEquipeActives, setNotificationsEquipeActives] = useState(true)
  // Formulaire « Nouveau membre » ouvert depuis l'action de l'en-tête.
  const [addFormOpen, setAddFormOpen] = useState(false)
  const canManageTeam = auth.type === 'admin' && auth.role === 'admin'

  useEffect(() => {
    if (!organisationId) return
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
  }, [organisationId])

  return (
    <div className="-m-6 min-h-[calc(100%+3rem)] space-y-6 bg-paper p-6 font-registre">
      <PageHeader
        title="Équipe"
        subtitle="Comptes ayant accès à l’espace d’administration de votre organisation."
        actions={
          canManageTeam ? (
            <Button type="button" onClick={() => setAddFormOpen(true)} disabled={addFormOpen}>
              Ajouter un membre
            </Button>
          ) : undefined
        }
      />

      {auth.type === 'admin' && auth.role === 'admin' ? (
        <ParametresSection
          title="Comptes de l'organisation"
          description="Administrateurs et membres. Les membres ont les mêmes accès que vous, sans droit de gestion des comptes."
        >
          <AdminAccountsManager
            organisationId={auth.organisationId}
            showRoleBadge
            manageableRoles={['contributeur']}
            readOnlyNote="Les comptes administrateurs sont gérés par Samakan : contactez-nous pour en ajouter ou en retirer un."
            heading="Comptes actifs"
            newFormTitle="Nouveau membre"
            addFormOpen={addFormOpen}
            onAddFormOpenChange={setAddFormOpen}
            emptyLabel="Aucun compte pour cette organisation."
            notificationsEquipeActives={notificationsEquipeActives}
          />
        </ParametresSection>
      ) : (
        <StatusNotice tone="warning">La gestion de l’équipe est réservée aux administrateurs de l’organisation.</StatusNotice>
      )}
    </div>
  )
}
