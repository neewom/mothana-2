import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { sendViaResend } from '../_shared/resend.ts'
import { notificationAdminsHtml, sujetNotificationAdmins, type TypeDemande } from './notificationAdmins.ts'

// Borne du nombre de comptes prévenus par demande (une association compte quelques comptes).
const NOTIFICATION_ADMINS_MAX = 20

/**
 * Un email par compte actif (admin ou contributeur, non désactivé, réglage actif) de l'organisation.
 * Partagé par soumettre-demande-adhesion et soumettre-renouvellement-adhesion.
 */
export async function prevenirComptesOrganisation(
  adminClient: SupabaseClient,
  organisationId: string,
  lien: string,
  type: TypeDemande,
): Promise<void> {
  const { data: profils, error } = await adminClient
    .from('profils_organisation')
    .select('utilisateur_id')
    .eq('organisation_id', organisationId)
    .in('role', ['admin', 'contributeur'])
    // Réglage du compte (Mon compte, Paramètres → Équipe, espace super-admin).
    .eq('notif_demandes_adhesion', true)
    .limit(NOTIFICATION_ADMINS_MAX)
  if (error) throw new Error(error.message)

  const html = notificationAdminsHtml(lien, type)
  const sujet = sujetNotificationAdmins(type)
  for (const { utilisateur_id } of (profils ?? []) as { utilisateur_id: string }[]) {
    const { data } = await adminClient.auth.admin.getUserById(utilisateur_id)
    const compte = data?.user
    // Compte désactivé (disable-admin bannit le compte) ou sans email : pas de notification.
    if (!compte?.email || (compte.banned_until && new Date(compte.banned_until) > new Date())) continue
    const resultat = await sendViaResend(compte.email, sujet, html)
    if (!resultat.ok) console.error(`notification des comptes (${type}) : Resend`, resultat.detail)
  }
}
