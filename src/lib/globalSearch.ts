import { formatCentimes } from './portefeuilleAcheteur'

// Résultats de la RPC rechercher_global (supabase/migrations/recherche_globale.sql).
export interface SearchPersonne {
  participant_id: string | null
  adherent_id: string | null
  nom: string
  prenom: string | null
  email: string | null
  adherent_statut: 'actif' | 'archive' | null
}

export interface SearchPortefeuille {
  id: string
  evenement_id: string
  evenement_nom: string
  email: string | null
  code_public: string
  solde_centimes: number
  anonymise: boolean
}

export interface SearchActivite {
  id: string
  nom: string
  date_debut: string | null
}

export interface GlobalSearchResponse {
  personnes: SearchPersonne[]
  portefeuilles: SearchPortefeuille[]
  activites: SearchActivite[]
}

export type SearchGroup = 'Personnes' | 'Portefeuilles' | 'Activités' | 'Raccourcis'

export interface SearchItem {
  key: string
  group: SearchGroup
  label: string
  sublabel: string
  to: string
}

export const SEARCH_MIN_LENGTH = 2
const MAX_RACCOURCIS = 3

function nomComplet(personne: SearchPersonne): string {
  return personne.prenom ? `${personne.prenom} ${personne.nom}` : personne.nom
}

function roles(personne: SearchPersonne): string {
  const parts: string[] = []
  if (personne.participant_id) parts.push('Donateur')
  if (personne.adherent_id) parts.push(personne.adherent_statut === 'archive' ? 'Adhérent (archivé)' : 'Adhérent')
  return parts.join(' · ')
}

/**
 * Transforme la réponse de la RPC en liste plate, dans l'ordre d'affichage des groupes : la
 * navigation au clavier parcourt cette liste. Une personne à la fois donatrice et adhérente
 * ouvre la fiche donateur ; sa fiche adhérent est proposée en raccourci.
 */
export function buildSearchItems(response: GlobalSearchResponse): SearchItem[] {
  const items: SearchItem[] = []
  const raccourcis: SearchItem[] = []

  for (const personne of response.personnes) {
    const nom = nomComplet(personne)
    const to = personne.participant_id
      ? `/admin/participants?id=${encodeURIComponent(personne.participant_id)}`
      : `/admin/adherents?id=${encodeURIComponent(personne.adherent_id ?? '')}`
    items.push({
      key: `personne:${personne.participant_id ?? ''}:${personne.adherent_id ?? ''}`,
      group: 'Personnes',
      label: nom,
      sublabel: [roles(personne), personne.email].filter(Boolean).join(' · '),
      to,
    })
    if (personne.participant_id) {
      raccourcis.push({
        key: `recus:${personne.participant_id}`,
        group: 'Raccourcis',
        label: `Reçus fiscaux de ${nom}`,
        sublabel: 'Dons › Reçus fiscaux',
        to: `/admin/recus?q=${encodeURIComponent(nom)}`,
      })
    }
    if (personne.participant_id && personne.adherent_id) {
      raccourcis.push({
        key: `adherent:${personne.adherent_id}`,
        group: 'Raccourcis',
        label: `Fiche adhérent de ${nom}`,
        sublabel: 'Adhérents',
        to: `/admin/adherents?id=${encodeURIComponent(personne.adherent_id)}`,
      })
    }
  }

  for (const portefeuille of response.portefeuilles) {
    items.push({
      key: `portefeuille:${portefeuille.id}`,
      group: 'Portefeuilles',
      label: portefeuille.anonymise || !portefeuille.email ? 'Acheteur anonymisé' : portefeuille.email,
      sublabel: `${portefeuille.evenement_nom} · ${formatCentimes(portefeuille.solde_centimes)} · ${portefeuille.code_public.slice(0, 10)}`,
      to: `/admin/activites/porte-monnaie/${encodeURIComponent(portefeuille.evenement_id)}?portefeuille=${encodeURIComponent(portefeuille.id)}`,
    })
  }

  for (const activite of response.activites) {
    items.push({
      key: `activite:${activite.id}`,
      group: 'Activités',
      label: activite.nom,
      sublabel: activite.date_debut
        ? new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(`${activite.date_debut}T12:00:00`))
        : 'Sans date',
      to: `/admin/activites?id=${encodeURIComponent(activite.id)}`,
    })
  }

  return [...items, ...raccourcis.slice(0, MAX_RACCOURCIS)]
}
