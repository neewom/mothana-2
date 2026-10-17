// Validation d'une demande d'adhésion soumise par le formulaire public (/adhesion/<slug>) —
// mêmes règles que DemandeAdhesionPage, rejouées côté serveur : le client n'est jamais cru.
// Module pur (aucune API Deno) : testé par Vitest (src/lib/demandeAdhesionValidation.test.ts).

export interface DemandeAdhesionValide {
  slug: string
  civilite: 0 | 1 | 2
  nom: string
  prenom: string | null
  date_naissance: string | null
  adresse: string | null
  code_postal: string
  ville: string | null
  pays: string | null
  telephone: string | null
  courriel: string | null
  signature_data_url: string
  accepte_statuts: boolean
  consent_rgpd: true
}

export type ResultatValidation =
  | { ok: true; demande: DemandeAdhesionValide; piege: boolean }
  | { ok: false }

// Même expression que lib/textFormat.ts (isValidEmail).
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[A-Za-z]{2,24}$/
const SIGNATURE_PREFIX = 'data:image/png;base64,'
// Signature dessinée au doigt : quelques dizaines de Ko ; la borne évite de stocker n'importe quoi.
const SIGNATURE_MAX = 300_000

function texte(value: unknown, max: number): string | null | undefined {
  if (value === undefined || value === null) return null
  if (typeof value !== 'string') return undefined
  const trimmed = value.trim()
  if (trimmed.length > max) return undefined
  return trimmed === '' ? null : trimmed
}

function dateNaissanceValide(value: string, today: Date): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const date = new Date(`${value}T00:00:00Z`)
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) return false
  const annee = date.getUTCFullYear()
  // Même borne haute que lib/dateNaissance.ts (année précédente au plus).
  return annee >= 1900 && annee <= today.getUTCFullYear() - 1
}

/**
 * `statutsRequis` : l'organisation publie des statuts, la case doit donc avoir été cochée
 * (sans statuts, la case n'est pas affichée et l'acceptation vaut true, comme avant).
 */
export function validerDemandeAdhesion(
  body: unknown,
  statutsRequis: boolean,
  today: Date = new Date(),
): ResultatValidation {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) return { ok: false }
  const b = body as Record<string, unknown>

  const piege = typeof b.site_web === 'string' && b.site_web.trim() !== ''

  const slug = texte(b.slug, 100)
  const nom = texte(b.nom, 100)
  const prenom = texte(b.prenom, 100)
  const dateNaissance = texte(b.date_naissance, 10)
  const adresse = texte(b.adresse, 200)
  const codePostal = texte(b.code_postal, 5)
  const ville = texte(b.ville, 100)
  const pays = texte(b.pays, 100)
  const telephone = texte(b.telephone, 30)
  const courriel = texte(b.courriel, 254)
  const signature = typeof b.signature_data_url === 'string' ? b.signature_data_url : ''

  const champs = [slug, nom, prenom, dateNaissance, adresse, codePostal, ville, pays, telephone, courriel]
  if (champs.some((c) => c === undefined)) return { ok: false }
  if (!slug || !nom || !codePostal || !/^\d{5}$/.test(codePostal)) return { ok: false }
  if (b.civilite !== 0 && b.civilite !== 1 && b.civilite !== 2) return { ok: false }
  if (dateNaissance && !dateNaissanceValide(dateNaissance, today)) return { ok: false }
  if (telephone && !/^[0-9 +().-]+$/.test(telephone)) return { ok: false }
  if (courriel && !EMAIL_REGEX.test(courriel)) return { ok: false }
  if (!signature.startsWith(SIGNATURE_PREFIX) || signature.length > SIGNATURE_MAX) return { ok: false }
  if (!/^[A-Za-z0-9+/]+=*$/.test(signature.slice(SIGNATURE_PREFIX.length))) return { ok: false }
  if (b.consent_rgpd !== true) return { ok: false }
  if (statutsRequis && b.accepte_statuts !== true) return { ok: false }

  return {
    ok: true,
    piege,
    demande: {
      slug: slug as string,
      civilite: b.civilite,
      nom: nom as string,
      prenom: prenom ?? null,
      date_naissance: dateNaissance ?? null,
      adresse: adresse ?? null,
      code_postal: codePostal as string,
      ville: ville ?? null,
      pays: pays ?? null,
      telephone: telephone ?? null,
      courriel: courriel ?? null,
      signature_data_url: signature,
      accepte_statuts: true,
      consent_rgpd: true,
    },
  }
}

/** Échappe le texte saisi avant de l'insérer dans un email HTML. */
export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}
