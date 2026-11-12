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
// Suggestion de domaine : comparaison avec une liste courte de domaines courants
// (distance d'édition, transposition comptée comme une seule modification).

/** Domaines courants : cibles de suggestion, et jamais corrigés eux-mêmes. */
const DOMAINES_COURANTS = [
  'gmail.com', 'hotmail.com', 'hotmail.fr', 'outlook.com', 'outlook.fr', 'live.fr', 'live.com',
  'yahoo.com', 'yahoo.fr', 'icloud.com', 'orange.fr', 'free.fr', 'sfr.fr', 'laposte.net',
  'wanadoo.fr', 'bbox.fr', 'protonmail.com',
  // Connus sans être cibles prioritaires : évitent de « corriger » une vraie adresse vers un voisin.
  'ymail.com', 'mail.com', 'gmx.fr', 'gmx.com', 'aol.com', 'msn.com', 'neuf.fr', 'me.com', 'proton.me',
]
const CONNUS = new Set(DOMAINES_COURANTS)

/** Bonne extension, mauvais pays : pas une faute de frappe, donc listés à part. */
const EXTENSION_CORRIGEE: Record<string, string> = {
  'gmail.fr': 'gmail.com',
  'wanadoo.com': 'wanadoo.fr',
  'orange.com': 'orange.fr',
  'sfr.com': 'sfr.fr',
  'laposte.com': 'laposte.net',
  'laposte.fr': 'laposte.net',
}

/** Extensions mal tapées de « .com ». */
const FAUTES_COM = new Set(['con', 'co', 'cm', 'ocm', 'cmo', 'vom', 'xom'])

/** Distance de Damerau-Levenshtein restreinte (OSA) : insertion, suppression, substitution, transposition adjacente. */
function distanceEdition(a: string, b: string): number {
  const d: number[][] = Array.from({ length: a.length + 1 }, (_, i) =>
    Array.from({ length: b.length + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0)),
  )
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cout = a[i - 1] === b[j - 1] ? 0 : 1
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cout)
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1)
      }
    }
  }
  return d[a.length][b.length]
}

/** Domaine courant le plus proche (même extension), ou null si aucun n'est assez proche. */
function domaineProche(nom: string, extension: string): string | null {
  let meilleur: string | null = null
  let meilleureDistance = Infinity
  for (const connu of DOMAINES_COURANTS) {
    const point = connu.lastIndexOf('.')
    if (connu.slice(point + 1) !== extension) continue
    const nomConnu = connu.slice(0, point)
    // Noms courts (free, sfr, live, bbox…) : une seule modification, sinon trop de faux positifs.
    const seuil = Math.min(nom.length, nomConnu.length) <= 4 ? 1 : 2
    const distance = distanceEdition(nom, nomConnu)
    if (distance <= seuil && distance < meilleureDistance) {
      meilleur = connu
      meilleureDistance = distance
    }
  }
  return meilleur
}

/** Adresse corrigée si le domaine ressemble à un domaine courant (« x@gmila.com » → « x@gmail.com »), sinon null. */
export function suggestionDomaineEmail(email: string): string | null {
  const v = email.trim()
  const arobase = v.lastIndexOf('@')
  if (arobase <= 0) return null
  const domaine = v.slice(arobase + 1).toLowerCase()
  const point = domaine.lastIndexOf('.')
  if (point <= 0 || CONNUS.has(domaine)) return null
  const nom = domaine.slice(0, point)
  const extension = domaine.slice(point + 1)
  const corrige =
    EXTENSION_CORRIGEE[domaine] ??
    domaineProche(nom, extension) ??
    // Extension mal tapée : corrigée seulement si le nom correspond alors à un domaine courant.
    (FAUTES_COM.has(extension) ? (CONNUS.has(`${nom}.com`) ? `${nom}.com` : domaineProche(nom, 'com')) : null)
  return corrige && corrige !== domaine ? `${v.slice(0, arobase)}@${corrige}` : null
}
