// Colonnes configurables du tableau AdherentsPage (cadré 2026-09-12) : préférence
// personnelle par navigateur/appareil (localStorage), pas de synchro entre admins.
// Nom/Prénom restent fixes (toujours affichés), non listés ici.

export type ColonneAdherent =
  | 'civilite'
  | 'statut'
  | 'adhesion'
  | 'email'
  | 'telephone'
  | 'localisation'
  | 'date_naissance'
  | 'listes'

export const COLONNES_DISPONIBLES: { key: ColonneAdherent; label: string }[] = [
  { key: 'civilite', label: 'Civilité' },
  { key: 'statut', label: 'Statut' },
  { key: 'adhesion', label: 'Adhésion' },
  { key: 'email', label: 'Email' },
  { key: 'telephone', label: 'Téléphone' },
  { key: 'localisation', label: 'Localisation' },
  { key: 'date_naissance', label: 'Date de naissance' },
  { key: 'listes', label: 'Listes' },
]

// Reflète l'affichage actuel avant l'introduction de ce réglage — pas de changement
// visuel surprise au premier chargement pour les admins existants.
const COLONNES_PAR_DEFAUT: ColonneAdherent[] = ['civilite', 'statut', 'adhesion']

const STORAGE_KEY = 'mothana-adherents-colonnes'

export function chargerColonnesVisibles(): ColonneAdherent[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return COLONNES_PAR_DEFAUT
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return COLONNES_PAR_DEFAUT
    const valides = COLONNES_DISPONIBLES.map((c) => c.key)
    return parsed.filter((k): k is ColonneAdherent => valides.includes(k as ColonneAdherent))
  } catch {
    return COLONNES_PAR_DEFAUT
  }
}

export function sauvegarderColonnesVisibles(colonnes: ColonneAdherent[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(colonnes))
}
