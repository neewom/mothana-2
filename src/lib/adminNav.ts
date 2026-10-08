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
  items: { label: string; to: string; end?: boolean; count?: number | null }[]
}

export type NavEntry = NavLinkItem | NavGroup

export function buildNavItems(flags: FonctionnalitesActivees, counters: NavCounters): NavEntry[] {
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

  items.push({
    type: 'group',
    label: 'Paramètres',
    icon: 'cog',
    items: [
      { label: 'Organisation', to: '/admin/parametres', end: true },
      { label: 'Fiscalité', to: '/admin/parametres/fiscal' },
      ...(flags.adherents ? [{ label: 'Adhérents', to: '/admin/parametres/adherents' }] : []),
      { label: 'Historique', to: '/admin/parametres/suivi' },
      // « Mon compte » vit dans le menu compte de la barre du haut (la route reste valide).
    ],
  })

  return items
}
