// Création d'un compte d'organisation (admin ou contributeur) et envoi de son invitation, partagé
// par create-admin (super-admin / admin) et valider-demande-inscription (carte hNqpdZXL).
// Le contrôle du droit de l'appelant reste à la charge de l'Edge Function.
//
// Le modèle d'email est un paramètre : invitation habituelle (create-admin) ou invitation dédiée
// au parcours d'inscription (« Ton espace Samakan est prêt »). La logique (lien d'invitation,
// profil, annulation du compte si le profil échoue) est la même.
import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { escapeHtml } from './echappementHtml.ts'
import { sendViaResend } from './resend.ts'
import { emailInvitationInscription } from './inscriptionEmails.ts'

export type RoleCompte = 'admin' | 'contributeur'

export type ModeleInvitation =
  | { type: 'standard' }
  | { type: 'inscription'; prenom: string }

export function emailInvitationStandard(nom: string, organisationNom: string, actionLink: string, role: RoleCompte): string {
  const roleLabel = role === 'admin' ? 'administrateur' : 'membre'
  return `<!doctype html><html><body style="font-family: ui-sans-serif, system-ui, sans-serif; background: #f8fafc; padding: 32px;">
  <div style="max-width: 480px; margin: 0 auto; background: #ffffff; border-radius: 16px; padding: 32px; border: 1px solid #e2e8f0;">
    <h1 style="color: #0f172a; font-size: 20px; margin: 0 0 16px;">Bienvenue sur Samakan</h1>
    <p style="color: #475569; font-size: 14px; line-height: 1.5;">Bonjour ${escapeHtml(nom)},</p>
    <p style="color: #475569; font-size: 14px; line-height: 1.5;">Un compte ${roleLabel} vient d'être créé pour vous, pour l'organisation <strong>${escapeHtml(organisationNom)}</strong>. Cliquez sur le bouton ci-dessous pour définir votre mot de passe et accéder à votre espace.</p>
    <p style="margin: 24px 0;">
      <a href="${escapeHtml(actionLink)}" style="background: #4f46e5; color: #ffffff; padding: 10px 20px; border-radius: 8px; text-decoration: none; font-size: 14px; font-weight: 600;">Définir mon mot de passe</a>
    </p>
    <p style="color: #94a3b8; font-size: 12px;">Si vous n'êtes pas à l'origine de cette invitation, vous pouvez ignorer cet email.</p>
  </div>
</body></html>`
}

/** Sujet et corps de l'invitation selon le modèle. */
export function emailInvitation(
  modele: ModeleInvitation,
  p: { nom: string; organisationNom: string; actionLink: string; role: RoleCompte },
): { sujet: string; html: string } {
  if (modele.type === 'inscription') {
    return emailInvitationInscription({ prenom: modele.prenom, nomAssociation: p.organisationNom, actionLink: p.actionLink })
  }
  return { sujet: 'Votre accès Samakan', html: emailInvitationStandard(p.nom, p.organisationNom, p.actionLink, p.role) }
}

export interface ProfilCree {
  id: string
  utilisateur_id: string
  nom_affiche: string
  organisation_id: string
  role: RoleCompte
}

export type ResultatInvitation =
  | { ok: true; profil: ProfilCree; emailEnvoye: boolean }
  | { ok: false; status: number; error: string }

export async function creerCompteEtInviter(
  adminClient: SupabaseClient,
  p: { nom: string; email: string; organisationId: string; role: RoleCompte; siteUrl: string; modele: ModeleInvitation },
): Promise<ResultatInvitation> {
  const { data: orgData, error: orgError } = await adminClient
    .from('organisations')
    .select('nom')
    .eq('id', p.organisationId)
    .single()
  if (orgError || !orgData) return { ok: false, status: 400, error: 'Organisation introuvable' }

  // Crée le compte Auth et renvoie le lien d'invitation en un appel.
  const { data: linkData, error: linkError } = await adminClient.auth.admin.generateLink({
    type: 'invite',
    email: p.email,
    options: { redirectTo: `${p.siteUrl}/mot-de-passe/nouveau` },
  })
  if (linkError || !linkData?.user) {
    console.error('generateLink error:', linkError?.message)
    return { ok: false, status: 400, error: linkError?.message ?? 'Erreur lors de la création du compte' }
  }

  const utilisateurId = linkData.user.id
  const actionLink = linkData.properties.action_link

  const { data: profil, error: profilError } = await adminClient
    .from('profils_organisation')
    .insert({
      utilisateur_id: utilisateurId,
      organisation_id: p.organisationId,
      nom_affiche: p.nom,
      role: p.role,
    })
    .select('id, utilisateur_id, nom_affiche, organisation_id, role')
    .single()

  if (profilError || !profil) {
    console.error('profils_organisation insert error:', profilError?.message)
    // Annule le compte Auth pour garder des données cohérentes.
    await adminClient.auth.admin.deleteUser(utilisateurId)
    return { ok: false, status: 500, error: profilError?.message ?? 'Erreur lors de la création du profil' }
  }

  const { sujet, html } = emailInvitation(p.modele, { nom: p.nom, organisationNom: orgData.nom, actionLink, role: p.role })
  const emailResult = await sendViaResend(p.email, sujet, html)
  if (!emailResult.ok) {
    // Non bloquant : le compte est créé, seul l'email échoue.
    console.error('Resend error:', emailResult.detail)
  }

  return { ok: true, profil: profil as ProfilCree, emailEnvoye: emailResult.ok }
}

/**
 * Relance l'invitation d'un compte déjà créé (envoi précédent en échec) : lien de choix du mot de
 * passe (type recovery, même page d'arrivée), même modèle d'email.
 */
export async function relancerInvitation(
  adminClient: SupabaseClient,
  p: { email: string; nom: string; organisationId: string; role: RoleCompte; siteUrl: string; modele: ModeleInvitation },
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { data: orgData } = await adminClient.from('organisations').select('nom').eq('id', p.organisationId).single()
  if (!orgData) return { ok: false, error: 'Organisation introuvable' }
  const { data: linkData, error: linkError } = await adminClient.auth.admin.generateLink({
    type: 'recovery',
    email: p.email,
    options: { redirectTo: `${p.siteUrl}/mot-de-passe/nouveau` },
  })
  if (linkError || !linkData?.properties?.action_link) {
    return { ok: false, error: linkError?.message ?? 'Lien d’invitation impossible à générer' }
  }
  const { sujet, html } = emailInvitation(p.modele, {
    nom: p.nom,
    organisationNom: orgData.nom,
    actionLink: linkData.properties.action_link,
    role: p.role,
  })
  const envoi = await sendViaResend(p.email, sujet, html)
  return envoi.ok ? { ok: true } : { ok: false, error: 'L’envoi de l’email a échoué' }
}
