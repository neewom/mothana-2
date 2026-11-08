// Page publique de renouvellement d'adhésion (Renouvellement 2/3, 2026-10-30) : parties pures
// partagées par lire-renouvellement-adhesion et soumettre-renouvellement-adhesion.
// Module pur (aucune API Deno) : testé par Vitest (src/lib/renouvellementAdhesion.test.ts).
import { escapeHtml } from '../soumettre-demande-adhesion/validation.ts'

export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

export function jsonResponse(body: unknown, status = 200, extraHeaders: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json', 'Cache-Control': 'no-store', ...extraHeaders },
  })
}

export type EtatLien = 'valide' | 'lien_invalide' | 'lien_expire' | 'deja_envoye' | 'deja_renouvele'

const ETATS_NON_VALIDES: ReadonlySet<string> = new Set(['lien_invalide', 'lien_expire', 'deja_envoye', 'deja_renouvele'])

/** État d'un lien renvoyé au navigateur ; toute valeur inattendue devient « lien_invalide ». */
export function etatPublic(valeur: unknown): Exclude<EtatLien, 'valide'> {
  return typeof valeur === 'string' && ETATS_NON_VALIDES.has(valeur)
    ? valeur as Exclude<EtatLien, 'valide'>
    : 'lien_invalide'
}

export function isSecretHash(value: unknown): value is string {
  return typeof value === 'string' && /^[0-9a-f]{64}$/.test(value)
}

/** Date de fin au format AAAA-MM-JJ, sinon null. */
export function dateFinPublique(valeur: unknown): string | null {
  return typeof valeur === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(valeur) ? valeur : null
}

export const SUJET_CONFIRMATION_RENOUVELLEMENT = 'Votre demande de renouvellement a bien été reçue'

export function confirmationRenouvellementHtml(nomAffiche: string, organisationNom: string): string {
  return `<!doctype html><html><body style="font-family: ui-sans-serif, system-ui, sans-serif; background: #f8fafc; padding: 32px;">
  <div style="max-width: 480px; margin: 0 auto; background: #ffffff; border-radius: 16px; padding: 32px; border: 1px solid #e2e8f0;">
    <h1 style="color: #0f172a; font-size: 20px; margin: 0 0 16px;">Demande de renouvellement bien reçue</h1>
    <p style="color: #475569; font-size: 14px; line-height: 1.5;">Bonjour ${escapeHtml(nomAffiche)},</p>
    <p style="color: #475569; font-size: 14px; line-height: 1.5;">Votre demande de renouvellement d'adhésion à ${escapeHtml(organisationNom)} a bien été reçue. Elle sera examinée prochainement par le conseil d'administration, qui reviendra vers vous.</p>
    <p style="color: #94a3b8; font-size: 12px;">Vous recevez cet email car cette adresse a été renseignée dans un formulaire de renouvellement d'adhésion.</p>
  </div>
</body></html>`
}
