import { useAuth } from '../contexts/AuthContext'

/**
 * Returns the active organisation ID for the current user.
 * - Admin: their own organisation
 * - Super-admin viewing an org: the org being viewed
 * - Otherwise: empty string (should not happen in protected routes)
 */
export function useOrganisationId(): string {
  const { auth, viewingOrgId } = useAuth()
  if (viewingOrgId) return viewingOrgId
  if (auth.type === 'admin') return auth.organisationId
  return ''
}
