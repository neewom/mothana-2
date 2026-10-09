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
  /** Intertitre affiché avant le premier élément d'une section (sous-menu Paramètres). */
  section?: string
}

export type NavEntry = NavLinkItem | NavGroup

export interface NavOptions {
  /** Admin de l'organisation (pas contributeur, pas super-admin en mode Consulter). */
  canManageTeam: boolean
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
        { label: 'Dons', to: '/admin/dons' },
        { label: 'Dons réguliers', to: '/admin/dons-reguliers', count: counters.donsReguliersAConfirmer },
        { label: 'Donateurs', to: '/admin/participants' },
        { label: 'Reçus fiscaux', to: '/admin/recus' },
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
      ],
    })
  }

  // Activités regroupe l'agenda et le porte-monnaie (une fête est d'abord une activité).
  const activiteItems = [
    ...(flags.dons || flags.adherents ? [{ label: 'Toutes les activités', to: '/admin/activites', end: true }] : []),
    ...(flags.evenements ? [{ label: 'Porte-monnaie', to: '/admin/activites/porte-monnaie' }] : []),
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

  // Paramètres rangés par sujet (simulation 6) ; « Mon compte » est dans le menu compte.
  const parametres: NavGroupItem[] = [
    { label: 'Organisation', to: '/admin/parametres', end: true, section: 'Association' },
    ...(flags.dons ? [{ label: 'Reçus fiscaux', to: '/admin/parametres/recus-fiscaux' }] : []),
    ...(flags.adherents ? [{ label: 'Adhésions', to: '/admin/parametres/adhesions' }] : []),
    ...(flags.evenements ? [{ label: 'Porte-monnaie', to: '/admin/parametres/porte-monnaie' }] : []),
    ...(options.canManageTeam ? [{ label: 'Équipe', to: '/admin/parametres/equipe', section: 'Accès' }] : []),
    { label: 'Codes PIN', to: '/admin/parametres/codes-pin', ...(options.canManageTeam ? {} : { section: 'Accès' }) },
    ...(flags.adherents ? [{ label: 'Intégrations', to: '/admin/parametres/integrations', section: 'Outils' }] : []),
    { label: 'Journal des adhérents', to: '/admin/parametres/journal', ...(flags.adherents ? {} : { section: 'Outils' }) },
  ]
  items.push({ type: 'group', label: 'Paramètres', icon: 'cog', items: parametres })

  return items
}
