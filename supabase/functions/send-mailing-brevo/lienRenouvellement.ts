// Lien personnel de renouvellement d'adhésion dans l'emailing (Renouvellement 1/3, 2026-10-30).
// Le secret (64 hex) n'existe qu'en mémoire et dans l'email : la base ne reçoit que son
// empreinte SHA-256 (même formule que secrets_portefeuille : sha256 de la chaîne UTF-8, en hex),
// et il n'est jamais journalisé. Module pur : testé par Vitest (src/lib/lienRenouvellement.test.ts).
import { normaliseSiteUrl } from '../_shared/siteUrl.ts'

export const PLACEHOLDER_LIEN_RENOUVELLEMENT = '{{params.lien_renouvellement}}'

// Projet Supabase de recette : son repli est test.samakan.fr, jamais la prod (comme notificationAdmins).
const PROJET_RECETTE = 'cxngcmvxktddhyxboyyx'

const PLACEHOLDER_REGEX = /\{\{\s*params\.lien_renouvellement\s*\}\}/
// Occurrence « nue » (texte inséré par le bouton de l'éditeur), pas déjà dans un href.
const PLACEHOLDER_NU_REGEX = /(?<!href=["'])\{\{\s*params\.lien_renouvellement\s*\}\}/g

/** La campagne utilise-t-elle le lien ? Sinon, aucun lien n'est généré. */
export function utiliseLienRenouvellement(corpsHtml: string): boolean {
  return PLACEHOLDER_REGEX.test(corpsHtml)
}

/** Remplace chaque occurrence nue du paramètre par un bouton ; un lien posé à la main (href) reste tel quel. */
export function avecBoutonRenouvellement(corpsHtml: string): string {
  return corpsHtml.replace(
    PLACEHOLDER_NU_REGEX,
    `<a href="${PLACEHOLDER_LIEN_RENOUVELLEMENT}" style="display:inline-block;background:#a8281f;color:#ffffff;text-decoration:none;font-size:14px;font-weight:600;padding:10px 18px;border-radius:4px;">Renouveler mon adhésion</a>`,
  )
}

/** Origine du site : celle de l'admin si elle est autorisée, sinon le site de l'environnement. */
export function origineSite(siteUrlClient: unknown, supabaseUrl: string | undefined): string {
  return normaliseSiteUrl(siteUrlClient)
    ?? (supabaseUrl?.includes(PROJET_RECETTE) ? 'https://test.samakan.fr' : 'https://samakan.fr')
}

/** Lien envoyé à l'adhérent : le secret est dans le fragment, jamais transmis au serveur web. */
export function lienRenouvellement(origine: string, slug: string, secret: string): string {
  return `${origine}/adhesion/${encodeURIComponent(slug)}/renouveler#${secret}`
}

/** Empreinte SHA-256 (hex) du secret, seule valeur stockée en base. */
export async function empreinteSecret(secret: string): Promise<string> {
  const octets = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(secret)))
  return Array.from(octets, (o) => o.toString(16).padStart(2, '0')).join('')
}
