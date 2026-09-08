import { useOutletContext } from 'react-router-dom'
import type { FonctionnalitesActivees } from './useFonctionnalitesActivees'

export interface AdminOutletContext {
  fonctionnalitesActivees: FonctionnalitesActivees | null
}

export function useAdminOutletContext() {
  return useOutletContext<AdminOutletContext>()
}
