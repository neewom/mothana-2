import type { Adherent, Adhesion } from '../types'
import type { ColonneAdherent } from './adherentsColonnes'
import { CIVILITE_ADHERENT_LABELS } from './civiliteAdherent'
import { libelleAdhesion } from './adherentsFiltres'

// Export CSV de la page Adhérents (cadré 2026-10-17) : la liste telle qu'affichée — mêmes
// colonnes, dans l'ordre du tableau (Nom et Prénom toujours présents). Seules les colonnes
// affichées sont exportées (minimisation des données personnelles, décision utilisateur).

type ColonneExport = ColonneAdherent | 'nom' | 'prenom'

/** Ordre des colonnes du tableau AdherentsPage — à garder aligné avec son en-tête. */
export const ORDRE_COLONNES_TABLEAU: ColonneExport[] = [
  'civilite',
  'nom',
  'prenom',
  'statut',
  'adhesion',
  'date_adhesion',
  'email',
  'telephone',
  'adresse',
  'localisation',
  'date_naissance',
  'listes',
]

function dateFr(iso: string | null): string {
  if (!iso) return ''
  const [annee, mois, jour] = iso.split('T')[0].split('-')
  return `${jour}/${mois}/${annee}`
}

function cellules(
  colonne: ColonneExport,
  a: Adherent,
  adhesion: Pick<Adhesion, 'date_debut' | 'date_fin'> | undefined,
  today: string,
): Record<string, string> {
  switch (colonne) {
    case 'civilite':
      return { 'Civilité': a.civilite ? CIVILITE_ADHERENT_LABELS[a.civilite] : '' }
    case 'nom':
      return { Nom: a.nom }
    case 'prenom':
      return { 'Prénom': a.prenom ?? '' }
    case 'statut':
      return { Statut: a.statut === 'actif' ? 'Actif' : 'Archivé' }
    case 'adhesion':
      return { 'Adhésion': libelleAdhesion(adhesion, today).label }
    case 'date_adhesion':
      return { "Date d'adhésion": dateFr(adhesion?.date_debut ?? null) }
    case 'email':
      return { Email: a.courriel ?? '' }
    case 'telephone':
      return { 'Téléphone': a.telephone ?? '' }
    case 'adresse':
      return { Adresse: a.adresse ?? '' }
    case 'localisation':
      // Une colonne par champ : plus utile qu'un libellé composé pour un publipostage.
      return { 'Code postal': a.code_postal ?? '', Ville: a.ville ?? '', Pays: a.pays ?? '' }
    case 'date_naissance':
      return { 'Date de naissance': dateFr(a.date_naissance) }
    case 'listes':
      return { Listes: a.tags.join(', ') }
  }
}

export function lignesExportAdherents(
  adherents: Adherent[],
  adhesions: Map<string, Pick<Adhesion, 'date_debut' | 'date_fin'>>,
  colonnesVisibles: ColonneAdherent[],
  today: string,
): Record<string, string>[] {
  const colonnes = ORDRE_COLONNES_TABLEAU.filter(
    (c) => c === 'nom' || c === 'prenom' || colonnesVisibles.includes(c),
  )
  return adherents.map((a) =>
    Object.assign({}, ...colonnes.map((c) => cellules(c, a, adhesions.get(a.id), today))),
  )
}

const SLUG_STATUT: Record<string, string> = { a_jour: 'actifs', expire: 'expires', archive: 'archives', all: 'tous' }

export function nomFichierExportAdherents(statut: string, selection: boolean, today: string): string {
  return `adherents_${selection ? 'selection' : SLUG_STATUT[statut] ?? statut}_${today}.csv`
}
