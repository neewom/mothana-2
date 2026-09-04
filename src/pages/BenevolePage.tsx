import { useState, useEffect, useRef, useCallback, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { supabase } from '../lib/supabaseClient'
import type { ProfilParticipant, Activite } from '../types'
import { useFocusTrap } from '../hooks/useFocusTrap'
import ActiviteAutocomplete from '../components/ActiviteAutocomplete'
import BenevoleVerificationAdherent from '../components/BenevoleVerificationAdherent'
import RecetteBanner from '../components/RecetteBanner'
import { cn } from '../lib/utils'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { Label } from '../components/ui/label'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function todayISO(): string {
  return new Date().toISOString().split('T')[0]
}

function generateUUID(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16))
  bytes[6] = (bytes[6] & 0x0f) | 0x40
  bytes[8] = (bytes[8] & 0x3f) | 0x80
  const hex = Array.from(bytes).map((b) => b.toString(16).padStart(2, '0'))
  return `${hex.slice(0, 4).join('')}-${hex.slice(4, 6).join('')}-${hex.slice(6, 8).join('')}-${hex.slice(8, 10).join('')}-${hex.slice(10).join('')}`
}

function participantLabel(p: ProfilParticipant): string {
  if (!p.personnes) return '—'
  return p.personnes.prenom
    ? `${p.personnes.prenom} ${p.personnes.nom}`
    : p.personnes.nom
}

// ---------------------------------------------------------------------------
// PIN re-entry overlay (shown when session expires)
// ---------------------------------------------------------------------------

function PinOverlay({ onSuccess }: { onSuccess: () => void }) {
  const { loginBenevole } = useAuth()
  const [pin, setPin] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  // Non-dismissible: no onEscape, session re-authentication is mandatory.
  // Still traps Tab so focus can't leave onto the page hidden behind it.
  useFocusTrap(containerRef, true)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    const { error: err } = await loginBenevole(pin)
    setLoading(false)
    if (err) setError(err)
    else onSuccess()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4 font-registre">
      <div ref={containerRef} role="dialog" aria-modal="true" aria-labelledby="pin-overlay-title" className="w-full max-w-sm rounded-sm border border-paper-border bg-white p-8 shadow-xl">
        <h2 id="pin-overlay-title" className="text-lg font-semibold text-ink">Session expirée</h2>
        <p className="mt-1 text-sm text-ink-muted">
          Ressaisissez le code PIN pour continuer — votre saisie en cours est conservée.
        </p>
        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <input
            type="text"
            inputMode="numeric"
            maxLength={10}
            required
            value={pin}
            onChange={(e) => setPin(e.target.value)}
            className="block w-full rounded-sm border border-paper-border bg-paper px-4 py-4 text-center font-registre-mono text-3xl font-bold tracking-[0.5em] text-ink focus:border-stamp focus:outline-none focus:ring-2 focus:ring-stamp/70"
            placeholder="••••"
          />
          {error && <div className="rounded-sm border border-stamp/30 bg-stamp/[0.04] px-4 py-3 text-sm text-stamp">{error}</div>}
          <Button type="submit" disabled={loading || pin.length === 0} className="w-full">
            {loading ? 'Vérification…' : 'Continuer'}
          </Button>
        </form>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// BenevolePage
// ---------------------------------------------------------------------------

export default function BenevolePage() {
  const { auth, logout } = useAuth()
  const navigate = useNavigate()

  const organisationId = auth.type === 'benevole' ? auth.organisationId : ''

  const [organisationNom, setOrganisationNom] = useState<string | null>(null)

  // Onglets
  const [activeTab, setActiveTab] = useState<'don' | 'verification'>('don')

  // Data
  const [participants, setParticipants] = useState<ProfilParticipant[]>([])
  const [activites, setActivites] = useState<Activite[]>([])
  const [dataLoading, setDataLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)

  // Participant search
  const [search, setSearch] = useState('')
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const [selectedParticipant, setSelectedParticipant] = useState<ProfilParticipant | null>(null)
  const searchRef = useRef<HTMLDivElement>(null)

  // New participant inline form
  const [showNew, setShowNew] = useState(false)
  const [newNom, setNewNom] = useState('')
  const [newPrenom, setNewPrenom] = useState('')
  const [newEmail, setNewEmail] = useState('')

  // Don fields
  const [activiteId, setActiviteId] = useState('')
  const [montant, setMontant] = useState('')
  const [date, setDate] = useState(todayISO())
  const [modePaiement, setModePaiement] = useState<'virement' | 'cheque' | 'especes'>('virement')

  // UI state
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [sessionExpired, setSessionExpired] = useState(false)

  // Close dropdown on outside click
  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [])

  // Detect session expiry via Supabase auth events
  useEffect(() => {
    const { data: listener } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT') {
        setSessionExpired(true)
      }
    })
    return () => listener.subscription.unsubscribe()
  }, [])

  const loadData = useCallback(async () => {
    setDataLoading(true)
    setLoadError(null)

    const [partsResult, actsResult] = await Promise.all([
      supabase
        .from('profils_participant')
        .select('*, personnes(*)')
        .eq('organisation_id', organisationId)
        .order('created_at', { ascending: false }),
      supabase
        .from('activites')
        .select('*')
        .eq('organisation_id', organisationId)
        .order('created_at', { ascending: false }),
    ])

    if (partsResult.error || actsResult.error) {
      const msg = partsResult.error?.message ?? actsResult.error?.message ?? 'Erreur de chargement'
      // Auth errors → show PIN overlay instead of error message
      if (msg.toLowerCase().includes('jwt') || msg.toLowerCase().includes('unauthorized')) {
        setSessionExpired(true)
      } else {
        setLoadError(msg)
      }
      setDataLoading(false)
      return
    }

    setParticipants(
      ((partsResult.data ?? []) as ProfilParticipant[]).filter((p) => p.personnes)
    )
    setActivites((actsResult.data ?? []) as Activite[])
    setDataLoading(false)
  }, [organisationId])

  useEffect(() => {
    if (organisationId) loadData()
  }, [organisationId, loadData])

  useEffect(() => {
    if (!organisationId) return
    void supabase
      .from('organisations')
      .select('nom')
      .eq('id', organisationId)
      .single()
      .then(({ data }) => {
        if (data) setOrganisationNom((data as { nom: string }).nom)
      })
  }, [organisationId])

  const filtered = search.trim()
    ? participants.filter((p) =>
        participantLabel(p).toLowerCase().includes(search.toLowerCase()),
      )
    : participants

  function selectParticipant(p: ProfilParticipant) {
    setSelectedParticipant(p)
    setSearch(participantLabel(p))
    setDropdownOpen(false)
    setShowNew(false)
    setNewNom('')
    setNewPrenom('')
    setNewEmail('')
  }

  function clearParticipant() {
    setSelectedParticipant(null)
    setSearch('')
    setDropdownOpen(false)
  }

  function resetForm() {
    setSelectedParticipant(null)
    setSearch('')
    setShowNew(false)
    setNewNom('')
    setNewPrenom('')
    setNewEmail('')
    setActiviteId('')
    setMontant('')
    setDate(todayISO())
    setModePaiement('virement')
    setError(null)
    setSuccess(false)
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setSaving(true)

    let profilParticipantId: string | null = selectedParticipant?.id ?? null

    // Create new participant if inline form is shown
    if (!profilParticipantId && showNew) {
      if (!newNom.trim()) {
        setError('Le nom est requis.')
        setSaving(false)
        return
      }

      const personneId = generateUUID()

      const { error: personneErr } = await supabase
        .from('personnes')
        .insert({
          id: personneId,
          nom: newNom.trim(),
          prenom: newPrenom.trim() || null,
          email: newEmail.trim() || null,
        })

      if (personneErr) {
        setError(personneErr.message)
        setSaving(false)
        return
      }

      const profilId = generateUUID()
      const { error: profilErr } = await supabase
        .from('profils_participant')
        .insert({ id: profilId, personne_id: personneId, organisation_id: organisationId })

      if (profilErr) {
        setError(profilErr.message)
        setSaving(false)
        return
      }

      profilParticipantId = profilId
    }

    if (!profilParticipantId) {
      setError('Veuillez sélectionner ou créer un participant.')
      setSaving(false)
      return
    }

    const { error: donErr } = await supabase.from('dons').insert({
      profil_participant_id: profilParticipantId,
      organisation_id: organisationId,
      activite_id: activiteId || null,
      montant: parseFloat(montant),
      date,
      mode_paiement: modePaiement,
      created_by_role: 'benevole',
    })

    setSaving(false)

    if (donErr) {
      setError(donErr.message)
      return
    }

    setSuccess(true)
    await loadData()
  }

  async function handleLogout() {
    await logout()
    navigate('/', { replace: true })
  }

  return (
    <div className="flex min-h-dvh flex-col bg-paper font-registre">
      {sessionExpired && (
        <PinOverlay
          onSuccess={() => {
            setSessionExpired(false)
            loadData()
          }}
        />
      )}

      <RecetteBanner />

      {/* Header */}
      <header className="border-b border-paper-border bg-white px-4">
        <div className="flex h-14 items-center justify-between">
          <span className="text-base font-bold tracking-tight text-ink">Samakan</span>
          <Button variant="secondary" size="sm" onClick={handleLogout}>
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15M12 9l-3 3m0 0l3 3m-3-3h12.75" />
            </svg>
            Quitter
          </Button>
        </div>
        <div className="pb-2 text-xs font-medium text-ink-faint">
          Espace bénévole — {organisationNom ?? '…'}
        </div>
      </header>

      {/* Content */}
      <main className="flex flex-1 items-start justify-center px-4 py-8">
        <div className="w-full max-w-lg">
          <div className="mb-6 flex gap-2 rounded-sm bg-paper-border/40 p-1">
            <button
              type="button"
              onClick={() => setActiveTab('don')}
              className={cn(
                'flex-1 rounded-sm px-3 py-2 text-sm font-medium transition-colors',
                activeTab === 'don' ? 'bg-white text-ink shadow-sm' : 'text-ink-faint hover:text-ink-muted'
              )}
            >
              Saisir un don
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('verification')}
              className={cn(
                'flex-1 rounded-sm px-3 py-2 text-sm font-medium transition-colors',
                activeTab === 'verification' ? 'bg-white text-ink shadow-sm' : 'text-ink-faint hover:text-ink-muted'
              )}
            >
              Vérifier un adhérent
            </button>
          </div>

          {activeTab === 'verification' ? (
            <BenevoleVerificationAdherent organisationId={organisationId} />
          ) : (
            <>
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-ink">Saisie d'un don</h1>
            <p className="mt-1 text-sm text-ink-muted">Remplissez le formulaire pour enregistrer un don.</p>
          </div>

          {dataLoading ? (
            <div className="flex items-center justify-center py-16 text-sm text-ink-faint">
              Chargement…
            </div>
          ) : loadError ? (
            <div className="rounded-sm border border-stamp/30 bg-stamp/[0.04] p-6 text-center">
              <p className="text-sm font-medium text-stamp">Erreur de chargement</p>
              <p className="mt-1 text-xs text-stamp">{loadError}</p>
              <Button variant="destructive" onClick={loadData} className="mt-4">
                Réessayer
              </Button>
            </div>
          ) : success ? (
            /* Success state */
            <div className="rounded-sm border border-success-border bg-success-tint p-8 text-center">
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-white text-success">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                </svg>
              </div>
              <h2 className="text-lg font-semibold text-success">Don enregistré !</h2>
              <p className="mt-1 text-sm text-success">
                Le don de{' '}
                <span className="font-medium">
                  {parseFloat(montant).toLocaleString('fr-FR', { minimumFractionDigits: 2 })} €
                </span>{' '}
                a bien été enregistré.
              </p>
              <Button variant="success" onClick={resetForm} className="mt-6">
                Saisir un nouveau don
              </Button>
            </div>
          ) : (
            /* Form */
            <form onSubmit={handleSubmit} className="space-y-5 rounded-sm border border-paper-border bg-white p-6">
              {error && (
                <div className="rounded-sm border border-stamp/30 bg-stamp/[0.04] px-4 py-3 text-sm text-stamp">{error}</div>
              )}

              {/* Participant */}
              <div>
                <Label>
                  Participant <span className="text-stamp">*</span>
                </Label>

                <div ref={searchRef} className="relative mt-1">
                  <div className="relative">
                    <Input
                      type="text"
                      value={search}
                      disabled={showNew}
                      onChange={(e) => {
                        setSearch(e.target.value)
                        setSelectedParticipant(null)
                        setDropdownOpen(true)
                      }}
                      onFocus={() => !showNew && setDropdownOpen(true)}
                      placeholder="Rechercher un participant…"
                      className="pr-8"
                    />
                    {selectedParticipant && (
                      <button
                        type="button"
                        onClick={clearParticipant}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-ink-faint hover:text-ink-muted"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    )}
                  </div>

                  {dropdownOpen && !showNew && (
                    <div className="absolute z-20 mt-1 max-h-52 w-full overflow-y-auto rounded-sm border border-paper-border bg-white shadow-lg">
                      {filtered.length === 0 ? (
                        <div className="px-4 py-3 text-sm text-ink-faint">Aucun résultat</div>
                      ) : (
                        filtered.map((p) => (
                          <button
                            key={p.id}
                            type="button"
                            onMouseDown={(e) => {
                              e.preventDefault()
                              selectParticipant(p)
                            }}
                            className="flex w-full items-center px-4 py-2.5 text-left text-sm text-ink-muted hover:bg-paper"
                          >
                            <span className="font-medium">{participantLabel(p)}</span>
                          </button>
                        ))
                      )}
                    </div>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setShowNew(!showNew)
                    setSelectedParticipant(null)
                    setSearch('')
                    setDropdownOpen(false)
                  }}
                  className="mt-2 flex items-center gap-1 text-xs font-medium text-stamp hover:underline"
                >
                  {showNew ? (
                    <>
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                      Annuler la création
                    </>
                  ) : (
                    <>
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                      </svg>
                      Nouveau participant
                    </>
                  )}
                </button>

                {showNew && (
                  <div className="mt-3 space-y-3 rounded-sm border border-paper-border bg-paper p-4">
                    <p className="text-xs font-semibold uppercase tracking-wide text-ink-faint">Nouveau participant</p>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label className="text-xs">Prénom</Label>
                        <Input
                          type="text"
                          value={newPrenom}
                          onChange={(e) => setNewPrenom(e.target.value)}
                          placeholder="Jean"
                          className="mt-1"
                        />
                      </div>
                      <div>
                        <Label className="text-xs">
                          Nom <span className="text-stamp">*</span>
                        </Label>
                        <Input
                          type="text"
                          value={newNom}
                          onChange={(e) => setNewNom(e.target.value)}
                          placeholder="Dupont"
                          className="mt-1"
                        />
                      </div>
                    </div>
                    <div>
                      <Label className="text-xs">Email (optionnel)</Label>
                      <Input
                        type="email"
                        value={newEmail}
                        onChange={(e) => setNewEmail(e.target.value)}
                        placeholder="jean.dupont@exemple.fr"
                        className="mt-1"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Activité */}
              <div>
                <Label>Activité</Label>
                <div className="mt-1">
                  <ActiviteAutocomplete
                    activites={activites}
                    value={activiteId}
                    onChange={setActiviteId}
                    placeholder="Aucune activité"
                  />
                </div>
              </div>

              {/* Montant */}
              <div>
                <Label>
                  Montant (€) <span className="text-stamp">*</span>
                </Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0.01"
                  required
                  value={montant}
                  onChange={(e) => setMontant(e.target.value)}
                  placeholder="0.00"
                  className="mt-1"
                />
              </div>

              {/* Date */}
              <div>
                <Label>
                  Date <span className="text-stamp">*</span>
                </Label>
                <Input
                  type="date"
                  required
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="mt-1"
                />
              </div>

              {/* Mode de paiement */}
              <div>
                <Label>
                  Mode de paiement <span className="text-stamp">*</span>
                </Label>
                <div className="mt-1 grid grid-cols-3 gap-2">
                  {(['virement', 'cheque', 'especes'] as const).map((mode) => (
                    <button
                      key={mode}
                      type="button"
                      onClick={() => setModePaiement(mode)}
                      className={cn(
                        'rounded-sm border px-3 py-2 text-sm font-medium transition-colors',
                        modePaiement === mode
                          ? 'border-stamp bg-stamp text-white'
                          : 'border-paper-border bg-white text-ink-muted hover:bg-paper'
                      )}
                    >
                      {mode === 'virement' ? 'Virement' : mode === 'cheque' ? 'Chèque' : 'Espèces'}
                    </button>
                  ))}
                </div>
              </div>

              <Button type="submit" disabled={saving || (!selectedParticipant && !showNew)} className="w-full">
                {saving ? 'Enregistrement…' : 'Enregistrer le don'}
              </Button>
            </form>
          )}
            </>
          )}
        </div>
      </main>
    </div>
  )
}
