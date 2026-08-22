import { createContext } from 'react'
import type { User } from '@supabase/supabase-js'

export type AuthState =
  | { type: 'loading' }
  | { type: 'unauthenticated' }
  | { type: 'super_admin'; user: User }
  | { type: 'admin'; user: User; organisationId: string }
  | { type: 'benevole'; organisationId: string }

export interface AuthContextValue {
  auth: AuthState
  viewingOrgId: string | null
  setViewingOrg: (orgId: string | null) => void
  loginAdmin: (email: string, password: string) => Promise<{ error: string | null; authType?: 'super_admin' | 'admin' }>
  loginBenevole: (pin: string) => Promise<{ error: string | null }>
  logout: () => Promise<void>
}

export const AuthContext = createContext<AuthContextValue | null>(null)
