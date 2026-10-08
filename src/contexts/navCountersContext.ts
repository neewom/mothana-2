import { createContext } from 'react'

export interface NavCounters {
  /** Mois de dons réguliers en attente de confirmation (null : module inactif ou pas encore chargé). */
  donsReguliersAConfirmer: number | null
  /** Demandes d'adhésion en attente de ratification. */
  demandesEnAttente: number | null
}

export interface NavCountersContextValue extends NavCounters {
  /** À appeler après une confirmation ou une ratification : la pastille se met à jour sans rechargement. */
  refreshNavCounters: () => void
}

export const NavCountersContext = createContext<NavCountersContextValue>({
  donsReguliersAConfirmer: null,
  demandesEnAttente: null,
  refreshNavCounters: () => {},
})
