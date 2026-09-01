import { useState, useEffect, useCallback, useMemo } from 'react'
import { supabase } from '../lib/supabaseClient'
import { useOrganisationId } from '../hooks/useOrganisationId'
import type { Adherent, Adhesion } from '../types'
import { CIVILITE_ADHERENT_LABELS } from '../lib/civiliteAdherent'
import { adherentFullName } from '../lib/adherentSearch'
import { useToast } from '../hooks/useToast'
import Toast from '../components/Toast'
import AdherentModal from '../components/AdherentModal'
import AssignerListeModal from '../components/AssignerListeModal'
import AdhesionModal from '../components/AdhesionModal'
import ImportWizard from '../components/import/ImportWizard'
import { adherentsImportConfig } from '../lib/import/configs'
import CartesAdherentPdfPreviewModal from '../components/CartesAdherentPdfPreviewModal'
import ScrollShadowX from '../components/ScrollShadowX'
import { logModification } from '../lib/journalModifications'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { Select } from '../components/ui/select'
import { Badge } from '../components/ui/badge'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '../components/ui/table'
import { Dialog, DialogContent } from '../components/ui/dialog'

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

// L'adhésion est un fait dérivé de dates (comme le cachet d'ActivitesPage) — la couleur
// encode ici un vrai signal opérationnel (une adhésion expirée mérite l'ambre, convention
// déjà actée sur le projet), contrairement au statut actif/archivé ci-dessous qui est un
// simple classement manuel sans urgence.
const STATUT_CYCLE_VARIANTS: Record<StatutCycle, 'success' | 'warning' | 'neutral'> = {
  actif: 'success',
  expire: 'warning',
  aucune: 'neutral',
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

  // Sur mobile, la colonne checkbox reste masquée tant que ce mode n'est pas activé
  // (action secondaire, coûteuse en largeur) — toujours visible sur desktop.
  const [selectionMode, setSelectionMode] = useState(false)
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
    const { data } = await supabase
      .from('listes_diffusion')
      .select('nom')
      .eq('organisation_id', organisationId)
      .order('nom')
    setAvailableTags(((data ?? []) as { nom: string }[]).map((r) => r.nom))
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
    showToast(
      selectedIds.size === 0
        ? `Liste « ${tag} » créée`
        : `Liste « ${tag} » ajoutée à ${selectedIds.size} adhérent${selectedIds.size > 1 ? 's' : ''}`,
    )
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

  function toggleSelectionMode() {
    setSelectionMode((prev) => {
      if (prev) setSelectedIds(new Set())
      return !prev
    })
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
      {/*
        THESIS: le registre des adhérents distingue toujours deux natures de statut — un
        classement manuel sans urgence (actif/archivé) et un fait opérationnel dérivé de
        dates qui mérite l'alerte (adhésion expirée) — jamais confondus dans la même couleur.
        OWN-WORLD: papier clair (paper), encre vermillon (stamp), plus les encres réservées
        introduites en rollout (warning/success) pour le seul champ qui les justifie ici :
        le cycle d'adhésion. Nouvelles primitives : Select (natif, réhabillé) et Badge.
        STORY: l'admin scanne le registre, repère les adhésions à renouveler (ambre), gère
        la sélection multiple pour l'impression de cartes sans perdre le fil du filtre actif.
        FIRST VIEWPORT: barre de filtres + tableau dense, bandeau de sélection neutre (pas
        de couleur d'alerte — la sélection n'est ni un succès ni un danger).
        FORM: 4e page du rollout "carnet tamponné x registre" (ActivitesPage PR #112,
        DonsReguliersPage PR #113, DemandesAdhesionPage PR #114).
        FINISH: unreviewed and undocumented is unfinished; this build ends with the finish
        review, the verdict, and DESIGN.md.
      */}
      <div className="-m-6 min-h-[calc(100%+3rem)] space-y-6 bg-paper p-6 font-registre">
        <div>
          <h1 className="text-2xl font-bold text-ink md:text-3xl">Adhérents</h1>
          <p className="mt-1 text-sm text-ink-muted">
            Gestion des adhérents de votre organisation. Sélectionnez plusieurs adhérents (cases à cocher) pour imprimer leurs cartes en une seule fois.
          </p>
        </div>

        {error && (
          <div className="rounded-sm border border-stamp/30 bg-stamp/[0.04] px-4 py-3 text-sm text-stamp">Erreur : {error}</div>
        )}
        {printError && (
          <div className="rounded-sm border border-stamp/30 bg-stamp/[0.04] px-4 py-3 text-sm text-stamp">Erreur d'impression : {printError}</div>
        )}

        <div className="rounded-sm border border-paper-border border-l-[3px] border-l-stamp bg-white">
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-paper-border px-4 py-4 md:px-6">
            <div className="flex flex-wrap items-center gap-3">
              <Input
                type="text"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="Rechercher par nom, prénom ou email…"
                className="w-full max-w-xs"
              />
              <Select
                aria-label="Statut"
                value={statutFilter}
                onChange={(e) => { setStatutFilter(e.target.value as StatutFilter); setCurrentPage(1) }}
              >
                <option value="actif">Actifs</option>
                <option value="archive">Archivés</option>
                <option value="all">Tous</option>
              </Select>

              {/* Groupe "listes de diffusion" : filtre, exclusion et création regroupés visuellement (retour
                  utilisateur). La bordure/marge séparatrice ne s'applique qu'à partir de sm : en dessous, le
                  groupe passe à la ligne (flex-wrap du parent) et se retrouvait avec un indent + une bordure
                  verticale qui se lisait comme une boîte imbriquée non voulue (trouvé en testant sur un vrai
                  téléphone à 360px, pas juste le viewport 390px habituel). */}
              <div className="flex flex-wrap items-center gap-2 sm:border-l sm:border-paper-border sm:pl-3">
                <Select
                  aria-label="Liste de diffusion"
                  value={tagFilter}
                  onChange={(e) => { setTagFilter(e.target.value); setCurrentPage(1) }}
                >
                  <option value="">Toutes les listes</option>
                  {availableTags.map((tag) => (
                    <option key={tag} value={tag}>Liste : {tag}</option>
                  ))}
                </Select>
                {availableTags.length > 0 && (
                  <Select
                    aria-label="Exclure une liste"
                    value={excludeTagFilter}
                    onChange={(e) => { setExcludeTagFilter(e.target.value); setCurrentPage(1) }}
                  >
                    <option value="">Sans exclusion</option>
                    {availableTags.map((tag) => (
                      <option key={tag} value={tag}>Exclure : {tag}</option>
                    ))}
                  </Select>
                )}
                <Button variant="secondary" onClick={() => setAssignListeOpen(true)}>
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m6-6H6" />
                  </svg>
                  Nouvelle liste
                </Button>
              </div>
            </div>
            {/* w-full (pas flex-shrink-0) sur mobile : flex-shrink-0 fige la largeur "naturelle" du groupe
                (les 3 boutons sur une seule ligne) sans jamais laisser flex-wrap se déclencher, puisque rien
                ne contraint alors sa largeur disponible — le dernier bouton ("Ajouter") se retrouvait rendu
                hors du viewport, invisible et inatteignable (AdminLayout.tsx a overflow-hidden sur son
                conteneur racine, pas de scroll de secours). Trouvé en testant sur un vrai téléphone à 360px. */}
            <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
              <Button
                variant={selectionMode ? 'default' : 'secondary'}
                onClick={toggleSelectionMode}
                className="sm:hidden"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Sélectionner
              </Button>
              <Button variant="secondary" onClick={() => setImportOpen(true)}>
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
                </svg>
                Importer
              </Button>
              <Button onClick={openAdd}>
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                </svg>
                Ajouter
              </Button>
            </div>
          </div>

          {selectedIds.size > 0 && (
            <div className="border-b border-paper-border bg-paper px-4 py-3 md:px-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <span className="text-sm font-medium text-ink">
                  {selectedIds.size} adhérent{selectedIds.size > 1 ? 's' : ''} sélectionné{selectedIds.size > 1 ? 's' : ''}
                </span>
                <div className="flex items-center gap-3">
                  <Button variant="secondary" size="sm" onClick={() => setAssignListeOpen(true)}>
                    Ajouter à une liste
                  </Button>
                  <Button size="sm" onClick={handlePrintCards} disabled={printing} title={PRINT_HELP_TEXT}>
                    {printing ? 'Génération…' : 'Imprimer les cartes'}
                  </Button>
                </div>
              </div>
              <p className="mt-1.5 font-registre-mono text-[11px] text-ink-faint">{PRINT_HELP_TEXT}</p>
            </div>
          )}

          {loading ? (
            <div className="flex items-center justify-center py-16">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-stamp border-t-transparent" />
            </div>
          ) : adherents.length === 0 ? (
            <div className="flex items-center justify-center py-16">
              <p className="font-registre text-sm text-ink-faint">Aucun adhérent trouvé</p>
            </div>
          ) : (
            <ScrollShadowX>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className={selectionMode ? '' : 'hidden sm:table-cell'}>
                      <input
                        type="checkbox"
                        checked={selectedIds.size > 0 && selectedIds.size === adherents.length}
                        onChange={toggleSelectAll}
                        className="h-4 w-4 rounded-sm border-paper-border accent-stamp focus-visible:ring-2 focus-visible:ring-stamp/70"
                        aria-label="Tout sélectionner"
                      />
                    </TableHead>
                    <TableHead>Civilité</TableHead>
                    <TableHead>Nom</TableHead>
                    <TableHead>Prénom</TableHead>
                    <TableHead>Statut</TableHead>
                    <TableHead>Adhésion</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {adherents.map((a) => {
                    const cycle = statutCycleFor(latestAdhesions.get(a.id), todayIso)
                    return (
                      <TableRow key={a.id} onClick={() => openEdit(a)} className="cursor-pointer hover:bg-paper-border/20">
                        <TableCell className={selectionMode ? '' : 'hidden sm:table-cell'} onClick={(e) => e.stopPropagation()}>
                          <input
                            type="checkbox"
                            checked={selectedIds.has(a.id)}
                            onChange={() => toggleSelected(a.id)}
                            className="h-4 w-4 rounded-sm border-paper-border accent-stamp focus-visible:ring-2 focus-visible:ring-stamp/70"
                            aria-label={`Sélectionner ${adherentFullName(a)}`}
                          />
                        </TableCell>
                        <TableCell className="text-ink-faint">{CIVILITE_ADHERENT_LABELS[a.civilite]}</TableCell>
                        <TableCell className="font-medium text-ink">{a.nom}</TableCell>
                        <TableCell className="text-ink-muted">{a.prenom ?? '—'}</TableCell>
                        <TableCell>
                          <Badge variant="neutral">{a.statut === 'actif' ? 'Actif' : 'Archivé'}</Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant={STATUT_CYCLE_VARIANTS[cycle]}>{STATUT_CYCLE_LABELS[cycle]}</Badge>
                          {latestAdhesions.get(a.id)?.date_fin && (
                            <p className="mt-0.5 font-registre-mono text-[11px] text-ink-faint">
                              jusqu'au {formatDate(latestAdhesions.get(a.id)!.date_fin!)}
                            </p>
                          )}
                        </TableCell>
                        <TableCell onClick={(e) => e.stopPropagation()}>
                          <div className="flex justify-end gap-1">
                            <Button variant="secondary" size="sm" onClick={() => openEdit(a)}>Modifier</Button>
                            <Button variant="secondary" size="sm" onClick={() => handlePrintSingleCard(a)} disabled={printing} title={PRINT_HELP_TEXT}>
                              Carte
                            </Button>
                            {a.statut === 'actif' && (
                              <Button variant="default" size="sm" onClick={() => setRenewingAdherent(a)}>Renouveler</Button>
                            )}
                            {a.statut === 'actif' ? (
                              <Button variant="danger" size="sm" onClick={() => setArchiveConfirm(a)}>
                                Archiver
                              </Button>
                            ) : (
                              <Button variant="secondary" size="sm" onClick={() => handleReactivate(a)}>Réactiver</Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </ScrollShadowX>
          )}

          {!loading && adherents.length > 0 && (
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-paper-border px-4 py-3 md:px-6">
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
                  {(currentPage - 1) * pageSize + 1}–{Math.min(currentPage * pageSize, totalCount)} sur {totalCount}
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <Button variant="secondary" size="sm" onClick={() => setCurrentPage(1)} disabled={currentPage === 1}>«</Button>
                <Button variant="secondary" size="sm" onClick={() => setCurrentPage((p) => Math.max(1, p - 1))} disabled={currentPage === 1}>
                  ‹ Précédent
                </Button>
                <span className="font-registre-mono text-xs text-ink-faint">Page {currentPage} / {pageCount}</span>
                <Button variant="secondary" size="sm" onClick={() => setCurrentPage((p) => Math.min(pageCount, p + 1))} disabled={currentPage === pageCount}>
                  Suivant ›
                </Button>
                <Button variant="secondary" size="sm" onClick={() => setCurrentPage(pageCount)} disabled={currentPage === pageCount}>»</Button>
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

      <Dialog open={!!archiveConfirm} onOpenChange={(next) => { if (!next) setArchiveConfirm(null) }}>
        <DialogContent aria-describedby={undefined}>
          {archiveConfirm && (
            <div className="p-6">
              <h2 className="font-registre text-lg font-semibold text-ink">Archiver l'adhérent</h2>
              <p className="mt-2 font-registre text-sm text-ink-muted">
                Êtes-vous sûr de vouloir archiver <span className="font-medium text-ink">« {adherentFullName(archiveConfirm)} »</span> ?
                Il n'apparaîtra plus dans la liste des adhérents actifs, mais reste réactivable.
              </p>
              <div className="mt-5 flex justify-end gap-3">
                <Button variant="secondary" onClick={() => setArchiveConfirm(null)}>Annuler</Button>
                <Button variant="destructive" onClick={handleArchive} disabled={archiving}>
                  {archiving ? 'Archivage…' : 'Archiver'}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

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
