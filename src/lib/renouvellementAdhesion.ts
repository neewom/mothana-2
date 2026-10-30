// Page publique de renouvellement d'adhésion (/adhesion/<slug>/renouveler#<secret>) — Renouvellement 2/3.
// Le secret reste dans le fragment : seule son empreinte SHA-256 (hex, même formule que
// send-mailing-brevo) est envoyée. @noble/hashes plutôt que crypto.subtle, absent hors contexte
// sécurisé (HTTP sur l'IP Tailscale).
import { sha256 } from '@noble/hashes/sha2.js'
import { bytesToHex } from '@noble/hashes/utils.js'
import type { CiviliteAdherent } from '../types'
import { CHAMPS_ADHESION_VIDES, type ChampsAdhesionValeurs } from './champsAdhesion'

/** Secret de 64 caractères hexadécimaux (send-mailing-brevo), sinon null. */
export function extraireSecretRenouvellement(fragment: string): string | null {
  const raw = fragment.startsWith('#') ? fragment.slice(1) : fragment
  if (!raw) return null
  try {
    const decoded = decodeURIComponent(raw).replace(/[\u00AD\u200B-\u200D\u2060\uFEFF]/g, '').trim().toLowerCase()
    return /^[0-9a-f]{64}$/.test(decoded) ? decoded : null
  } catch {
    return null
  }
}

export function empreinteSecretRenouvellement(secret: string): string {
  return bytesToHex(sha256(new TextEncoder().encode(secret)))
}

export interface AdherentPrerempli {
  civilite: number | null
  nom: string | null
  prenom: string | null
  adresse: string | null
  code_postal: string | null
  ville: string | null
  pays: string | null
  telephone: string | null
  courriel: string | null
}

/** Valeurs initiales du formulaire à partir de la fiche de l'adhérent (sans date de naissance). */
export function valeursPreremplies(adherent: AdherentPrerempli): ChampsAdhesionValeurs {
  const civilite: CiviliteAdherent = adherent.civilite === 1 || adherent.civilite === 2 ? adherent.civilite : 0
  return {
    ...CHAMPS_ADHESION_VIDES,
    civilite,
    nom: adherent.nom ?? '',
    prenom: adherent.prenom ?? '',
    adresse: adherent.adresse ?? '',
    codePostal: (adherent.code_postal ?? '').replace(/\D/g, '').slice(0, 5),
    ville: adherent.ville ?? '',
    pays: adherent.pays || 'France',
    telephone: adherent.telephone ?? '',
    courriel: adherent.courriel ?? '',
  }
}

/** « 31 décembre 2026 » ; null si la date est absente ou mal formée. */
export function formatDateFinAdhesion(dateFin: string | null | undefined): string | null {
  if (!dateFin || !/^\d{4}-\d{2}-\d{2}$/.test(dateFin)) return null
  const texte = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
    .format(new Date(`${dateFin}T12:00:00`))
  // « 1er janvier », pas « 1 janvier ».
  return texte.replace(/^1 /, '1er ')
}
