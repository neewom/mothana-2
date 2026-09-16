import { useState, useEffect, type FormEvent } from 'react'
import { supabase } from '../lib/supabaseClient'
import { getCanonicalSiteUrl } from '../lib/environment'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { Label } from './ui/label'
import { Badge } from './ui/badge'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string

interface AccountRow {
  utilisateur_id: string
  nom_affiche: string | null
  email: string
  role: 'admin' | 'contributeur'
  created_at: string
  is_banned: boolean
}

interface AdminAccountsManagerProps {
  organisationId: string
  /** Ne garder que ces rôles dans la liste affichée (get_org_admins renvoie admin + contributeur). */
  filterRoles?: Array<'admin' | 'contributeur'>
  /** Afficher un badge de rôle sur chaque ligne (utile quand la liste mélange plusieurs rôles). */
  showRoleBadge?: boolean
  heading?: string
  addButtonLabel?: string
  newFormTitle?: string
  emptyLabel?: string
  onAccountAdded?: (email: string) => void
}

const ROLE_LABELS: Record<AccountRow['role'], string> = {
  admin: 'Admin',
  contributeur: 'Contributeur',
}

export default function AdminAccountsManager({
  organisationId,
  filterRoles,
  showRoleBadge = false,
  heading = 'Comptes admin',
  addButtonLabel = 'Ajouter un admin',
  newFormTitle = 'Nouveau compte admin',
  emptyLabel = 'Aucun compte pour cette organisation.',
  onAccountAdded,
}: AdminAccountsManagerProps) {
  const [accounts, setAccounts] = useState<AccountRow[]>([])
  const [loading, setLoading] = useState(false)
  const [listError, setListError] = useState<string | null>(null)
  const [showDisabled, setShowDisabled] = useState(false)
  const [showAddForm, setShowAddForm] = useState(false)
  const [newNom, setNewNom] = useState('')
  const [newEmail, setNewEmail] = useState('')
  const [addError, setAddError] = useState<string | null>(null)
  const [adding, setAdding] = useState(false)
  const [banningId, setBanningId] = useState<string | null>(null)

  useEffect(() => {
    fetchAccounts()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [organisationId])

  async function fetchAccounts() {
    setLoading(true)
    setListError(null)
    const { data, error: err } = await supabase.rpc('get_org_admins', { org_id: organisationId })
    if (err) {
      setListError(err.message)
    } else {
      const rows = (data ?? []) as AccountRow[]
      setAccounts(filterRoles ? rows.filter((r) => filterRoles.includes(r.role)) : rows)
    }
    setLoading(false)
  }

  async function handleAdd(e: FormEvent) {
    e.preventDefault()
    setAddError(null)
    setAdding(true)

    const { data: sessionData } = await supabase.auth.getSession()
    const token = sessionData.session?.access_token ?? ''

    const res = await fetch(`${SUPABASE_URL}/functions/v1/create-admin`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        apikey: SUPABASE_ANON_KEY,
      },
      body: JSON.stringify({ nom: newNom, email: newEmail, organisation_id: organisationId, site_url: getCanonicalSiteUrl() }),
    })
    const json = await res.json()
    setAdding(false)

    if (!res.ok) {
      setAddError(json.error ?? 'Erreur lors de la création du compte')
      return
    }

    setShowAddForm(false)
    setNewNom('')
    setNewEmail('')
    onAccountAdded?.(newEmail)
    fetchAccounts()
  }

  async function handleToggleBan(account: AccountRow) {
    setBanningId(account.utilisateur_id)

    const { data: sessionData } = await supabase.auth.getSession()
    const token = sessionData.session?.access_token ?? ''

    const res = await fetch(`${SUPABASE_URL}/functions/v1/disable-admin`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        apikey: SUPABASE_ANON_KEY,
      },
      body: JSON.stringify({ utilisateur_id: account.utilisateur_id, ban: !account.is_banned }),
    })
    setBanningId(null)

    if (!res.ok) {
      const json = await res.json()
      setListError(json.error ?? 'Erreur lors de la mise à jour du compte')
      return
    }

    fetchAccounts()
  }

  const disabledCount = accounts.filter((a) => a.is_banned).length
  const visibleAccounts = showDisabled ? accounts : accounts.filter((a) => !a.is_banned)

  return (
    <div className="space-y-4">
      <h3 className="font-registre text-sm font-semibold text-ink">{heading}</h3>

      {listError && (
        <div className="rounded-sm border border-stamp/30 bg-stamp/[0.04] px-4 py-3 font-registre text-sm text-stamp">{listError}</div>
      )}

      {loading ? (
        <div className="py-6 text-center font-registre text-sm text-ink-faint">Chargement…</div>
      ) : accounts.length === 0 ? (
        <div className="py-6 text-center font-registre text-sm text-ink-faint">{emptyLabel}</div>
      ) : (
        <>
          {visibleAccounts.length === 0 ? (
            <div className="py-6 text-center font-registre text-sm text-ink-faint">Tous les comptes sont désactivés.</div>
          ) : (
            <ul className="divide-y divide-paper-border-muted rounded-sm border border-paper-border">
              {visibleAccounts.map((account) => (
                <li key={account.utilisateur_id} className="flex items-center justify-between px-4 py-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="truncate font-registre text-sm font-medium text-ink">
                        {account.nom_affiche ?? '—'}
                      </p>
                      {showRoleBadge && <Badge variant="neutral">{ROLE_LABELS[account.role]}</Badge>}
                    </div>
                    <p className="truncate font-registre text-xs text-ink-faint">{account.email}</p>
                  </div>
                  <div className="ml-4 flex flex-shrink-0 items-center gap-3">
                    {account.is_banned && <Badge variant="stamp">Désactivé</Badge>}
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      onClick={() => handleToggleBan(account)}
                      disabled={banningId === account.utilisateur_id}
                    >
                      {banningId === account.utilisateur_id
                        ? '…'
                        : account.is_banned
                        ? 'Réactiver'
                        : 'Désactiver'}
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
          {disabledCount > 0 && (
            <button
              type="button"
              onClick={() => setShowDisabled((prev) => !prev)}
              className="font-registre-mono text-xs font-medium text-stamp hover:text-stamp/80"
            >
              {showDisabled ? 'Masquer les comptes désactivés' : `Afficher les comptes désactivés (${disabledCount})`}
            </button>
          )}
        </>
      )}

      {showAddForm ? (
        <form onSubmit={handleAdd} className="space-y-3 rounded-sm border border-paper-border bg-paper p-4">
          <p className="font-registre-mono text-xs font-semibold uppercase tracking-wide text-ink-faint">{newFormTitle}</p>
          {addError && (
            <div className="rounded-sm border border-stamp/30 bg-stamp/[0.04] px-3 py-2 font-registre text-xs text-stamp">{addError}</div>
          )}
          <div className="space-y-1.5">
            <Label htmlFor="account-nom">
              Nom affiché <span className="text-stamp">*</span>
            </Label>
            <Input
              id="account-nom"
              type="text"
              required
              value={newNom}
              onChange={(e) => setNewNom(e.target.value)}
              placeholder="Prénom Nom"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="account-email">
              Email <span className="text-stamp">*</span>
            </Label>
            <Input
              id="account-email"
              type="email"
              required
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              placeholder="compte@exemple.fr"
            />
            <p className="text-xs text-ink-faint">Un email d'invitation sera envoyé pour définir le mot de passe.</p>
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => { setShowAddForm(false); setAddError(null) }}
            >
              Annuler
            </Button>
            <Button type="submit" size="sm" disabled={adding}>
              {adding ? 'Envoi…' : "Envoyer l'invitation"}
            </Button>
          </div>
        </form>
      ) : (
        <button
          type="button"
          onClick={() => setShowAddForm(true)}
          className="flex w-full items-center justify-center gap-2 rounded-sm border border-dashed border-paper-border py-3 font-registre text-sm font-medium text-stamp hover:bg-stamp/[0.04]"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          {addButtonLabel}
        </button>
      )}
    </div>
  )
}
