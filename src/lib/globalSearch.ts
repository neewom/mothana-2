import type { NavEntry } from './adminNav'
import { formatCentimes } from './portefeuilleAcheteur'
import { normalizeSearchText } from './participantSearch'

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

export type SearchGroup = 'Pages' | 'Personnes' | 'Portefeuilles' | 'Activités' | 'Raccourcis'

export interface SearchItem {
  key: string
  group: SearchGroup
  label: string
  sublabel: string
  to: string
}

export const SEARCH_MIN_LENGTH = 2
const MAX_RACCOURCIS = 3
const MAX_PAGES = 6

/** Page ou réglage proposé par la recherche, issu du menu latéral (mêmes filtres). */
export interface SearchPage {
  label: string
  /** Fil d'Ariane du menu (« Dons › Reçus fiscaux »). */
  sublabel: string
  to: string
  /** Mots qui trouvent aussi la page (sections qu'elle contient). */
  keywords: string
}

// Sections des pages de réglages : « cerfa » ou « pin » trouvent la bonne page.
const PAGE_KEYWORDS: Record<string, string> = {
  '/admin/participants': 'donateurs personnes',
  '/admin/dons/parametres': 'reçus fiscaux cerfa informations fiscales modèles email envoi en lot',
  '/admin/adherents/renouvellements': 'demandes adhésion',
  '/admin/adherents/parametres': 'carte adhérent durée adhésions cotisations renouvellement en ligne saisie bénévoles',
  '/admin/activites/parametres': 'porte-monnaie',
  '/admin/communication/emailing': 'email campagne',
  '/admin/parametres': 'association identité signataire visuels logo',
  '/admin/parametres/equipe': 'comptes utilisateurs codes pin bénévoles vendeurs',
  '/admin/parametres/integrations': 'brevo emailing clé api',
  '/admin/parametres/compte': 'mot de passe email profil',
}

/**
 * Pages proposées par la recherche, construites depuis le menu latéral déjà filtré par
 * buildNavItems (modules actifs, rôle, super-admin) : la recherche n'ouvre jamais une page que
 * le menu ne montre pas. Les actions rapides (« + ») n'en font pas partie. `compte` ajoute
 * « Mon compte » (menu compte, absent pour le super-admin).
 */
export function buildSearchPages(navItems: NavEntry[], options: { compte?: boolean } = {}): SearchPage[] {
  const pages: SearchPage[] = []
  for (const entry of navItems) {
    if (entry.type === 'link') {
      pages.push({ label: entry.label, sublabel: 'Menu', to: entry.to, keywords: PAGE_KEYWORDS[entry.to] ?? '' })
      continue
    }
    for (const item of entry.items) {
      // « Paramètres » d'un module : même titre que la page (« Paramètres des dons »).
      const label = item.label === 'Paramètres' && entry.label !== 'Paramètres'
        ? `Paramètres des ${entry.label.toLowerCase()}`
        : item.label
      pages.push({ label, sublabel: `${entry.label} › ${item.label}`, to: item.to, keywords: PAGE_KEYWORDS[item.to] ?? '' })
    }
  }
  if (options.compte) {
    pages.push({ label: 'Mon compte', sublabel: 'Compte › Mon compte', to: '/admin/parametres/compte', keywords: PAGE_KEYWORDS['/admin/parametres/compte'] })
  }
  return pages
}

// Mots sans accents ni casse ; tiret et apostrophe séparent (« porte-monnaie » → porte, monnaie).
function mots(text: string): string[] {
  return normalizeSearchText(text.replace(/[-'’]/g, ' ')).split(/\s+/).filter(Boolean)
}

/**
 * Pages dont un mot du titre, du fil d'Ariane ou des mots-clés commence par chaque mot saisi.
 * Début de mot et non sous-chaîne : « ma » (début d'un nom) ne doit pas remonter « Paramètres »
 * ni « Emailing » au-dessus des personnes.
 */
export function searchPages(pages: SearchPage[], terme: string): SearchItem[] {
  if (terme.trim().length < SEARCH_MIN_LENGTH) return []
  const saisis = mots(terme)
  if (saisis.length === 0) return []
  return pages
    .filter((page) => {
      const champs = mots(`${page.label} ${page.sublabel} ${page.keywords}`)
      return saisis.every((saisi) => champs.some((mot) => mot.startsWith(saisi)))
    })
    .slice(0, MAX_PAGES)
    .map((page) => ({ key: `page:${page.to}`, group: 'Pages', label: page.label, sublabel: page.sublabel, to: page.to }))
}

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
 * navigation au clavier parcourt cette liste. Les pages (calculées côté client, sans attendre la
 * RPC) viennent en tête pour que la liste ne saute pas à l'arrivée des résultats. Une personne à
 * la fois donatrice et adhérente ouvre la fiche donateur ; sa fiche adhérent est proposée en
 * raccourci.
 */
export function buildSearchItems(response: GlobalSearchResponse, pages: SearchItem[] = []): SearchItem[] {
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
        key: `dons:${personne.participant_id}`,
        group: 'Raccourcis',
        label: `Dons de ${nom}`,
        sublabel: 'Dons',
        to: `/admin/dons?q=${encodeURIComponent(nom)}`,
      })
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

  return [...pages, ...items, ...raccourcis.slice(0, MAX_RACCOURCIS)]
}
