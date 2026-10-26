// Email aux comptes de l'organisation à chaque demande d'adhésion soumise (cadré 2026-10-23).
// Aucune donnée du demandeur (décision du 2026-09-15) ; le lien ne pointe jamais vers une origine
// fournie par le client sans passer par la liste blanche de normaliseSiteUrl.
// Module pur : testé par Vitest (src/lib/notificationAdmins.test.ts).
import { normaliseSiteUrl } from '../_shared/siteUrl.ts'

// Projet Supabase de recette : son repli est test.samakan.fr, jamais la prod.
const PROJET_RECETTE = 'cxngcmvxktddhyxboyyx'

/** Lien vers la page des demandes : origine du formulaire si elle est autorisée, sinon le site de l'environnement. */
export function lienPageDemandes(siteUrlClient: unknown, supabaseUrl: string | undefined): string {
  const origine = normaliseSiteUrl(siteUrlClient)
    ?? (supabaseUrl?.includes(PROJET_RECETTE) ? 'https://test.samakan.fr' : 'https://samakan.fr')
  return `${origine}/admin/adherents/demandes`
}

export const SUJET_NOTIFICATION_ADMINS = "Nouvelle demande d'adhésion à examiner"

export function notificationAdminsHtml(lien: string): string {
  return `<!doctype html><html><body style="font-family: ui-sans-serif, system-ui, sans-serif; background: #f8fafc; padding: 32px;">
  <div style="max-width: 480px; margin: 0 auto; background: #ffffff; border-radius: 16px; padding: 32px; border: 1px solid #e2e8f0;">
    <h1 style="color: #0f172a; font-size: 20px; margin: 0 0 16px;">Nouvelle demande d'adhésion</h1>
    <p style="color: #475569; font-size: 14px; line-height: 1.5;">Une demande d'adhésion vient d'être envoyée par le formulaire en ligne. Elle est à examiner par le conseil d'administration.</p>
    <p style="margin: 24px 0;"><a href="${lien}" style="display: inline-block; background: #a8281f; color: #ffffff; text-decoration: none; font-size: 14px; font-weight: 600; padding: 10px 18px; border-radius: 4px;">Voir les demandes</a></p>
    <p style="color: #94a3b8; font-size: 12px;">Vous recevez cet email car vous avez un compte sur l'espace de gestion de l'association.</p>
  </div>
</body></html>`
}
