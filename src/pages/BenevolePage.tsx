import { useState, useEffect, useRef, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabaseClient'
import type { ProfilParticipant, Activite } from '../types'

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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-sm rounded-2xl bg-white p-8 shadow-xl">
        <h2 className="text-lg font-semibold text-slate-900">Session expirée</h2>
        <p className="mt-1 text-sm text-slate-500">
          Ressaisissez le code PIN pour continuer — votre saisie en cours est conservée.
        </p>
        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <input
            type="text"
            inputMode="numeric"
            maxLength={10}
            required
            autoFocus
            value={pin}
            onChange={(e) => setPin(e.target.value)}
            className="block w-full rounded-xl border border-slate-300 bg-slate-50 px-4 py-4 text-center text-3xl font-bold tracking-[0.5em] text-slate-900 focus:border-rose-400 focus:outline-none focus:ring-1 focus:ring-rose-400"
            placeholder="••••"
          />
          {error && <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
          <button
            type="submit"
            disabled={loading || pin.length === 0}
            className="w-full rounded-lg bg-rose-500 px-4 py-2.5 text-sm font-semibold text-white hover:bg-rose-600 disabled:opacity-60"
          >
            {loading ? 'Vérification…' : 'Continuer'}
          </button>
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

  async function loadData() {
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
  }

  useEffect(() => {
    if (organisationId) loadData()
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
    <div className="flex min-h-screen flex-col bg-slate-50">
      {sessionExpired && (
        <PinOverlay
          onSuccess={() => {
            setSessionExpired(false)
            loadData()
          }}
        />
      )}

      {/* Header */}
      <header className="flex h-14 items-center justify-between border-b border-slate-200 bg-white px-4 shadow-sm">
        <span className="text-base font-bold tracking-tight text-slate-900">Mothana</span>
        <button
          onClick={handleLogout}
          className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-50"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15M12 9l-3 3m0 0l3 3m-3-3h12.75" />
          </svg>
          Quitter
        </button>
      </header>

      {/* Content */}
      <main className="flex flex-1 items-start justify-center px-4 py-8">
        <div className="w-full max-w-lg">
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-slate-900">Saisie d'un don</h1>
            <p className="mt-1 text-sm text-slate-500">Remplissez le formulaire pour enregistrer un don.</p>
          </div>

          {dataLoading ? (
            <div className="flex items-center justify-center py-16 text-sm text-slate-400">
              Chargement…
            </div>
          ) : loadError ? (
            <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-center">
              <p className="text-sm font-medium text-red-700">Erreur de chargement</p>
              <p className="mt-1 text-xs text-red-600">{loadError}</p>
              <button
                onClick={loadData}
                className="mt-4 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
              >
                Réessayer
              </button>
            </div>
          ) : success ? (
            /* Success state */
            <div className="rounded-2xl border border-green-200 bg-green-50 p-8 text-center shadow-sm">
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-green-100 text-green-600">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                </svg>
              </div>
              <h2 className="text-lg font-semibold text-green-900">Don enregistré !</h2>
              <p className="mt-1 text-sm text-green-700">
                Le don de{' '}
                <span className="font-medium">
                  {parseFloat(montant).toLocaleString('fr-FR', { minimumFractionDigits: 2 })} €
                </span>{' '}
                a bien été enregistré.
              </p>
              <button
                onClick={resetForm}
                className="mt-6 rounded-lg bg-green-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-green-700"
              >
                Saisir un nouveau don
              </button>
            </div>
          ) : (
            /* Form */
            <form onSubmit={handleSubmit} className="space-y-5 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              {error && (
                <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
              )}

              {/* Participant */}
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">
                  Participant <span className="text-red-500">*</span>
                </label>

                <div ref={searchRef} className="relative">
                  <div className="relative">
                    <input
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
                      className="w-full rounded-lg border border-slate-300 py-2 pl-3 pr-8 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:bg-slate-50 disabled:text-slate-400"
                    />
                    {selectedParticipant && (
                      <button
                        type="button"
                        onClick={clearParticipant}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    )}
                  </div>

                  {dropdownOpen && !showNew && (
                    <div className="absolute z-20 mt-1 max-h-52 w-full overflow-y-auto rounded-lg border border-slate-200 bg-white shadow-lg">
                      {filtered.length === 0 ? (
                        <div className="px-4 py-3 text-sm text-slate-400">Aucun résultat</div>
                      ) : (
                        filtered.map((p) => (
                          <button
                            key={p.id}
                            type="button"
                            onMouseDown={(e) => {
                              e.preventDefault()
                              selectParticipant(p)
                            }}
                            className="flex w-full items-center px-4 py-2.5 text-left text-sm text-slate-700 hover:bg-slate-50"
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
                  className="mt-2 flex items-center gap-1 text-xs font-medium text-indigo-600 hover:text-indigo-800"
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
                  <div className="mt-3 space-y-3 rounded-lg border border-indigo-100 bg-indigo-50 p-4">
                    <p className="text-xs font-semibold uppercase tracking-wide text-indigo-600">Nouveau participant</p>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="mb-1 block text-xs font-medium text-slate-600">Prénom</label>
                        <input
                          type="text"
                          value={newPrenom}
                          onChange={(e) => setNewPrenom(e.target.value)}
                          placeholder="Jean"
                          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        />
                      </div>
                      <div>
                        <label className="mb-1 block text-xs font-medium text-slate-600">
                          Nom <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="text"
                          value={newNom}
                          onChange={(e) => setNewNom(e.target.value)}
                          placeholder="Dupont"
                          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-medium text-slate-600">Email (optionnel)</label>
                      <input
                        type="email"
                        value={newEmail}
                        onChange={(e) => setNewEmail(e.target.value)}
                        placeholder="jean.dupont@exemple.fr"
                        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Activité */}
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Activité</label>
                <select
                  value={activiteId}
                  onChange={(e) => setActiviteId(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="">Aucune activité</option>
                  {activites.map((a) => (
                    <option key={a.id} value={a.id}>{a.nom}</option>
                  ))}
                </select>
              </div>

              {/* Montant */}
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">
                  Montant (€) <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  required
                  value={montant}
                  onChange={(e) => setMontant(e.target.value)}
                  placeholder="0.00"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              {/* Date */}
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">
                  Date <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  required
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              {/* Mode de paiement */}
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">
                  Mode de paiement <span className="text-red-500">*</span>
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {(['virement', 'cheque', 'especes'] as const).map((mode) => (
                    <button
                      key={mode}
                      type="button"
                      onClick={() => setModePaiement(mode)}
                      className={`rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
                        modePaiement === mode
                          ? 'border-indigo-600 bg-indigo-600 text-white'
                          : 'border-slate-300 bg-white text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      {mode === 'virement' ? 'Virement' : mode === 'cheque' ? 'Chèque' : 'Espèces'}
                    </button>
                  ))}
                </div>
              </div>

              <button
                type="submit"
                disabled={saving || (!selectedParticipant && !showNew)}
                className="w-full rounded-lg bg-indigo-600 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
              >
                {saving ? 'Enregistrement…' : 'Enregistrer le don'}
              </button>
            </form>
          )}
        </div>
      </main>
    </div>
  )
}
