import { useState, useEffect, useCallback, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import { useOrganisationId } from '../hooks/useOrganisationId'
import { useToast } from '../hooks/useToast'
import type { RecuFiscal, ProfilParticipant } from '../types'
import { fetchAllRows } from '../lib/fetchAllRows'
import { participantFullName, matchesParticipantSearch } from '../lib/participantSearch'
import {
  validateOrganisationCerfa,
  validateParticipantCerfa,
  type OrganisationFiscale,
  type ParticipantValidation,
} from '../lib/cerfaValidation'
import ParticipantModal from '../components/ParticipantModal'
import Toast from '../components/Toast'
import ScrollShadowX from '../components/ScrollShadowX'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { Select } from '../components/ui/select'
import { Badge } from '../components/ui/badge'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '../components/ui/table'
import { Dialog, DialogContent } from '../components/ui/dialog'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ParticipantRow {
  profil: ProfilParticipant
  total_dons: number
  recu: RecuFiscal | null
  validation: ParticipantValidation
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatMontant(n: number) {
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(n)
}

function currentYear() {
  return new Date().getFullYear()
}

function formatDateHeure(iso: string): string {
  return new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

function yearOptions() {
  const cy = currentYear()
  return [cy, cy - 1, cy - 2, cy - 3]
}

const TYPE_CERFA_LABELS: Record<string, string> = {
  '11580': '11580 · Particuliers',
  '16216': '16216 · Entreprises',
}

// ---------------------------------------------------------------------------
// RecusFiscauxPage
// ---------------------------------------------------------------------------

export default function RecusFiscauxPage() {
  const organisationId = useOrganisationId()
  const { toast, showToast, dismissToast } = useToast()

  const [annee, setAnnee] = useState<number>(currentYear())
  const [rows, setRows] = useState<ParticipantRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Validation organisation (bannière de blocage)
  const [orgFiscal, setOrgFiscal] = useState<OrganisationFiscale | null>(null)
  const orgMissing = useMemo(() => (orgFiscal ? validateOrganisationCerfa(orgFiscal) : []), [orgFiscal])

  // Per-row generation state: profil_participant_id → loading | error | null
  const [genLoading, setGenLoading] = useState<Record<string, boolean>>({})
  const [genError, setGenError] = useState<Record<string, string>>({})
  const [dlLoading, setDlLoading] = useState<Record<string, boolean>>({})
  const [dlError, setDlError] = useState<Record<string, string>>({})
  const [sendLoading, setSendLoading] = useState<Record<string, boolean>>({})
  const [sendError, setSendError] = useState<Record<string, string>>({})

  const [generateAllLoading, setGenerateAllLoading] = useState(false)

  // Regénération (confirmation) et édition participant
  const [regenerateConfirm, setRegenerateConfirm] = useState<ParticipantRow | null>(null)
  const [editingProfil, setEditingProfil] = useState<ProfilParticipant | undefined>(undefined)
  const [participantModalOpen, setParticipantModalOpen] = useState(false)

  // ---------------------------------------------------------------------------
  // Organisation fiscale (indépendante de l'année)
  // ---------------------------------------------------------------------------

  useEffect(() => {
    if (!organisationId) return
    supabase
      .from('organisations')
      .select('adresse, code_postal, ville, modele_recu_pdf')
      .eq('id', organisationId)
      .single()
      .then(({ data }) => setOrgFiscal(data as OrganisationFiscale | null))
  }, [organisationId])

  // ---------------------------------------------------------------------------
  // Data fetching
  // ---------------------------------------------------------------------------

  const fetchData = useCallback(async () => {
    if (!organisationId) return
    setLoading(true)
    setError(null)

    // 1. Fetch all dons for this org + year (only need profil_participant_id + montant)
    const dateStart = `${annee}-01-01`
    const dateEnd = `${annee}-12-31`

    const { data: dons, error: donsErr } = await fetchAllRows<{ profil_participant_id: string; montant: number }>((from, to) =>
      supabase
        .from('dons')
        .select('profil_participant_id, montant')
        .eq('organisation_id', organisationId)
        .gte('date', dateStart)
        .lte('date', dateEnd)
        .order('id', { ascending: true })
        .range(from, to)
    )

    if (donsErr) { setError(donsErr); setLoading(false); return }

    // 2. Aggregate totals per profil_participant_id
    const totalsMap: Record<string, number> = {}
    for (const don of dons) {
      totalsMap[don.profil_participant_id] = (totalsMap[don.profil_participant_id] ?? 0) + Number(don.montant)
    }

    const profilIds = Object.keys(totalsMap)

    if (profilIds.length === 0) {
      setRows([])
      setLoading(false)
      return
    }

    // 3. Fetch participant info for those IDs (données complètes pour la validation Cerfa)
    const { data: profils, error: profilsErr } = await fetchAllRows<ProfilParticipant>((from, to) =>
      supabase
        .from('profils_participant')
        .select('id, personne_id, organisation_id, notes, id_externe, created_at, personnes!inner(id, nom, prenom, email, telephone, civilite, nom2, prenom2, adresse, code_postal, ville, pays)')
        .in('id', profilIds)
        .order('id', { ascending: true })
        .range(from, to) as unknown as PromiseLike<{ data: ProfilParticipant[] | null; error: { message: string } | null }>
    )

    if (profilsErr) { setError(profilsErr); setLoading(false); return }

    // 4. Fetch existing recus_fiscaux for this org + year
    const { data: recus, error: recusErr } = await fetchAllRows<RecuFiscal>((from, to) =>
      supabase
        .from('recus_fiscaux')
        .select('*')
        .eq('organisation_id', organisationId)
        .eq('annee', annee)
        .order('id', { ascending: true })
        .range(from, to)
    )

    if (recusErr) { setError(recusErr); setLoading(false); return }

    const recusMap: Record<string, RecuFiscal> = {}
    for (const r of recus) {
      recusMap[r.profil_participant_id] = r
    }

    // 5. Build rows
    const built: ParticipantRow[] = profils.map((p) => ({
      profil: p,
      total_dons: totalsMap[p.id] ?? 0,
      recu: recusMap[p.id] ?? null,
      validation: validateParticipantCerfa(p.personnes),
    }))

    // Sort by nom then prenom
    built.sort((a, b) =>
      a.profil.personnes.nom.localeCompare(b.profil.personnes.nom) ||
      (a.profil.personnes.prenom ?? '').localeCompare(b.profil.personnes.prenom ?? '')
    )

    setRows(built)
    setLoading(false)
  }, [organisationId, annee])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  // ---------------------------------------------------------------------------
  // Generate a single recu
  // ---------------------------------------------------------------------------

  async function generateRecu(row: ParticipantRow) {
    const profilId = row.profil.id
    setGenLoading((prev) => ({ ...prev, [profilId]: true }))
    setGenError((prev) => ({ ...prev, [profilId]: '' }))

    const { data: { session } } = await supabase.auth.getSession()
    if (!session) {
      setGenError((prev) => ({ ...prev, [profilId]: 'Session expirée' }))
      setGenLoading((prev) => ({ ...prev, [profilId]: false }))
      return
    }

    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string
    const res = await fetch(`${supabaseUrl}/functions/v1/generate-recu`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`,
        'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY as string,
      },
      body: JSON.stringify({ profil_participant_id: profilId, annee }),
    })

    const json = await res.json()
    if (!res.ok) {
      setGenError((prev) => ({ ...prev, [profilId]: json.error ?? 'Erreur inconnue' }))
      setGenLoading((prev) => ({ ...prev, [profilId]: false }))
      return
    }

    setGenLoading((prev) => ({ ...prev, [profilId]: false }))
    showToast(`Reçu généré pour ${participantFullName(row.profil)}`)
    fetchData()
  }

  function handleGenerateClick(row: ParticipantRow) {
    if (row.recu) {
      setRegenerateConfirm(row)
    } else {
      generateRecu(row)
    }
  }

  // ---------------------------------------------------------------------------
  // Download a recu (signed URL)
  // ---------------------------------------------------------------------------

  async function downloadRecu(row: ParticipantRow) {
    if (!row.recu?.fichier_url) return
    const id = row.profil.id
    setDlLoading((prev) => ({ ...prev, [id]: true }))
    setDlError((prev) => ({ ...prev, [id]: '' }))

    const { data, error: urlErr } = await supabase.storage
      .from('recus-fiscaux')
      .createSignedUrl(row.recu.fichier_url, 3600)

    if (urlErr || !data?.signedUrl) {
      setDlError((prev) => ({ ...prev, [id]: 'Impossible de générer le lien' }))
      setDlLoading((prev) => ({ ...prev, [id]: false }))
      return
    }

    window.open(data.signedUrl, '_blank')
    setDlLoading((prev) => ({ ...prev, [id]: false }))
  }

  // ---------------------------------------------------------------------------
  // Send a recu by email (Resend)
  // ---------------------------------------------------------------------------

  async function sendRecuEmail(row: ParticipantRow) {
    const id = row.profil.id
    setSendLoading((prev) => ({ ...prev, [id]: true }))
    setSendError((prev) => ({ ...prev, [id]: '' }))

    const { data: { session } } = await supabase.auth.getSession()
    if (!session) {
      setSendError((prev) => ({ ...prev, [id]: 'Session expirée' }))
      setSendLoading((prev) => ({ ...prev, [id]: false }))
      return
    }

    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string
    const res = await fetch(`${supabaseUrl}/functions/v1/send-recu-email`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`,
        'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY as string,
      },
      body: JSON.stringify({ profil_participant_id: id, annee }),
    })

    const json = await res.json()
    setSendLoading((prev) => ({ ...prev, [id]: false }))

    if (!res.ok) {
      setSendError((prev) => ({ ...prev, [id]: json.error ?? 'Erreur inconnue' }))
      return
    }

    showToast(`Reçu envoyé à ${row.profil.personnes.email}`)
    fetchData()
  }

  // ---------------------------------------------------------------------------
  // Generate all (skips les lignes bloquées)
  // ---------------------------------------------------------------------------

  async function generateAll() {
    setGenerateAllLoading(true)
    const eligible = rows.filter((r) => orgMissing.length === 0 && !r.validation.blocking && r.validation.missing.length === 0)
    for (const row of eligible) {
      await generateRecu(row)
    }
    setGenerateAllLoading(false)
  }

  // ---------------------------------------------------------------------------
  // Édition participant
  // ---------------------------------------------------------------------------

  function openEditParticipant(row: ParticipantRow) {
    setEditingProfil(row.profil)
    setParticipantModalOpen(true)
  }

  function handleParticipantSaved() {
    setParticipantModalOpen(false)
    setEditingProfil(undefined)
    fetchData()
  }

  // ---------------------------------------------------------------------------
  // Stats
  // ---------------------------------------------------------------------------

  const totalGeneres = rows.filter((r) => r.recu !== null).length

  // ---------------------------------------------------------------------------
  // Recherche
  // ---------------------------------------------------------------------------

  const [search, setSearch] = useState('')

  const filteredRows = useMemo(
    () => rows.filter((r) => matchesParticipantSearch(r.profil, search)),
    [rows, search]
  )

  // ---------------------------------------------------------------------------
  // Pagination
  // ---------------------------------------------------------------------------

  const [pageSize, setPageSize] = useState(50)
  const [currentPage, setCurrentPage] = useState(1)

  const pageCount = Math.max(1, Math.ceil(filteredRows.length / pageSize))
  const safePage = Math.min(currentPage, pageCount)

  const paginatedRows = useMemo(() => {
    const start = (safePage - 1) * pageSize
    return filteredRows.slice(start, start + pageSize)
  }, [filteredRows, safePage, pageSize])

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div className="-m-6 min-h-[calc(100%+3rem)] space-y-6 bg-paper p-6 font-registre">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-ink md:text-3xl">Reçus fiscaux</h1>
          <p className="mt-1 text-sm text-ink-muted">
            {rows.length} participant{rows.length !== 1 ? 's' : ''} avec des dons en {annee}
            {totalGeneres > 0 && ` · ${totalGeneres} reçu${totalGeneres !== 1 ? 's' : ''} généré${totalGeneres !== 1 ? 's' : ''}`}
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* Year selector */}
          <Select
            aria-label="Année"
            value={annee}
            onChange={(e) => { setAnnee(Number(e.target.value)); setCurrentPage(1) }}
          >
            {yearOptions().map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </Select>

          {/* Generate all */}
          {rows.length > 0 && (
            <Button
              onClick={generateAll}
              disabled={generateAllLoading || orgMissing.length > 0}
              title={orgMissing.length > 0 ? "Complétez les paramètres de l'organisation pour générer des reçus" : undefined}
            >
              {generateAllLoading ? (
                <svg className="h-4 w-4 animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                </svg>
              ) : (
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25zM6.75 12h.008v.008H6.75V12zm0 3h.008v.008H6.75V15zm0 3h.008v.008H6.75V18z" />
                </svg>
              )}
              Générer tous
            </Button>
          )}
        </div>
      </div>

      {/* Bannière organisation incomplète */}
      {orgFiscal && orgMissing.length > 0 && (
        <div className="rounded-sm border border-warning-border bg-warning-tint px-4 py-3 text-sm text-warning">
          <p>
            <span className="font-medium">Complétez les paramètres de votre organisation</span> pour pouvoir générer des reçus fiscaux
            {' '}— champs manquants : {orgMissing.join(', ')}.
          </p>
          <Link to="/admin/parametres/fiscal" className="mt-1 inline-block font-medium underline hover:no-underline">
            Aller aux paramètres
          </Link>
        </div>
      )}

      {/* Error banner */}
      {error && (
        <div className="rounded-sm border border-stamp/30 bg-stamp/[0.04] px-4 py-3 text-sm text-stamp">{error}</div>
      )}

      {/* Table */}
      <div className="rounded-sm border border-paper-border bg-white">
        {!loading && rows.length > 0 && (
          <div className="border-b border-paper-border px-6 py-4">
            <Input
              type="text"
              value={search}
              onChange={(e) => { setSearch(e.target.value); setCurrentPage(1) }}
              placeholder="Rechercher par nom…"
              className="w-full min-w-[12rem] max-w-xs"
            />
          </div>
        )}
        {loading ? (
          <div className="flex items-center justify-center py-16 font-registre text-sm text-ink-faint">
            Chargement…
          </div>
        ) : rows.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <svg xmlns="http://www.w3.org/2000/svg" className="mb-3 h-10 w-10 text-ink-faint/50" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25zM6.75 12h.008v.008H6.75V12zm0 3h.008v.008H6.75V15zm0 3h.008v.008H6.75V18z" />
            </svg>
            <p className="font-registre text-sm font-medium text-ink-faint">Aucun don enregistré en {annee}</p>
            <p className="mt-1 font-registre text-xs text-ink-faint">Sélectionnez une autre année ou ajoutez des dons.</p>
          </div>
        ) : filteredRows.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <p className="font-registre text-sm font-medium text-ink-faint">Aucun résultat pour votre recherche</p>
          </div>
        ) : (
          <ScrollShadowX>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Participant</TableHead>
                  <TableHead className="text-right">Total dons</TableHead>
                  <TableHead>N° reçu</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedRows.map((row) => {
                  const fullName = participantFullName(row.profil)
                  const profilId = row.profil.id
                  const isGenLoading = genLoading[profilId]
                  const genErr = genError[profilId]
                  const isDlLoading = dlLoading[profilId]
                  const dlErr = dlError[profilId]
                  const isSendLoading = sendLoading[profilId]
                  const sendErr = sendError[profilId]
                  const hasRecu = row.recu !== null
                  const isBlocked = orgMissing.length > 0 || row.validation.blocking || row.validation.missing.length > 0
                  const validationMessage = row.validation.message
                    ?? (row.validation.missing.length > 0 ? `Champs manquants : ${row.validation.missing.join(', ')}` : null)

                  return (
                    <TableRow key={profilId}>
                      {/* Participant */}
                      <TableCell>
                        <div className="flex items-center gap-1.5">
                          <span className="font-medium text-ink">{fullName}</span>
                          {validationMessage && (
                            <span title={validationMessage} className="cursor-help text-warning">
                              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l6.28 11.18c.75 1.334-.213 2.987-1.742 2.987H3.72c-1.53 0-2.493-1.653-1.743-2.987l6.28-11.18zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                              </svg>
                            </span>
                          )}
                        </div>
                        {row.profil.personnes.email && <div className="text-xs text-ink-faint">{row.profil.personnes.email}</div>}
                      </TableCell>

                      {/* Total */}
                      <TableCell className="text-right font-medium text-ink">
                        {formatMontant(row.total_dons)}
                      </TableCell>

                      {/* N° reçu */}
                      <TableCell className="text-ink-muted">{row.recu?.numero_ordre ?? '—'}</TableCell>

                      {/* Type */}
                      <TableCell className="text-ink-muted">
                        {row.recu?.type_cerfa ? TYPE_CERFA_LABELS[row.recu.type_cerfa] ?? row.recu.type_cerfa : '—'}
                      </TableCell>

                      {/* Status */}
                      <TableCell>
                        <Badge variant={hasRecu ? 'success' : 'neutral'}>
                          {hasRecu ? 'Généré' : 'Non généré'}
                        </Badge>
                        {validationMessage && (
                          <div className="mt-1">
                            <p className="text-xs text-warning">{validationMessage}</p>
                            <button
                              type="button"
                              onClick={() => openEditParticipant(row)}
                              className="mt-0.5 text-xs font-medium text-stamp underline hover:no-underline"
                            >
                              Modifier le participant
                            </button>
                          </div>
                        )}
                        {row.recu?.email_envoye_at && (
                          <p className="mt-1 text-xs text-ink-faint">Envoyé le {formatDateHeure(row.recu.email_envoye_at)}</p>
                        )}
                        {genErr && <p className="mt-1 text-xs text-stamp">{genErr}</p>}
                        {dlErr && <p className="mt-1 text-xs text-stamp">{dlErr}</p>}
                        {sendErr && <p className="mt-1 text-xs text-stamp">{sendErr}</p>}
                      </TableCell>

                      {/* Actions */}
                      <TableCell>
                        <div className="flex justify-end gap-2">
                          {/* Download (only if recu exists) */}
                          {hasRecu && (
                            <Button
                              variant="secondary"
                              size="sm"
                              onClick={() => downloadRecu(row)}
                              disabled={isDlLoading}
                              title="Télécharger le reçu PDF"
                            >
                              {isDlLoading ? (
                                <svg className="h-3.5 w-3.5 animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                                </svg>
                              ) : (
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
                                </svg>
                              )}
                              PDF
                            </Button>
                          )}

                          {/* Send by email (only if recu exists and participant has an email) */}
                          {hasRecu && row.profil.personnes.email && (
                            <Button
                              variant="secondary"
                              size="sm"
                              onClick={() => sendRecuEmail(row)}
                              disabled={isSendLoading}
                              title="Envoyer le reçu par email"
                            >
                              {isSendLoading ? (
                                <svg className="h-3.5 w-3.5 animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                                </svg>
                              ) : (
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
                                </svg>
                              )}
                              Email
                            </Button>
                          )}

                          {/* Generate / Regenerate */}
                          <Button
                            size="sm"
                            onClick={() => handleGenerateClick(row)}
                            disabled={isGenLoading || generateAllLoading || isBlocked}
                            title={isBlocked ? (orgMissing.length > 0 ? "Complétez les paramètres de l'organisation" : validationMessage ?? undefined) : undefined}
                          >
                            {isGenLoading ? (
                              <svg className="h-3.5 w-3.5 animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                              </svg>
                            ) : (
                              <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                              </svg>
                            )}
                            {hasRecu ? 'Regénérer' : 'Générer'}
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </ScrollShadowX>
        )}

        {/* Pagination */}
        {!loading && filteredRows.length > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-paper-border px-6 py-3">
            <div className="flex items-center gap-2 font-registre-mono text-xs text-ink-faint">
              <span>Lignes par page</span>
              <Select
                aria-label="Lignes par page"
                value={pageSize}
                onChange={(e) => { setPageSize(Number(e.target.value)); setCurrentPage(1) }}
                className="py-1 pl-2 pr-7 text-xs"
              >
                {[25, 50, 100, 250].map((size) => (
                  <option key={size} value={size}>{size}</option>
                ))}
              </Select>
              <span>
                {(safePage - 1) * pageSize + 1}–{Math.min(safePage * pageSize, filteredRows.length)} sur {filteredRows.length}
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Button variant="secondary" size="sm" onClick={() => setCurrentPage(1)} disabled={safePage === 1}>«</Button>
              <Button variant="secondary" size="sm" onClick={() => setCurrentPage((p) => Math.max(1, p - 1))} disabled={safePage === 1}>
                ‹ Précédent
              </Button>
              <span className="font-registre-mono text-xs text-ink-faint">Page {safePage} / {pageCount}</span>
              <Button variant="secondary" size="sm" onClick={() => setCurrentPage((p) => Math.min(pageCount, p + 1))} disabled={safePage === pageCount}>
                Suivant ›
              </Button>
              <Button variant="secondary" size="sm" onClick={() => setCurrentPage(pageCount)} disabled={safePage === pageCount}>»</Button>
            </div>
          </div>
        )}
      </div>

      {/* Regenerate confirmation */}
      <Dialog open={!!regenerateConfirm} onOpenChange={(next) => { if (!next) setRegenerateConfirm(null) }}>
        <DialogContent className="max-w-sm" aria-describedby={undefined}>
          {regenerateConfirm && (
            <div className="p-6">
              <h2 className="font-registre text-lg font-semibold text-ink">Regénérer le reçu</h2>
              <p className="mt-2 font-registre text-sm text-ink-muted">
                Un reçu a déjà été généré pour{' '}
                <span className="font-medium text-ink">« {participantFullName(regenerateConfirm.profil)} »</span> en {annee}
                {regenerateConfirm.recu?.numero_ordre && <> (n° {regenerateConfirm.recu.numero_ordre})</>}.
                Le fichier PDF sera remplacé, mais le numéro d'ordre est conservé.
              </p>
              <div className="mt-5 flex justify-end gap-3">
                <Button type="button" variant="secondary" onClick={() => setRegenerateConfirm(null)}>
                  Annuler
                </Button>
                <Button
                  type="button"
                  onClick={() => {
                    const row = regenerateConfirm
                    setRegenerateConfirm(null)
                    generateRecu(row)
                  }}
                >
                  Regénérer
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Participant edit modal */}
      {organisationId && (
        <ParticipantModal
          open={participantModalOpen}
          onClose={() => setParticipantModalOpen(false)}
          onSaved={handleParticipantSaved}
          participant={editingProfil}
          organisationId={organisationId}
        />
      )}

      {/* Toast */}
      {toast && <Toast key={toast.id} message={toast.message} onDismiss={dismissToast} />}
    </div>
  )
}
