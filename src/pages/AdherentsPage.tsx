import { useState, useEffect, useCallback, useMemo } from 'react'
import { supabase } from '../lib/supabaseClient'
import { useOrganisationId } from '../hooks/useOrganisationId'
import type { Adherent, Adhesion } from '../types'
import { CIVILITE_ADHERENT_LABELS } from '../lib/civiliteAdherent'
import { adherentFullName } from '../lib/adherentSearch'
import { useToast } from '../hooks/useToast'
import Toast from '../components/Toast'
import Modal from '../components/Modal'
import AdherentModal from '../components/AdherentModal'
import AssignerListeModal from '../components/AssignerListeModal'
import AdhesionModal from '../components/AdhesionModal'
import ImportWizard from '../components/import/ImportWizard'
import { adherentsImportConfig } from '../lib/import/configs'
import CartesAdherentPdfPreviewModal from '../components/CartesAdherentPdfPreviewModal'
import ScrollShadowX from '../components/ScrollShadowX'
import { logModification } from '../lib/journalModifications'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

type StatutFilter = 'actif' | 'archive' | 'all'
type StatutCycle = 'actif' | 'expire' | 'aucune'

function statutCycleFor(adhesion: Adhesion | undefined, today: string): StatutCycle {
  if (!adhesion) return 'aucune'
  if (!adhesion.date_fin || adhesion.date_fin >= today) return 'actif'
  return 'expire'
}

const STATUT_CYCLE_LABELS: Record<StatutCycle, string> = {
  actif: 'Actif',
  expire: 'Expiré',
  aucune: 'Aucune adhésion',
}

const STATUT_CYCLE_CLASSES: Record<StatutCycle, string> = {
  actif: 'bg-emerald-50 text-emerald-700',
  expire: 'bg-amber-50 text-amber-700',
  aucune: 'bg-slate-100 text-slate-600',
}

const PRINT_HELP_TEXT =
  "Planche A4 — imprimez sans mise à l'échelle (100 %) pour respecter les dimensions réelles des cartes (85,6 × 54 mm), puis découpez au massicot ou aux ciseaux."

interface SearchAdherentRow extends Adherent {
  total_count: number
}

// ---------------------------------------------------------------------------
// AdherentsPage
// ---------------------------------------------------------------------------

export default function AdherentsPage() {
  const organisationId = useOrganisationId()
  const { toast, showToast, dismissToast } = useToast()

  const [adherents, setAdherents] = useState<Adherent[]>([])
  const [totalCount, setTotalCount] = useState(0)
  const [latestAdhesions, setLatestAdhesions] = useState<Map<string, Adhesion>>(new Map())
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  const [statutFilter, setStatutFilter] = useState<StatutFilter>('actif')
  const [tagFilter, setTagFilter] = useState('')
  const [excludeTagFilter, setExcludeTagFilter] = useState('')
  const [pageSize, setPageSize] = useState(50)
  const [currentPage, setCurrentPage] = useState(1)

  const [availableTags, setAvailableTags] = useState<string[]>([])

  const [adherentModalOpen, setAdherentModalOpen] = useState(false)
  const [editingAdherent, setEditingAdherent] = useState<Adherent | undefined>(undefined)
  const [renewingAdherent, setRenewingAdherent] = useState<Adherent | undefined>(undefined)
  const [archiveConfirm, setArchiveConfirm] = useState<Adherent | null>(null)
  const [archiving, setArchiving] = useState(false)
  const [importOpen, setImportOpen] = useState(false)

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [printing, setPrinting] = useState(false)
  const [printError, setPrintError] = useState<string | null>(null)
  const [pdfPreview, setPdfPreview] = useState<{ url: string; filename: string; count: number } | null>(null)
  const [assignListeOpen, setAssignListeOpen] = useState(false)

  // Debounce de la recherche pour éviter un appel serveur à chaque frappe
  useEffect(() => {
    const timeout = setTimeout(() => {
      setSearch(searchInput)
      setCurrentPage(1)
    }, 300)
    return () => clearTimeout(timeout)
  }, [searchInput])

  const fetchAdherents = useCallback(async () => {
    if (!organisationId) return
    setLoading(true)
    setError(null)

    const { data, error: err } = await supabase.rpc('search_adherents', {
      p_organisation_id: organisationId,
      p_search: search || null,
      p_statut: statutFilter === 'all' ? null : statutFilter,
      p_limit: pageSize,
      p_offset: (currentPage - 1) * pageSize,
      p_tag: tagFilter || null,
      p_exclude_tag: excludeTagFilter || null,
    })

    if (err) {
      setError(err.message)
      setLoading(false)
      return
    }

    const rows = (data ?? []) as SearchAdherentRow[]
    setAdherents(rows)
    setTotalCount(rows[0]?.total_count ?? 0)

    const ids = rows.map((r) => r.id)
    if (ids.length > 0) {
      const { data: adhesionsData } = await supabase
        .from('adhesions')
        .select('*')
        .in('adherent_id', ids)
        .order('date_debut', { ascending: false })

      const map = new Map<string, Adhesion>()
      for (const adhesion of (adhesionsData ?? []) as Adhesion[]) {
        if (!map.has(adhesion.adherent_id)) map.set(adhesion.adherent_id, adhesion)
      }
      setLatestAdhesions(map)
    } else {
      setLatestAdhesions(new Map())
    }

    setLoading(false)
  }, [organisationId, search, statutFilter, tagFilter, excludeTagFilter, pageSize, currentPage])

  useEffect(() => {
    fetchAdherents()
  }, [fetchAdherents])

  const fetchAvailableTags = useCallback(async () => {
    if (!organisationId) return
    const { data } = await supabase.rpc('list_adherent_tags', { p_organisation_id: organisationId })
    setAvailableTags(((data ?? []) as { tag: string }[]).map((r) => r.tag))
  }, [organisationId])

  useEffect(() => {
    fetchAvailableTags()
  }, [fetchAvailableTags])

  // La sélection multiple ne survit pas à un changement de page/filtre/recherche
  // (les lignes affichées changent complètement, la garder n'aurait pas de sens).
  useEffect(() => {
    setSelectedIds(new Set())
  }, [search, statutFilter, tagFilter, excludeTagFilter, pageSize, currentPage])

  const todayIso = useMemo(() => new Date().toISOString().split('T')[0], [])
  const pageCount = Math.max(1, Math.ceil(totalCount / pageSize))

  function openAdd() {
    setEditingAdherent(undefined)
    setAdherentModalOpen(true)
  }

  function openEdit(a: Adherent) {
    setEditingAdherent(a)
    setAdherentModalOpen(true)
  }

  function handleAdherentSaved(saved: Adherent) {
    const wasEdit = !!editingAdherent
    showToast(`${adherentFullName(saved)} ${wasEdit ? 'modifié' : 'ajouté'}`)
    fetchAdherents()
    fetchAvailableTags()
  }

  function handleListeAssigned(tag: string) {
    showToast(`Liste « ${tag} » ajoutée à ${selectedIds.size} adhérent${selectedIds.size > 1 ? 's' : ''}`)
    setSelectedIds(new Set())
    fetchAdherents()
    fetchAvailableTags()
  }

  function handleAdhesionSaved() {
    if (renewingAdherent) showToast(`Adhésion renouvelée pour ${adherentFullName(renewingAdherent)}`)
    setRenewingAdherent(undefined)
    fetchAdherents()
  }

  async function handleArchive() {
    if (!archiveConfirm) return
    setArchiving(true)

    const { error: err } = await supabase
      .from('adherents')
      .update({ statut: 'archive' })
      .eq('id', archiveConfirm.id)

    setArchiving(false)

    if (err) {
      setError(err.message)
      return
    }

    showToast(`${adherentFullName(archiveConfirm)} archivé`)
    if (organisationId) {
      await logModification({
        organisationId,
        tableCible: 'adherents',
        ligneId: archiveConfirm.id,
        action: 'archivage',
        details: { nom: archiveConfirm.nom, prenom: archiveConfirm.prenom },
      })
    }
    setArchiveConfirm(null)
    fetchAdherents()
  }

  async function handleReactivate(a: Adherent) {
    const { error: err } = await supabase.from('adherents').update({ statut: 'actif' }).eq('id', a.id)
    if (err) {
      setError(err.message)
      return
    }
    showToast(`${adherentFullName(a)} réactivé`)
    if (organisationId) {
      await logModification({
        organisationId,
        tableCible: 'adherents',
        ligneId: a.id,
        action: 'reactivation',
        details: { nom: a.nom, prenom: a.prenom },
      })
    }
    fetchAdherents()
  }

  function toggleSelected(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function toggleSelectAll() {
    setSelectedIds((prev) =>
      prev.size === adherents.length ? new Set() : new Set(adherents.map((a) => a.id))
    )
  }

  async function printCards(ids: string[], filename: string) {
    setPrinting(true)
    setPrintError(null)

    const { data: { session } } = await supabase.auth.getSession()
    if (!session) {
      setPrintError('Session expirée')
      setPrinting(false)
      return
    }

    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string
    const res = await fetch(`${supabaseUrl}/functions/v1/generate-cartes-adherents`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`,
        'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY as string,
      },
      body: JSON.stringify({ adherent_ids: ids }),
    })

    if (!res.ok) {
      const json = await res.json().catch(() => ({}))
      setPrintError(json.error ?? 'Erreur inconnue')
      setPrinting(false)
      return
    }

    const blob = await res.blob()
    const url = URL.createObjectURL(blob)

    setPrinting(false)
    setPdfPreview({ url, filename, count: ids.length })
  }

  async function handlePrintCards() {
    await printCards(Array.from(selectedIds), 'cartes-adherents.pdf')
    setSelectedIds(new Set())
  }

  async function handlePrintSingleCard(a: Adherent) {
    const slug = adherentFullName(a).normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-zA-Z0-9]+/g, '-').toLowerCase()
    await printCards([a.id], `carte-${slug}.pdf`)
  }

  function closePdfPreview() {
    if (pdfPreview) URL.revokeObjectURL(pdfPreview.url)
    setPdfPreview(null)
  }

  return (
    <>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Adhérents</h1>
          <p className="mt-1 text-sm text-slate-600">
            Gestion des adhérents de votre organisation. Sélectionnez plusieurs adhérents (cases à cocher) pour imprimer leurs cartes en une seule fois.
          </p>
        </div>

        {error && <div className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">Erreur : {error}</div>}
        {printError && <div className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">Erreur d'impression : {printError}</div>}

        <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 px-6 py-4">
            <div className="flex flex-wrap items-center gap-3">
              <input
                type="text"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="Rechercher par nom, prénom ou email…"
                className="w-full max-w-xs rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <select
                aria-label="Statut"
                value={statutFilter}
                onChange={(e) => { setStatutFilter(e.target.value as StatutFilter); setCurrentPage(1) }}
                className="select-field rounded-lg border border-slate-300 py-2 pl-3 pr-9 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="actif">Actifs</option>
                <option value="archive">Archivés</option>
                <option value="all">Tous</option>
              </select>

              {/* Groupe "listes de diffusion" : filtre, exclusion et création regroupés visuellement (retour utilisateur) */}
              <div className="border-l border-slate-200 pl-3">
                <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500">Listes de diffusion</span>
                <div className="flex flex-wrap items-center gap-2">
                  <select
                    aria-label="Liste de diffusion"
                    value={tagFilter}
                    onChange={(e) => { setTagFilter(e.target.value); setCurrentPage(1) }}
                    className="select-field rounded-lg border border-slate-300 py-2 pl-3 pr-9 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="">Toutes les listes</option>
                    {availableTags.map((tag) => (
                      <option key={tag} value={tag}>Liste : {tag}</option>
                    ))}
                  </select>
                  {availableTags.length > 0 && (
                    <select
                      aria-label="Exclure une liste"
                      value={excludeTagFilter}
                      onChange={(e) => { setExcludeTagFilter(e.target.value); setCurrentPage(1) }}
                      className="select-field rounded-lg border border-slate-300 py-2 pl-3 pr-9 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    >
                      <option value="">Sans exclusion</option>
                      {availableTags.map((tag) => (
                        <option key={tag} value={tag}>Exclure : {tag}</option>
                      ))}
                    </select>
                  )}
                  <button
                    onClick={() => setAssignListeOpen(true)}
                    className="flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m6-6H6" />
                    </svg>
                    Nouvelle liste
                  </button>
                </div>
              </div>
            </div>
            <div className="flex flex-shrink-0 items-center gap-2">
              <button
                onClick={() => setImportOpen(true)}
                className="flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
                </svg>
                Importer
              </button>
              <button
                onClick={openAdd}
                className="flex items-center gap-2 rounded-lg bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-700"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                </svg>
                Ajouter
              </button>
            </div>
          </div>

          {selectedIds.size > 0 && (
            <div className="border-b border-indigo-100 bg-indigo-50 px-6 py-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <span className="text-sm font-medium text-indigo-700">
                  {selectedIds.size} adhérent{selectedIds.size > 1 ? 's' : ''} sélectionné{selectedIds.size > 1 ? 's' : ''}
                </span>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setAssignListeOpen(true)}
                    className="rounded-lg border border-indigo-200 px-3 py-1.5 text-sm font-medium text-indigo-700 hover:bg-indigo-100"
                  >
                    Ajouter à une liste
                  </button>
                  <button
                    onClick={handlePrintCards}
                    disabled={printing}
                    title={PRINT_HELP_TEXT}
                    className="rounded-lg bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-60"
                  >
                    {printing ? 'Génération…' : 'Imprimer les cartes'}
                  </button>
                </div>
              </div>
              <p className="mt-1.5 text-xs text-indigo-600">{PRINT_HELP_TEXT}</p>
            </div>
          )}

          {loading ? (
            <div className="flex items-center justify-center py-16">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-600 border-t-transparent" />
            </div>
          ) : adherents.length === 0 ? (
            <div className="flex items-center justify-center py-16">
              <p className="text-slate-500">Aucun adhérent trouvé</p>
            </div>
          ) : (
            <ScrollShadowX>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs font-medium uppercase tracking-wide text-slate-500">
                    <th className="px-6 py-3">
                      <input
                        type="checkbox"
                        checked={selectedIds.size > 0 && selectedIds.size === adherents.length}
                        onChange={toggleSelectAll}
                        className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                        aria-label="Tout sélectionner"
                      />
                    </th>
                    <th className="px-6 py-3">Civilité</th>
                    <th className="px-6 py-3">Nom</th>
                    <th className="px-6 py-3">Prénom</th>
                    <th className="px-6 py-3">Statut</th>
                    <th className="px-6 py-3">Adhésion</th>
                    <th className="px-6 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {adherents.map((a) => {
                    const cycle = statutCycleFor(latestAdhesions.get(a.id), todayIso)
                    return (
                      <tr key={a.id} onClick={() => openEdit(a)} className="cursor-pointer hover:bg-slate-50">
                        <td className="px-6 py-3" onClick={(e) => e.stopPropagation()}>
                          <input
                            type="checkbox"
                            checked={selectedIds.has(a.id)}
                            onChange={() => toggleSelected(a.id)}
                            className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                            aria-label={`Sélectionner ${adherentFullName(a)}`}
                          />
                        </td>
                        <td className="px-6 py-3 text-slate-500">{CIVILITE_ADHERENT_LABELS[a.civilite]}</td>
                        <td className="px-6 py-3 font-medium text-slate-900">{a.nom}</td>
                        <td className="px-6 py-3 text-slate-700">{a.prenom ?? '—'}</td>
                        <td className="px-6 py-3">
                          <span
                            className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${
                              a.statut === 'actif' ? 'bg-indigo-50 text-indigo-700' : 'bg-slate-100 text-slate-600'
                            }`}
                          >
                            {a.statut === 'actif' ? 'Actif' : 'Archivé'}
                          </span>
                        </td>
                        <td className="px-6 py-3">
                          <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUT_CYCLE_CLASSES[cycle]}`}>
                            {STATUT_CYCLE_LABELS[cycle]}
                          </span>
                          {latestAdhesions.get(a.id)?.date_fin && (
                            <p className="mt-0.5 text-xs text-slate-500">
                              jusqu'au {formatDate(latestAdhesions.get(a.id)!.date_fin!)}
                            </p>
                          )}
                        </td>
                        <td className="px-6 py-3" onClick={(e) => e.stopPropagation()}>
                          <div className="flex justify-end gap-2">
                            <button
                              onClick={() => openEdit(a)}
                              className="rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50"
                            >
                              Modifier
                            </button>
                            <button
                              onClick={() => handlePrintSingleCard(a)}
                              disabled={printing}
                              title={PRINT_HELP_TEXT}
                              className="rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-60"
                            >
                              Carte
                            </button>
                            {a.statut === 'actif' && (
                              <button
                                onClick={() => setRenewingAdherent(a)}
                                className="rounded-lg border border-indigo-200 px-2.5 py-1 text-xs font-medium text-indigo-600 hover:bg-indigo-50"
                              >
                                Renouveler
                              </button>
                            )}
                            {a.statut === 'actif' ? (
                              <button
                                onClick={() => setArchiveConfirm(a)}
                                className="rounded-lg border border-red-200 px-2.5 py-1 text-xs font-medium text-red-600 hover:bg-red-50"
                              >
                                Archiver
                              </button>
                            ) : (
                              <button
                                onClick={() => handleReactivate(a)}
                                className="rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50"
                              >
                                Réactiver
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </ScrollShadowX>
          )}

          {!loading && adherents.length > 0 && (
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 px-6 py-3">
              <div className="flex items-center gap-2 text-sm text-slate-500">
                <span>Lignes par page</span>
                <select
                  aria-label="Lignes par page"
                  value={pageSize}
                  onChange={(e) => { setPageSize(Number(e.target.value)); setCurrentPage(1) }}
                  className="select-field rounded-lg border border-slate-300 py-1 pl-2 pr-7 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  {[25, 50, 100, 250].map((size) => (
                    <option key={size} value={size}>{size}</option>
                  ))}
                </select>
                <span>
                  {(currentPage - 1) * pageSize + 1}–{Math.min(currentPage * pageSize, totalCount)} sur {totalCount}
                </span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setCurrentPage(1)}
                  disabled={currentPage === 1}
                  className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  «
                </button>
                <button
                  type="button"
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  ‹ Précédent
                </button>
                <span className="text-sm text-slate-500">Page {currentPage} / {pageCount}</span>
                <button
                  type="button"
                  onClick={() => setCurrentPage((p) => Math.min(pageCount, p + 1))}
                  disabled={currentPage === pageCount}
                  className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Suivant ›
                </button>
                <button
                  type="button"
                  onClick={() => setCurrentPage(pageCount)}
                  disabled={currentPage === pageCount}
                  className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  »
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      <AdherentModal
        open={adherentModalOpen}
        onClose={() => setAdherentModalOpen(false)}
        onSaved={handleAdherentSaved}
        adherent={editingAdherent}
        organisationId={organisationId}
        availableTags={availableTags}
      />

      <AssignerListeModal
        open={assignListeOpen}
        onClose={() => setAssignListeOpen(false)}
        onAssigned={handleListeAssigned}
        organisationId={organisationId}
        adherentIds={Array.from(selectedIds)}
        availableTags={availableTags}
      />

      <AdhesionModal
        open={!!renewingAdherent}
        onClose={() => setRenewingAdherent(undefined)}
        onSaved={handleAdhesionSaved}
        adherent={renewingAdherent}
      />

      {importOpen && (
        <ImportWizard
          open
          onClose={() => setImportOpen(false)}
          config={adherentsImportConfig}
          organisationId={organisationId}
          onImported={fetchAdherents}
        />
      )}

      {archiveConfirm && (
        <Modal open onClose={() => setArchiveConfirm(null)} maxWidthClassName="max-w-sm" labelledBy="archive-adherent-title">
          <div className="p-6">
            <h2 id="archive-adherent-title" className="text-lg font-semibold text-slate-900">Archiver l'adhérent</h2>
            <p className="mt-2 text-sm text-slate-600">
              Êtes-vous sûr de vouloir archiver <span className="font-medium">« {adherentFullName(archiveConfirm)} »</span> ?
              Il n'apparaîtra plus dans la liste des adhérents actifs, mais reste réactivable.
            </p>
            <div className="mt-5 flex justify-end gap-3">
              <button
                onClick={() => setArchiveConfirm(null)}
                className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
              >
                Annuler
              </button>
              <button
                onClick={handleArchive}
                disabled={archiving}
                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-60"
              >
                {archiving ? 'Archivage…' : 'Archiver'}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {pdfPreview && (
        <CartesAdherentPdfPreviewModal
          open
          onClose={closePdfPreview}
          pdfUrl={pdfPreview.url}
          filename={pdfPreview.filename}
          count={pdfPreview.count}
        />
      )}

      {toast && <Toast key={toast.id} message={toast.message} onDismiss={dismissToast} />}
    </>
  )
}
