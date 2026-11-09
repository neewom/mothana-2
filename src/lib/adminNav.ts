import type { NavCounters } from '../contexts/navCountersContext'
import type { FonctionnalitesActivees } from '../hooks/useFonctionnalitesActivees'

// Structure du menu latéral admin, sans JSX pour pouvoir la tester : AdminLayout associe
// chaque nom d'icône à son composant.
export type NavIconName = 'home' | 'don' | 'idCard' | 'activites' | 'megaphone' | 'chart' | 'cog'

export interface NavLinkItem {
  type: 'link'
  label: string
  to: string
  icon: NavIconName
  end?: boolean
}

export interface NavGroup {
  type: 'group'
  label: string
  icon: NavIconName
  items: NavGroupItem[]
}

export interface NavGroupItem {
  label: string
  to: string
  end?: boolean
  count?: number | null
}

export type NavEntry = NavLinkItem | NavGroup

export interface NavOptions {
  /** Admin de l'organisation (pas contributeur, pas super-admin en mode Consulter). */
  canManageTeam: boolean
  /** Codes PIN et Intégrations (secrets) : admin de l'organisation ou super-admin. */
  canManageSecrets?: boolean
}

export function buildNavItems(flags: FonctionnalitesActivees, counters: NavCounters, options: NavOptions = { canManageTeam: false }): NavEntry[] {
  const items: NavEntry[] = [
    { type: 'link', label: 'Accueil', to: '/admin', icon: 'home', end: true },
  ]

  if (flags.dons) {
    items.push({
      type: 'group',
      label: 'Dons',
      icon: 'don',
      items: [
        // `end` : la page Paramètres (/admin/dons/parametres) ne doit pas allumer aussi « Dons ».
        { label: 'Dons', to: '/admin/dons', end: true },
        { label: 'Dons réguliers', to: '/admin/dons-reguliers', count: counters.donsReguliersAConfirmer },
        { label: 'Donateurs', to: '/admin/participants' },
        { label: 'Reçus fiscaux', to: '/admin/recus' },
        { label: 'Paramètres', to: '/admin/dons/parametres' },
      ],
    })
  }

  if (flags.adherents) {
    items.push({
      type: 'group',
      label: 'Adhérents',
      icon: 'idCard',
      items: [
        { label: 'Adhérents', to: '/admin/adherents', end: true },
        { label: 'Demandes', to: '/admin/adherents/demandes', count: counters.demandesEnAttente },
        { label: 'Journal', to: '/admin/adherents/journal' },
        { label: 'Paramètres', to: '/admin/adherents/parametres' },
      ],
    })
  }

  // Activités regroupe l'agenda et le porte-monnaie (une fête est d'abord une activité).
  // Paramètres du porte-monnaie sous /admin/activites/parametres et non sous
  // /admin/activites/porte-monnaie/… : « Porte-monnaie » (sans `end`, pour rester allumé sur le
  // détail d'un événement) s'allumerait aussi.
  const activiteItems = [
    ...(flags.dons || flags.adherents ? [{ label: 'Toutes les activités', to: '/admin/activites', end: true }] : []),
    ...(flags.evenements ? [{ label: 'Porte-monnaie', to: '/admin/activites/porte-monnaie' }] : []),
    ...(flags.evenements ? [{ label: 'Paramètres', to: '/admin/activites/parametres' }] : []),
  ]
  if (activiteItems.length > 0) {
    items.push({ type: 'group', label: 'Activités', icon: 'activites', items: activiteItems })
  }

  // Communication : visible avec le module adhérents (à élargir quand les donateurs y seront inclus).
  if (flags.adherents) {
    items.push({
      type: 'group',
      label: 'Communication',
      icon: 'megaphone',
      items: [
        { label: 'Emailing', to: '/admin/communication/emailing' },
        { label: 'Courrier', to: '/admin/communication/courrier' },
      ],
    })
  }

  if (flags.dons) {
    items.push({ type: 'link', label: 'Statistiques', to: '/admin/statistiques', icon: 'chart' })
  }

  // Paramètres : le transversal seulement, les réglages d'un module sont dans son groupe
  // (passe UX du 2026-11-08) ; « Mon compte » est dans le menu compte.
  const parametres: NavGroupItem[] = [
    { label: 'Organisation', to: '/admin/parametres', end: true },
    ...(options.canManageTeam ? [{ label: 'Équipe', to: '/admin/parametres/equipe' }] : []),
    ...(options.canManageSecrets ? [{ label: 'Codes PIN', to: '/admin/parametres/codes-pin' }] : []),
    ...(flags.adherents && options.canManageSecrets ? [{ label: 'Intégrations', to: '/admin/parametres/integrations' }] : []),
  ]
  // Une seule entrée (membre : Organisation seule) : lien direct plutôt qu'un groupe à un élément.
  if (parametres.length === 1) {
    items.push({ type: 'link', label: 'Paramètres', to: parametres[0].to, icon: 'cog', end: parametres[0].end })
  } else {
    items.push({ type: 'group', label: 'Paramètres', icon: 'cog', items: parametres })
  }

  return items
}
