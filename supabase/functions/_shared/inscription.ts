// Règles de saisie de la demande d'inscription (carte https://trello.com/c/hNqpdZXL), partagées
// entre le formulaire public /inscription (src/pages/InscriptionPage.tsx) et l'Edge Function
// soumettre-demande-inscription, qui revalide tout côté serveur. Module pur (aucune API Deno).

export const LONGUEURS_INSCRIPTION = {
  nom_association: { min: 2, max: 150 },
  ville: { min: 1, max: 100 },
  prenom: { min: 1, max: 100 },
  nom: { min: 1, max: 100 },
  email: { min: 3, max: 254 },
  message: { min: 0, max: 2000 },
} as const

// Même règle que src/lib/textFormat.ts (isValidEmail).
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[A-Za-z]{2,24}$/
export const RNA_REGEX = /^W\d{9}$/
export const SIREN_REGEX = /^\d{9}$/

export type ChampInscription = 'nom_association' | 'ville' | 'rna' | 'siren' | 'prenom' | 'nom' | 'email' | 'message' | 'cgu'

/** Ordre d'affichage des champs (focus sur le premier en erreur). */
export const ORDRE_CHAMPS_INSCRIPTION: ChampInscription[] = [
  'nom_association', 'ville', 'rna', 'siren', 'prenom', 'nom', 'email', 'message', 'cgu',
]

export interface SaisieInscription {
  nom_association: string
  ville: string
  rna: string
  siren: string
  prenom: string
  nom: string
  email: string
  message: string
  cgu_acceptees: boolean
}

export interface DemandeInscriptionNormalisee {
  nom_association: string
  ville: string
  rna: string | null
  siren: string | null
  prenom: string
  nom: string
  email: string
  message: string | null
  cgu_acceptees: boolean
}

/** RNA saisi : majuscules, sans espaces (« w 751 234 567 » → « W751234567 »). */
export function normaliserRna(valeur: string): string {
  return valeur.replace(/\s+/g, '').toUpperCase()
}

/** SIREN saisi : chiffres seulement (espaces de présentation retirés). */
export function normaliserSiren(valeur: string): string {
  return valeur.replace(/\s+/g, '')
}

export function normaliserEmailInscription(valeur: string): string {
  return valeur.trim().toLowerCase()
}

function texte(valeur: unknown): string {
  return typeof valeur === 'string' ? valeur : ''
}

/**
 * Erreur d'un champ (null si conforme). `cguRequises` : la case CGU n'est exigée que lorsqu'elle
 * est affichée (CGU publiées).
 */
export function erreurChampInscription(
  champ: ChampInscription,
  saisie: SaisieInscription,
  cguRequises: boolean,
): string | null {
  switch (champ) {
    case 'nom_association': {
      const v = saisie.nom_association.trim()
      if (!v) return 'Indique le nom de ton association.'
      if (v.length < LONGUEURS_INSCRIPTION.nom_association.min) return 'Nom trop court.'
      if (v.length > LONGUEURS_INSCRIPTION.nom_association.max) return `${LONGUEURS_INSCRIPTION.nom_association.max} caractères au maximum.`
      return null
    }
    case 'ville': {
      const v = saisie.ville.trim()
      if (!v) return 'Indique la ville de ton association.'
      if (v.length > LONGUEURS_INSCRIPTION.ville.max) return `${LONGUEURS_INSCRIPTION.ville.max} caractères au maximum.`
      return null
    }
    case 'rna': {
      const v = normaliserRna(saisie.rna)
      if (v && !RNA_REGEX.test(v)) return 'Le numéro RNA commence par W, suivi de 9 chiffres (ex. W751234567).'
      return null
    }
    case 'siren': {
      const v = normaliserSiren(saisie.siren)
      if (v && !SIREN_REGEX.test(v)) return 'Le SIREN compte 9 chiffres.'
      return null
    }
    case 'prenom':
    case 'nom': {
      const v = saisie[champ].trim()
      if (!v) return champ === 'prenom' ? 'Indique ton prénom.' : 'Indique ton nom.'
      if (v.length > LONGUEURS_INSCRIPTION[champ].max) return `${LONGUEURS_INSCRIPTION[champ].max} caractères au maximum.`
      return null
    }
    case 'email': {
      const v = normaliserEmailInscription(saisie.email)
      if (!v) return 'Indique ton adresse email.'
      if (v.length > LONGUEURS_INSCRIPTION.email.max || !EMAIL_REGEX.test(v)) return 'Adresse email invalide (ex. prenom@exemple.fr).'
      return null
    }
    case 'message':
      if (saisie.message.trim().length > LONGUEURS_INSCRIPTION.message.max) return `${LONGUEURS_INSCRIPTION.message.max} caractères au maximum.`
      return null
    case 'cgu':
      if (cguRequises && !saisie.cgu_acceptees) return 'Accepte les CGU pour envoyer ta demande.'
      return null
  }
}

export function erreursInscription(saisie: SaisieInscription, cguRequises: boolean): Partial<Record<ChampInscription, string>> {
  const erreurs: Partial<Record<ChampInscription, string>> = {}
  for (const champ of ORDRE_CHAMPS_INSCRIPTION) {
    const erreur = erreurChampInscription(champ, saisie, cguRequises)
    if (erreur) erreurs[champ] = erreur
  }
  return erreurs
}

/** Champs reçus (corps JSON non fiable) → saisie typée, chaînes vides par défaut. */
export function saisieDepuisCorps(corps: unknown): SaisieInscription {
  const c = (corps && typeof corps === 'object' ? corps : {}) as Record<string, unknown>
  return {
    nom_association: texte(c.nom_association),
    ville: texte(c.ville),
    rna: texte(c.rna),
    siren: texte(c.siren),
    prenom: texte(c.prenom),
    nom: texte(c.nom),
    email: texte(c.email),
    message: texte(c.message),
    cgu_acceptees: c.cgu_acceptees === true,
  }
}

/** Demande prête à enregistrer (champs normalisés), ou les erreurs. */
export function validerDemandeInscription(
  saisie: SaisieInscription,
  cguRequises: boolean,
): { ok: true; demande: DemandeInscriptionNormalisee } | { ok: false; erreurs: Partial<Record<ChampInscription, string>> } {
  const erreurs = erreursInscription(saisie, cguRequises)
  if (Object.keys(erreurs).length > 0) return { ok: false, erreurs }
  const rna = normaliserRna(saisie.rna)
  const siren = normaliserSiren(saisie.siren)
  const message = saisie.message.trim()
  return {
    ok: true,
    demande: {
      nom_association: saisie.nom_association.trim(),
      ville: saisie.ville.trim(),
      rna: rna || null,
      siren: siren || null,
      prenom: saisie.prenom.trim(),
      nom: saisie.nom.trim(),
      email: normaliserEmailInscription(saisie.email),
      message: message || null,
      cgu_acceptees: saisie.cgu_acceptees,
    },
  }
}

// ---------------------------------------------------------------------------
// Suggestion de domaine (fautes de frappe courantes, liste courte en dur)

const DOMAINES_CORRIGES: Record<string, string> = {
  'gmial.com': 'gmail.com',
  'gmal.com': 'gmail.com',
  'gmaill.com': 'gmail.com',
  'gmail.co': 'gmail.com',
  'gmail.fr': 'gmail.com',
  'gmai.com': 'gmail.com',
  'gnail.com': 'gmail.com',
  'gamil.com': 'gmail.com',
  'gmail.con': 'gmail.com',
  'hotmial.com': 'hotmail.com',
  'hotmal.com': 'hotmail.com',
  'hotmail.con': 'hotmail.com',
  'hotmial.fr': 'hotmail.fr',
  'hotmal.fr': 'hotmail.fr',
  'outlok.com': 'outlook.com',
  'outlook.con': 'outlook.com',
  'outlok.fr': 'outlook.fr',
  'yahou.fr': 'yahoo.fr',
  'yaho.fr': 'yahoo.fr',
  'yahoo.con': 'yahoo.com',
  'wanado.fr': 'wanadoo.fr',
  'wanadoo.com': 'wanadoo.fr',
  'orage.fr': 'orange.fr',
  'ornage.fr': 'orange.fr',
  'orange.com': 'orange.fr',
  'fre.fr': 'free.fr',
  'sfr.com': 'sfr.fr',
  'laposte.com': 'laposte.net',
  'laposte.fr': 'laposte.net',
  'icoud.com': 'icloud.com',
  'iclod.com': 'icloud.com',
}

/** Adresse corrigée si le domaine est une faute courante (« x@gmial.com » → « x@gmail.com »), sinon null. */
export function suggestionDomaineEmail(email: string): string | null {
  const v = email.trim()
  const arobase = v.lastIndexOf('@')
  if (arobase <= 0) return null
  const domaine = v.slice(arobase + 1).toLowerCase()
  const corrige = DOMAINES_CORRIGES[domaine]
  return corrige ? `${v.slice(0, arobase)}@${corrige}` : null
}
