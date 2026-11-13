// Étape « admin + invitation » de valider-demande-inscription, séparée pour être testée avec un
// client factice. Création du compte (ou relance si le compte existe déjà pour cette demande),
// puis trace sur la demande : date d'envoi, ou erreur conservée (l'organisation n'est jamais
// supprimée ; un nouvel appel relance l'invitation seule).
import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { creerCompteEtInviter, relancerInvitation, type ModeleInvitation } from '../_shared/inviterAdmin.ts'

export interface DemandeAInviter {
  id: string
  prenom: string
  nom: string
  email: string
  organisation_id: string
  admin_utilisateur_id: string | null
}

export const MESSAGE_EMAIL_NON_PARTI = "Compte créé, mais l'envoi de l'email d'invitation a échoué."

/** Retourne l'erreur d'invitation (enregistrée sur la demande), ou null si l'invitation est partie. */
export async function inviterAdminDemande(
  client: SupabaseClient,
  demande: DemandeAInviter,
  siteUrl: string,
): Promise<string | null> {
  const nomAffiche = `${demande.prenom} ${demande.nom}`
  const modele: ModeleInvitation = { type: 'inscription', prenom: demande.prenom }
  let erreur: string | null = null

  if (!demande.admin_utilisateur_id) {
    const invitation = await creerCompteEtInviter(client, {
      nom: nomAffiche,
      email: demande.email,
      organisationId: demande.organisation_id,
      role: 'admin',
      siteUrl,
      modele,
    })
    if (invitation.ok) {
      await client
        .from('demandes_inscription')
        .update({ admin_utilisateur_id: invitation.profil.utilisateur_id })
        .eq('id', demande.id)
      if (!invitation.emailEnvoye) erreur = MESSAGE_EMAIL_NON_PARTI
    } else {
      erreur = invitation.error
    }
  } else {
    const relance = await relancerInvitation(client, {
      email: demande.email,
      nom: nomAffiche,
      organisationId: demande.organisation_id,
      role: 'admin',
      siteUrl,
      modele,
    })
    if (!relance.ok) erreur = relance.error
  }

  await client
    .from('demandes_inscription')
    .update(erreur
      ? { erreur_invitation: erreur.slice(0, 500) }
      : { erreur_invitation: null, invitation_envoyee_le: new Date().toISOString() })
    .eq('id', demande.id)

  return erreur
}
