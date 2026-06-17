import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  type ReactNode,
} from 'react'
import type { User } from '@supabase/supabase-js'
import { supabase } from '../lib/supabaseClient'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type AuthState =
  | { type: 'loading' }
  | { type: 'unauthenticated' }
  | { type: 'super_admin'; user: User }
  | { type: 'admin'; user: User; organisationId: string }
  | { type: 'benevole'; organisationId: string }

interface AuthContextValue {
  auth: AuthState
  loginAdmin: (email: string, password: string) => Promise<{ error: string | null; authType?: 'super_admin' | 'admin' }>
  loginBenevole: (pin: string) => Promise<{ error: string | null }>
  logout: () => Promise<void>
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function fetchOrganisationId(userId: string): Promise<string | null> {
  const { data, error } = await supabase
    .from('profils_organisation')
    .select('organisation_id')
    .eq('utilisateur_id', userId)
    .single()
  if (error || !data) return null
  return (data as { organisation_id: string }).organisation_id
}

function isSuperAdmin(user: User): boolean {
  const appMeta = user.app_metadata as Record<string, unknown> | undefined
  return appMeta?.is_super_admin === true
}

function getBenevoleOrgFromUser(user: User): string | null {
  const appMeta = user.app_metadata as Record<string, unknown> | undefined
  if (appMeta?.role !== 'benevole') return null
  const orgId = appMeta?.organisation_id
  return typeof orgId === 'string' ? orgId : null
}

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [auth, setAuth] = useState<AuthState>({ type: 'loading' })

  useEffect(() => {
    let cancelled = false

    async function init() {
      const { data: sessionData } = await supabase.auth.getSession()
      if (!cancelled && sessionData.session?.user) {
        const user = sessionData.session.user

        // Bénévole: dedicated Auth account with app_metadata.role = 'benevole'
        const benevoleOrgId = getBenevoleOrgFromUser(user)
        if (benevoleOrgId) {
          setAuth({ type: 'benevole', organisationId: benevoleOrgId })
          return
        }

        // Super-admin: app_metadata.is_super_admin = true
        if (isSuperAdmin(user)) {
          if (!cancelled) setAuth({ type: 'super_admin', user })
          return
        }

        // Admin: resolve organisation via profils_organisation
        const organisationId = await fetchOrganisationId(user.id)
        if (!cancelled) {
          setAuth(
            organisationId
              ? { type: 'admin', user, organisationId }
              : { type: 'unauthenticated' }
          )
        }
        return
      }

      if (!cancelled) setAuth({ type: 'unauthenticated' })
    }

    init()

    const { data: listener } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (cancelled) return

      if (event === 'SIGNED_OUT' || !session) {
        // Keep benevole state so BenevolePage can show PIN overlay without losing form
        setAuth((prev) =>
          prev.type === 'benevole' ? prev : { type: 'unauthenticated' }
        )
        return
      }

      if (session.user) {
        const benevoleOrgId = getBenevoleOrgFromUser(session.user)
        if (benevoleOrgId) {
          setAuth({ type: 'benevole', organisationId: benevoleOrgId })
          return
        }
        if (isSuperAdmin(session.user)) {
          if (!cancelled) setAuth({ type: 'super_admin', user: session.user })
          return
        }
        const organisationId = await fetchOrganisationId(session.user.id)
        if (!cancelled) {
          setAuth(
            organisationId
              ? { type: 'admin', user: session.user, organisationId }
              : { type: 'unauthenticated' }
          )
        }
      }
    })

    return () => {
      cancelled = true
      listener.subscription.unsubscribe()
    }
  }, [])

  const loginAdmin = useCallback(
    async (email: string, password: string): Promise<{ error: string | null; authType?: 'super_admin' | 'admin' }> => {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password })
      if (error || !data.user) {
        return { error: error?.message ?? 'Erreur de connexion' }
      }

      // Super-admin: no profils_organisation needed
      if (isSuperAdmin(data.user)) {
        setAuth({ type: 'super_admin', user: data.user })
        return { error: null, authType: 'super_admin' }
      }

      const organisationId = await fetchOrganisationId(data.user.id)
      if (!organisationId) {
        await supabase.auth.signOut()
        return { error: 'Aucune organisation associée à ce compte.' }
      }
      setAuth({ type: 'admin', user: data.user, organisationId })
      return { error: null, authType: 'admin' }
    },
    []
  )

  const loginBenevole = useCallback(
    async (pin: string): Promise<{ error: string | null }> => {
      try {
        // Call verify-pin: verifies PIN, creates Auth account if needed, returns session
        const res = await fetch(`${SUPABASE_URL}/functions/v1/verify-pin`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
          },
          body: JSON.stringify({ pin }),
        })
        const json = await res.json()
        if (!res.ok || !json.access_token) {
          return { error: json.error ?? 'Code PIN invalide' }
        }

        // Restore the real Supabase session into the client
        const { error: sessionError } = await supabase.auth.setSession({
          access_token: json.access_token,
          refresh_token: json.refresh_token,
        })
        if (sessionError) {
          return { error: sessionError.message }
        }

        setAuth({ type: 'benevole', organisationId: json.organisation_id })
        return { error: null }
      } catch (err) {
        console.error(err)
        return { error: 'Erreur réseau. Veuillez réessayer.' }
      }
    },
    []
  )

  const logout = useCallback(async () => {
    await supabase.auth.signOut()
    setAuth({ type: 'unauthenticated' })
  }, [])

  return (
    <AuthContext.Provider value={{ auth, loginAdmin, loginBenevole, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>')
  return ctx
}
