import { useSearchParams } from 'react-router-dom'
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
import RetirerListeModal from '../components/RetirerListeModal'
import GererListesModal from '../components/GererListesModal'
import ConfigurerColonnesModal from '../components/ConfigurerColonnesModal'
import { chargerColonnesVisibles, sauvegarderColonnesVisibles, type ColonneAdherent } from '../lib/adherentsColonnes'
import AdhesionModal from '../components/AdhesionModal'
import ImportWizard from '../components/import/ImportWizard'
import { adherentsImportConfig } from '../lib/import/configs'
import CartesAdherentPdfPreviewModal from '../components/CartesAdherentPdfPreviewModal'
import { logModification } from '../lib/journalModifications'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { Select } from '../components/ui/select'
import { downloadCsv } from '../lib/csvExport'
import { chargerDernieresAdhesions } from '../lib/dernieresAdhesions'
import { lignesExportAdherents, nomFichierExportAdherents } from '../lib/adherentsExport'
import { Badge } from '../components/ui/badge'
import { Dialog, DialogContent } from '../components/ui/dialog'
import { Label } from '../components/ui/label'
import { PageHeader } from '../components/ui/page-header'
import { TablePagination } from '../components/ui/table-pagination'
import { ListeConteneur, ListeDonnees, type ColonneListe } from '../components/ui/liste-donnees'
import { useModeListe } from '../hooks/useModeListe'
import { useTableSort } from '../hooks/useTableSort'
import { useMediaQuery } from '../hooks/useMediaQuery'
import { ADHERENT_SORT_DEFAUT, directionInitialeAdherent, paramsTriAdherents, type AdherentSortField } from '../lib/adherentsTri'
import { ListToolbar, FilterChips, type FilterChip } from '../components/ui/list-toolbar'
import { FilterSheet } from '../components/ui/filter-sheet'
import { ActionMenu } from '../components/ui/action-menu'
import { SidePanel } from '../components/ui/side-panel'
import { AdherentApercuActions, AdherentApercuChamps, AdherentApercuTitre } from '../components/AdherentApercu'
import { useAdherentApercu } from '../hooks/useAdherentApercu'
import { cn } from '../lib/utils'
import {
  ADHERENTS_FILTRES_VIDES, libelleAdhesion, libelleAdhesionCourt, nombreFiltresAdherents, normaliserFiltresAdherents,
  EMAIL_FILTRE_LABELS, type AdherentsFiltres, type EmailFilter,
} from '../lib/adherentsFiltres'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

function formatLocalisation(a: Adherent): string {
  return [[a.code_postal, a.ville].filter(Boolean).join(' '), a.pays].filter(Boolean).join(', ') || '—'
}

// États d'adhésion des fiches non archivées, d'après la dernière adhésion : « À jour », « À
// renouveler » (fin dans les 30 jours), « Expirés » (fin passée, ou aucune adhésion). Calculé par
// search_adherents (même règle que etatAdhesion), rien n'est stocké.
type StatutFilter = 'a_jour' | 'a_renouveler' | 'expire' | 'archive' | 'all'
const STATUTS_FILTRE: StatutFilter[] = ['a_jour', 'a_renouveler', 'expire', 'archive', 'all']

const STATUT_LIBELLES: Record<StatutFilter, string> = {
  a_jour: 'À jour',
  a_renouveler: 'À renouveler',
  expire: 'Expirés',
  archive: 'Archivés',
  all: 'Tous',
}

// Sous-titre de la page : « 18 adhérents à jour », « 1 adhérent expiré »…
const STATUT_SOUS_TITRE: Record<StatutFilter, [string, string]> = {
  a_jour: ['à jour', 'à jour'],
  a_renouveler: ['à renouveler', 'à renouveler'],
  expire: ['expiré', 'expirés'],
  archive: ['archivé', 'archivés'],
  all: ['au total', 'au total'],
}

// Export : limite PostgREST de 1 000 lignes par appel.
const EXPORT_PAGE_SIZE = 1000

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
  // État initial depuis l'URL (?etat=a_renouveler / ?etat=expire, liens de l'accueil), sinon À jour.
  const [statutFilter, setStatutFilter] = useState<StatutFilter>(() => {
    const etat = new URLSearchParams(window.location.search).get('etat')
    return STATUTS_FILTRE.find((s) => s === etat) ?? 'a_jour'
  })
  // Statut en cours d'édition dans le tiroir (en mobile, le statut vit dans le tiroir).
  const [brouillonStatut, setBrouillonStatut] = useState<StatutFilter>(statutFilter)
  // À partir de sm, le statut est dans la barre d'outils : ni dans le tiroir, ni en pastille.
  const statutDansLaBarre = useMediaQuery('(min-width: 640px)')
  // Filtres du tiroir : appliqués d'un coup (« Appliquer »), brouillon pendant l'édition.
  const [filtres, setFiltres] = useState<AdherentsFiltres>(ADHERENTS_FILTRES_VIDES)
  const [brouillon, setBrouillon] = useState<AdherentsFiltres>(ADHERENTS_FILTRES_VIDES)
  const [filtresOpen, setFiltresOpen] = useState(false)
  const [pageSize, setPageSize] = useState(50)
  const [currentPage, setCurrentPage] = useState(1)

  const [availableTags, setAvailableTags] = useState<string[]>([])

  const [adherentModalOpen, setAdherentModalOpen] = useState(false)
  const [editingAdherent, setEditingAdherent] = useState<Adherent | undefined>(undefined)
  const [renewingAdherent, setRenewingAdherent] = useState<Adherent | undefined>(undefined)
  const [archiveConfirm, setArchiveConfirm] = useState<Adherent | null>(null)
  const [archiving, setArchiving] = useState(false)
  const [importOpen, setImportOpen] = useState(false)
  // Panneau d'aperçu (clic sur une ligne, ou lien ?id=) ; relu à chaque changement de la fiche.
  const [apercuAdherent, setApercuAdherent] = useState<Adherent | null>(null)
  const [apercuRefresh, setApercuRefresh] = useState(0)
  const apercu = useAdherentApercu(apercuAdherent, apercuRefresh, organisationId)
  const rafraichirApercu = () => setApercuRefresh((n) => n + 1)

  // Sur mobile, la colonne checkbox reste masquée tant que ce mode n'est pas activé
  // (action secondaire, coûteuse en largeur) — toujours visible sur desktop.
  const [selectionMode, setSelectionMode] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [printing, setPrinting] = useState(false)
  const [printError, setPrintError] = useState<string | null>(null)
  const [pdfPreview, setPdfPreview] = useState<{ url: string; filename: string; count: number } | null>(null)
  const [assignListeOpen, setAssignListeOpen] = useState(false)
  const [retirerListeOpen, setRetirerListeOpen] = useState(false)
  const [gererListesOpen, setGererListesOpen] = useState(false)
  const [colonnesModalOpen, setColonnesModalOpen] = useState(false)
  const [colonnesVisibles, setColonnesVisibles] = useState<ColonneAdherent[]>(() => chargerColonnesVisibles())
  // Tri calculé par search_adherents sur toute la liste filtrée ; un nouveau tri repart de la page 1.
  const { sort, sortField, sortDirection, toggleSort } = useTableSort<AdherentSortField>({
    initial: ADHERENT_SORT_DEFAUT,
    initialDirection: directionInitialeAdherent,
    onSortChange: () => setCurrentPage(1),
  })

  // Debounce de la recherche pour éviter un appel serveur à chaque frappe
  useEffect(() => {
    const timeout = setTimeout(() => {
      setSearch(searchInput)
      setCurrentPage(1)
    }, 300)
    return () => clearTimeout(timeout)
  }, [searchInput])

  // Paramètres de search_adherents pour l'état, les filtres et la recherche en cours (liste et export).
  const rechercheParams = useCallback((limit: number, offset: number) => ({
    p_organisation_id: organisationId,
    p_search: search || null,
    p_statut: statutFilter === 'all' ? null : statutFilter,
    p_limit: limit,
    p_offset: offset,
    p_tag: filtres.tag || null,
    p_exclude_tag: filtres.excludeTag || null,
    p_email_filter: filtres.email || null,
    p_code_postal: filtres.codePostal || null,
    p_ville: filtres.ville || null,
    p_pays: filtres.pays || null,
    ...paramsTriAdherents(sort),
  }), [organisationId, search, statutFilter, filtres, sort])

  const fetchAdherents = useCallback(async () => {
    if (!organisationId) return
    setLoading(true)
    setError(null)

    const { data, error: err } = await supabase.rpc('search_adherents', rechercheParams(pageSize, (currentPage - 1) * pageSize))

    if (err) {
      setError(err.message)
      setLoading(false)
      return
    }

    const rows = (data ?? []) as SearchAdherentRow[]
    setAdherents(rows)
    setTotalCount(rows[0]?.total_count ?? 0)

    setLatestAdhesions(await chargerDernieresAdhesions(rows.map((r) => r.id)))

    setLoading(false)
  }, [organisationId, rechercheParams, pageSize, currentPage])

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

  // La sélection multiple ne survit pas à un changement de page/filtre/recherche/tri
  // (les lignes affichées changent complètement, la garder n'aurait pas de sens).
  useEffect(() => {
    setSelectedIds(new Set())
  }, [search, statutFilter, filtres, sort, pageSize, currentPage])

  const todayIso = useMemo(() => new Date().toISOString().split('T')[0], [])
  const pageCount = Math.max(1, Math.ceil(totalCount / pageSize))
  const selectedAdherents = useMemo(
    () => adherents.filter((a) => selectedIds.has(a.id)).map((a) => ({ id: a.id, tags: a.tags })),
    [adherents, selectedIds],
  )

  function appliquerFiltres(next: AdherentsFiltres) {
    setFiltres(normaliserFiltresAdherents(next))
    setCurrentPage(1)
  }

  function openFiltres() {
    setBrouillon(filtres)
    setBrouillonStatut(statutFilter)
    setFiltresOpen(true)
  }

  // Mobile : un statut autre que « À jour » (valeur par défaut) compte comme un filtre actif.
  const statutEnPastille = !statutDansLaBarre && statutFilter !== 'a_jour'

  function effacerFiltres() {
    appliquerFiltres(ADHERENTS_FILTRES_VIDES)
    if (statutEnPastille) setStatutFilter('a_jour')
  }

  const chips: FilterChip[] = [
    statutEnPastille && { key: 'statut', label: 'Statut', value: STATUT_LIBELLES[statutFilter], onRemove: () => { setStatutFilter('a_jour'); setCurrentPage(1) } },
    filtres.tag && { key: 'tag', label: 'Liste', value: filtres.tag, onRemove: () => appliquerFiltres({ ...filtres, tag: '' }) },
    filtres.excludeTag && { key: 'excludeTag', label: 'Hors liste', value: filtres.excludeTag, onRemove: () => appliquerFiltres({ ...filtres, excludeTag: '' }) },
    filtres.email && { key: 'email', label: 'Email', value: EMAIL_FILTRE_LABELS[filtres.email], onRemove: () => appliquerFiltres({ ...filtres, email: '' }) },
    filtres.codePostal && { key: 'codePostal', label: 'Code postal', value: filtres.codePostal, onRemove: () => appliquerFiltres({ ...filtres, codePostal: '' }) },
    filtres.ville && { key: 'ville', label: 'Ville', value: filtres.ville, onRemove: () => appliquerFiltres({ ...filtres, ville: '' }) },
    filtres.pays && { key: 'pays', label: 'Pays', value: filtres.pays, onRemove: () => appliquerFiltres({ ...filtres, pays: '' }) },
  ].filter((chip): chip is FilterChip => Boolean(chip))

  const [exporting, setExporting] = useState(false)

  // Exporte la sélection si elle existe (page affichée), sinon toutes les lignes de l'état, des
  // filtres et de la recherche en cours (toutes les pages), avec les colonnes affichées.
  async function handleExport() {
    if (!organisationId) return
    setExporting(true)
    try {
      let lignes: Adherent[]
      let adhesions: Map<string, Adhesion>
      if (selectedIds.size > 0) {
        lignes = adherents.filter((a) => selectedIds.has(a.id))
        adhesions = latestAdhesions
      } else {
        lignes = []
        for (let offset = 0; ; offset += EXPORT_PAGE_SIZE) {
          const { data, error: err } = await supabase.rpc('search_adherents', rechercheParams(EXPORT_PAGE_SIZE, offset))
          if (err) throw new Error(err.message)
          const rows = (data ?? []) as SearchAdherentRow[]
          lignes.push(...rows)
          if (rows.length < EXPORT_PAGE_SIZE || lignes.length >= (rows[0]?.total_count ?? 0)) break
        }
        adhesions = await chargerDernieresAdhesions(lignes.map((a) => a.id))
      }
      downloadCsv(
        nomFichierExportAdherents(statutFilter, selectedIds.size > 0, todayIso),
        lignesExportAdherents(lignes, adhesions, colonnesVisibles, todayIso),
      )
    } catch (e) {
      showToast(`Export impossible : ${e instanceof Error ? e.message : String(e)}`)
    } finally {
      setExporting(false)
    }
  }

  function toggleColonne(key: ColonneAdherent) {
    setColonnesVisibles((prev) => {
      const next = prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
      sauvegarderColonnesVisibles(next)
      return next
    })
  }

  function openAdd() {
    setEditingAdherent(undefined)
    setAdherentModalOpen(true)
  }

  function openEdit(a: Adherent) {
    setEditingAdherent(a)
    setAdherentModalOpen(true)
  }

  // Clic sur une ligne : ouvre l'aperçu, un second clic sur la même ligne le referme.
  function toggleApercu(a: Adherent) {
    setApercuAdherent((current) => (current?.id === a.id ? null : a))
  }

  // Fiche ouverte introuvable à la relecture (supprimée entre-temps) : l'aperçu se referme.
  useEffect(() => {
    if (apercu.introuvable) setApercuAdherent(null)
  }, [apercu.introuvable])

  // Lien profond depuis la recherche globale : ?id=<adherent_id>. La liste étant paginée côté
  // serveur, la fiche est chargée directement (dans l'organisation courante) puis ouverte en aperçu.
  const [searchParams, setSearchParams] = useSearchParams()
  const linkedAdherentId = searchParams.get('id')
  useEffect(() => {
    if (!linkedAdherentId || !organisationId) return
    let cancelled = false
    void supabase
      .from('adherents')
      .select('*')
      .eq('id', linkedAdherentId)
      .eq('organisation_id', organisationId)
      .maybeSingle()
      .then(({ data }) => {
        if (cancelled) return
        if (data) setApercuAdherent(data as Adherent)
        setSearchParams((current) => {
          const next = new URLSearchParams(current)
          next.delete('id')
          return next
        }, { replace: true })
      })
    return () => { cancelled = true }
  }, [linkedAdherentId, organisationId, setSearchParams])

  // Arrivée depuis l'action rapide « Ajouter un adhérent » du menu latéral (?nouveau=1) : création
  // ouverte d'emblée, paramètre retiré de l'URL pour ne pas rouvrir la modale au rechargement.
  useEffect(() => {
    if (searchParams.get('nouveau') !== '1') return
    setEditingAdherent(undefined)
    setAdherentModalOpen(true)
    setSearchParams((current) => {
      const next = new URLSearchParams(current)
      next.delete('nouveau')
      return next
    }, { replace: true })
  }, [searchParams, setSearchParams])

  function handleAdherentSaved(saved: Adherent) {
    const wasEdit = !!editingAdherent
    showToast(`${adherentFullName(saved)} ${wasEdit ? 'modifié' : 'ajouté'}`)
    fetchAdherents()
    fetchAvailableTags()
    if (wasEdit) rafraichirApercu()
  }

  function handleListesChanged() {
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

  function handleListeRemoved(tag: string, count: number) {
    showToast(`${count} adhérent${count > 1 ? 's' : ''} retiré${count > 1 ? 's' : ''} de la liste « ${tag} »`)
    setSelectedIds(new Set())
    fetchAdherents()
    fetchAvailableTags()
  }

  function handleAdhesionSaved() {
    if (renewingAdherent) showToast(`Adhésion renouvelée pour ${adherentFullName(renewingAdherent)}`)
    setRenewingAdherent(undefined)
    fetchAdherents()
    rafraichirApercu()
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
    rafraichirApercu()
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
    rafraichirApercu()
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
      body: JSON.stringify({ adherent_ids: ids, organisation_id: organisationId }),
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

  // Panneau d'aperçu ouvert (il réduit le tableau en desktop) : la civilité et les colonnes
  // facultatives ne restent qu'en très grand écran ; toutes figurent dans l'aperçu (motif de Dons).
  const colCivilite = apercuAdherent ? 'hidden 2xl:table-cell' : 'hidden xl:table-cell'
  const colSecondaire = apercuAdherent ? 'hidden 2xl:table-cell' : undefined
  // Le prénom rejoint alors la cellule du nom (comme en mobile), pour laisser la place à l'adhésion.
  const colPrenom = apercuAdherent ? 'hidden 2xl:table-cell' : 'hidden md:table-cell'
  const prenomDansNom = apercuAdherent ? '2xl:hidden' : 'md:hidden'

  // Sous 768 px : cartes par défaut, ou tableau au choix (mémorisé sur l'appareil).
  const { mode, selecteur } = useModeListe('adherents')

  // Colonnes affichées (choix « Colonnes », Nom et Prénom fixes) et place de chacune dans une
  // carte : « NOM Prénom » en titre, adhésion et fiche en pastilles, le reste en méta.
  const colonneVisible = (key: ColonneAdherent) => colonnesVisibles.includes(key)
  const toutesColonnes: (ColonneListe<Adherent, AdherentSortField> | false)[] = [
    colonneVisible('civilite') && {
      key: 'civilite', label: 'Civilité', role: 'masquee',
      headClassName: colCivilite, cellClassName: cn(colCivilite, 'whitespace-nowrap text-ink-faint'),
      cell: (a) => CIVILITE_ADHERENT_LABELS[a.civilite],
    },
    {
      key: 'nom', label: 'Nom', sortField: 'nom', role: 'titre',
      cellClassName: 'whitespace-nowrap font-medium text-ink',
      // Tableau mobile : « NOM Prénom » et la pastille Adhésion (libellé sans date) dans cette
      // cellule ; les colonnes Prénom et Adhésion sont masquées.
      cell: (a) => (
        <>
          {a.nom}
          {a.prenom && <span className={cn('font-normal text-ink-muted', prenomDansNom)}> {a.prenom}</span>}
          {colonneVisible('adhesion') && (
            <div className="mt-1 md:hidden">
              <Badge variant={libelleAdhesion(latestAdhesions.get(a.id), todayIso).variant}>{libelleAdhesionCourt(latestAdhesions.get(a.id), todayIso)}</Badge>
            </div>
          )}
        </>
      ),
      carte: (a) => (
        <>
          {a.nom}
          {a.prenom && <span className="font-normal text-ink-muted"> {a.prenom}</span>}
        </>
      ),
    },
    colonneVisible('adhesion') && {
      key: 'adhesion', label: 'Adhésion', sortField: 'date_fin', role: 'pastille',
      headClassName: 'hidden md:table-cell', cellClassName: 'hidden md:table-cell',
      cell: (a) => {
        const adhesion = libelleAdhesion(latestAdhesions.get(a.id), todayIso)
        return (
          <>
            {/* Panneau ouvert : libellé court sous 2xl (la date est dans l'aperçu). */}
            <Badge variant={adhesion.variant} className={apercuAdherent ? 'hidden 2xl:inline-flex' : undefined}>{adhesion.label}</Badge>
            {apercuAdherent && (
              <Badge variant={adhesion.variant} className="2xl:hidden">{libelleAdhesionCourt(latestAdhesions.get(a.id), todayIso)}</Badge>
            )}
          </>
        )
      },
      carte: (a) => (
        <Badge variant={libelleAdhesion(latestAdhesions.get(a.id), todayIso).variant}>{libelleAdhesionCourt(latestAdhesions.get(a.id), todayIso)}</Badge>
      ),
    },
    {
      key: 'prenom', label: 'Prénom', sortField: 'prenom', role: 'masquee',
      headClassName: colPrenom, cellClassName: cn(colPrenom, 'whitespace-nowrap text-ink-muted'),
      cell: (a) => a.prenom ?? '—',
    },
    colonneVisible('statut') && {
      key: 'statut', label: 'Fiche', sortField: 'statut', role: 'pastille',
      headClassName: colSecondaire, cellClassName: colSecondaire,
      cell: (a) => <Badge variant="neutral">{a.statut === 'actif' ? 'Active' : 'Archivée'}</Badge>,
    },
    colonneVisible('date_adhesion') && {
      key: 'date_adhesion', label: "Date d'adhésion", sortField: 'date_adhesion', role: 'secondaire',
      headClassName: colSecondaire, cellClassName: cn(colSecondaire, 'whitespace-nowrap text-ink-muted'),
      cell: (a) => {
        const debut = latestAdhesions.get(a.id)?.date_debut
        return debut ? formatDate(debut) : '—'
      },
      carte: (a) => {
        const debut = latestAdhesions.get(a.id)?.date_debut
        return debut ? `Adhésion du ${formatDate(debut)}` : null
      },
    },
    colonneVisible('email') && {
      key: 'email', label: 'Email', role: 'secondaire',
      headClassName: colSecondaire, cellClassName: cn(colSecondaire, 'text-ink-muted'),
      cell: (a) => a.courriel ?? '—',
      carte: (a) => a.courriel,
    },
    colonneVisible('telephone') && {
      key: 'telephone', label: 'Téléphone', role: 'secondaire',
      headClassName: colSecondaire, cellClassName: cn(colSecondaire, 'text-ink-muted'),
      cell: (a) => a.telephone ?? '—',
      carte: (a) => a.telephone,
    },
    colonneVisible('adresse') && {
      key: 'adresse', label: 'Adresse', role: 'secondaire',
      headClassName: colSecondaire, cellClassName: cn(colSecondaire, 'text-ink-muted'),
      cell: (a) => a.adresse ?? '—',
      carte: (a) => a.adresse,
    },
    colonneVisible('localisation') && {
      key: 'localisation', label: 'Localisation', sortField: 'code_postal', role: 'secondaire',
      headClassName: colSecondaire, cellClassName: cn(colSecondaire, 'text-ink-muted'),
      cell: formatLocalisation,
      carte: (a) => {
        const loc = formatLocalisation(a)
        return loc === '—' ? null : loc
      },
    },
    colonneVisible('date_naissance') && {
      key: 'date_naissance', label: 'Date de naissance', role: 'secondaire',
      headClassName: colSecondaire, cellClassName: cn(colSecondaire, 'text-ink-muted'),
      cell: (a) => (a.date_naissance ? formatDate(a.date_naissance) : '—'),
      carte: (a) => (a.date_naissance ? `Né(e) le ${formatDate(a.date_naissance)}` : null),
    },
    colonneVisible('listes') && {
      key: 'listes', label: 'Listes', role: 'secondaire',
      headClassName: colSecondaire, cellClassName: cn(colSecondaire, 'text-ink-muted'),
      cell: (a) => (a.tags.length > 0 ? a.tags.join(', ') : '—'),
      carte: (a) => (a.tags.length > 0 ? a.tags.join(', ') : null),
    },
  ]
  const colonnes = toutesColonnes.filter((c): c is ColonneListe<Adherent, AdherentSortField> => c !== false)

  // Menu « Sélection et listes » de la barre d'outils (sous xl, ou 2xl panneau ouvert). « Sélectionner »
  // n'y figure pas à partir de xl : la colonne des cases y est toujours affichée.
  const casesToujoursVisibles = useMediaQuery('(min-width: 1280px)')
  const optionsMenuItems = [
    ...(casesToujoursVisibles ? [] : [{ label: selectionMode ? 'Terminer la sélection' : 'Sélectionner', onSelect: toggleSelectionMode }]),
    { label: 'Colonnes', onSelect: () => setColonnesModalOpen(true) },
    { label: 'Nouvelle liste', onSelect: () => { setSelectedIds(new Set()); setAssignListeOpen(true) } },
    { label: 'Gérer les listes', onSelect: () => setGererListesOpen(true), disabled: availableTags.length === 0 },
  ]

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
      <div className="-m-6 min-h-[calc(100%+3rem)] space-y-6 bg-paper px-4 py-6 font-registre md:px-6">
        <PageHeader
          title="Adhérents"
          subtitle={
            loading && totalCount === 0
              ? 'Chargement…'
              : `${totalCount} adhérent${totalCount > 1 ? 's' : ''} ${STATUT_SOUS_TITRE[statutFilter][totalCount > 1 ? 1 : 0]}`
          }
          actions={
            <>
              <Button variant="secondary" onClick={() => setImportOpen(true)} className="hidden sm:inline-flex">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
                </svg>
                Importer
              </Button>
              <Button variant="secondary" onClick={() => void handleExport()} disabled={exporting || totalCount === 0} className="hidden sm:inline-flex">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-6-3.75L12 17.25m0 0L7.5 12.75M12 17.25V3" />
                </svg>
                {exporting ? 'Export…' : 'Exporter'}
              </Button>
              <Button onClick={openAdd}>
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                </svg>
                Ajouter un adhérent
              </Button>
              {/* Mobile : Importer / Exporter regroupés derrière un bouton « ⋯ » après l'action principale. */}
              <div className="sm:hidden">
                <ActionMenu
                  label="Importer ou exporter"
                  iconOnly
                  items={[
                    { label: 'Importer', onSelect: () => setImportOpen(true) },
                    { label: exporting ? 'Export…' : 'Exporter', onSelect: () => void handleExport(), disabled: exporting || totalCount === 0 },
                  ]}
                />
              </div>
            </>
          }
        />

        {error && (
          <div className="rounded-sm border border-stamp/30 bg-stamp/[0.04] px-4 py-3 text-sm text-stamp">Erreur : {error}</div>
        )}
        {printError && (
          <div className="rounded-sm border border-stamp/30 bg-stamp/[0.04] px-4 py-3 text-sm text-stamp">Erreur d'impression : {printError}</div>
        )}

        {/* Liste + panneau d'aperçu (gabarit de liste, comme Dons). */}
        <div className={cn('flex gap-6', apercuAdherent && 'items-start')}>
          <ListeConteneur>
            <ListToolbar
              search={{ value: searchInput, onChange: setSearchInput, placeholder: 'Nom, prénom, email…', label: 'Rechercher un adhérent' }}
              filterCount={nombreFiltresAdherents(filtres) + (statutEnPastille ? 1 : 0)}
              onOpenFilters={openFiltres}
              mode={selecteur}
              end={
                <>
                  {/* Colonnes et Listes en boutons à partir de xl (2xl panneau ouvert, pour que la barre
                      tienne sur une ligne à côté du tableau réduit). */}
                  <Button variant="secondary" onClick={() => setColonnesModalOpen(true)} className={cn('hidden', apercuAdherent ? '2xl:inline-flex' : 'xl:inline-flex')}>
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h12A2.25 2.25 0 0120.25 6v12A2.25 2.25 0 0118 20.25H6A2.25 2.25 0 013.75 18V6zM9.75 4.5v15m4.5-15v15" />
                    </svg>
                    Colonnes
                  </Button>
                  <div className={cn('hidden', apercuAdherent ? '2xl:block' : 'xl:block')}>
                    <ActionMenu
                      label="Listes"
                      items={[
                        { label: 'Nouvelle liste', onSelect: () => { setSelectedIds(new Set()); setAssignListeOpen(true) } },
                        { label: 'Gérer les listes', onSelect: () => setGererListesOpen(true), disabled: availableTags.length === 0 },
                      ]}
                    />
                  </div>
                  {/* En dessous : sélection, Colonnes et Listes dans un seul menu icône (la colonne des
                      cases à cocher n'apparaît alors qu'en mode sélection). En mobile, il tient à côté
                      de « Filtres · n » et du sélecteur tableau / cartes. */}
                  <ActionMenu
                    label="Sélection et listes"
                    iconOnly
                    items={optionsMenuItems}
                    className={apercuAdherent ? '2xl:hidden' : 'xl:hidden'}
                  />
                </>
              }
            >
              {/* Mobile : le statut passe dans le tiroir de filtres (barre d'outils sur deux lignes). */}
              <div className="hidden sm:block">
                <Select
                  aria-label="Statut"
                  value={statutFilter}
                  onChange={(e) => { setStatutFilter(e.target.value as StatutFilter); setCurrentPage(1) }}
                >
                  {STATUTS_FILTRE.map((s) => <option key={s} value={s}>{STATUT_LIBELLES[s]}</option>)}
                </Select>
              </div>
            </ListToolbar>
            <FilterChips chips={chips} onClearAll={effacerFiltres} />

            {/* Barre d'actions groupées : apparaît dès qu'un adhérent est coché. */}
            {selectedIds.size > 0 && (
              <div className="border-b border-paper-border bg-paper px-4 py-3 md:px-6" role="region" aria-label="Actions sur la sélection">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="mr-2 text-sm font-medium text-ink">
                    {selectedIds.size} adhérent{selectedIds.size > 1 ? 's' : ''} sélectionné{selectedIds.size > 1 ? 's' : ''}
                  </span>
                  <Button size="sm" onClick={handlePrintCards} disabled={printing}>
                    {printing ? 'Génération…' : 'Imprimer les cartes'}
                  </Button>
                  <Button variant="secondary" size="sm" onClick={() => setAssignListeOpen(true)}>
                    Ajouter à une liste
                  </Button>
                  {availableTags.length > 0 && (
                    <Button variant="secondary" size="sm" onClick={() => setRetirerListeOpen(true)}>
                      Retirer d'une liste
                    </Button>
                  )}
                  <Button variant="ghost" size="sm" onClick={() => setSelectedIds(new Set())}>
                    Désélectionner
                  </Button>
                </div>
                <p className="mt-1.5 text-xs text-ink-faint">{PRINT_HELP_TEXT}</p>
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
              <ListeDonnees
                rows={adherents}
                rowKey={(a) => a.id}
                columns={colonnes}
                mode={mode}
                sort={{ field: sortField, direction: sortDirection, onSort: toggleSort }}
                onRowClick={toggleApercu}
                activeKey={apercuAdherent?.id}
                rowLabel={adherentFullName}
                selection={{
                  selected: selectedIds,
                  onToggle: toggleSelected,
                  onToggleAll: toggleSelectAll,
                  // Sous xl, la colonne des cases n'apparaît qu'en mode sélection (menu de la barre).
                  tableClassName: selectionMode ? undefined : 'hidden xl:table-cell',
                  showInCards: selectionMode,
                }}
              />
            )}

            {!loading && adherents.length > 0 && (
              <TablePagination
                page={Math.min(currentPage, pageCount)}
                pageCount={pageCount}
                totalCount={totalCount}
                pageSize={pageSize}
                onPageChange={setCurrentPage}
                onPageSizeChange={setPageSize}
              />
            )}
          </ListeConteneur>

          <SidePanel
            open={!!apercuAdherent}
            onClose={() => setApercuAdherent(null)}
            title={apercu.fiche ? <AdherentApercuTitre adherent={apercu.fiche} /> : 'Adhérent'}
            footer={apercu.fiche && (
              <AdherentApercuActions
                fiche={apercu.fiche}
                printing={printing}
                printHelpText={PRINT_HELP_TEXT}
                onEdit={() => apercu.fiche && openEdit(apercu.fiche)}
                onRenew={() => apercu.fiche && setRenewingAdherent(apercu.fiche)}
                onPrintCard={() => apercu.fiche && void handlePrintSingleCard(apercu.fiche)}
              />
            )}
          >
            {apercu.fiche && <AdherentApercuChamps fiche={apercu.fiche} adhesion={apercu.adhesion} todayIso={todayIso} />}
          </SidePanel>
        </div>
      </div>

      <FilterSheet
        open={filtresOpen}
        onOpenChange={setFiltresOpen}
        onReset={() => {
          setBrouillon(ADHERENTS_FILTRES_VIDES)
          // Le statut n'est réinitialisé que s'il est dans le tiroir (mobile).
          if (!statutDansLaBarre) setBrouillonStatut('a_jour')
        }}
        onApply={() => {
          if (!statutDansLaBarre && brouillonStatut !== statutFilter) setStatutFilter(brouillonStatut)
          appliquerFiltres(brouillon)
          setFiltresOpen(false)
        }}
      >
        {/* Statut : dans la barre d'outils à partir de sm, ici en mobile. */}
        <div className="space-y-1.5 sm:hidden">
          <Label htmlFor="adh-filtre-statut">Statut</Label>
          <Select id="adh-filtre-statut" className="w-full" value={brouillonStatut} onChange={(e) => setBrouillonStatut(e.target.value as StatutFilter)}>
            {STATUTS_FILTRE.map((s) => <option key={s} value={s}>{STATUT_LIBELLES[s]}</option>)}
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="adh-filtre-liste">Liste</Label>
          <Select id="adh-filtre-liste" className="w-full" value={brouillon.tag} onChange={(e) => setBrouillon((b) => ({ ...b, tag: e.target.value }))}>
            <option value="">Toutes les listes</option>
            {availableTags.map((tag) => <option key={tag} value={tag}>{tag}</option>)}
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="adh-filtre-exclure">Exclure la liste</Label>
          <Select id="adh-filtre-exclure" className="w-full" value={brouillon.excludeTag} onChange={(e) => setBrouillon((b) => ({ ...b, excludeTag: e.target.value }))}>
            <option value="">Aucune</option>
            {availableTags.map((tag) => <option key={tag} value={tag}>{tag}</option>)}
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="adh-filtre-email">Email</Label>
          <Select id="adh-filtre-email" className="w-full" value={brouillon.email} onChange={(e) => setBrouillon((b) => ({ ...b, email: e.target.value as EmailFilter }))}>
            <option value="">Tous</option>
            {(Object.keys(EMAIL_FILTRE_LABELS) as Exclude<EmailFilter, ''>[]).map((value) => (
              <option key={value} value={value}>{EMAIL_FILTRE_LABELS[value]}</option>
            ))}
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="adh-filtre-cp">Code postal</Label>
          <Input id="adh-filtre-cp" value={brouillon.codePostal} onChange={(e) => setBrouillon((b) => ({ ...b, codePostal: e.target.value }))} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="adh-filtre-ville">Ville</Label>
          <Input id="adh-filtre-ville" value={brouillon.ville} onChange={(e) => setBrouillon((b) => ({ ...b, ville: e.target.value }))} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="adh-filtre-pays">Pays</Label>
          <Input id="adh-filtre-pays" value={brouillon.pays} onChange={(e) => setBrouillon((b) => ({ ...b, pays: e.target.value }))} />
        </div>
      </FilterSheet>

      <AdherentModal
        open={adherentModalOpen}
        onClose={() => setAdherentModalOpen(false)}
        onSaved={handleAdherentSaved}
        adherent={editingAdherent}
        organisationId={organisationId}
        availableTags={availableTags}
        statutActif={editingAdherent?.statut === 'actif'}
        printing={printing}
        printHelpText={PRINT_HELP_TEXT}
        onPrintCard={editingAdherent && (() => {
          const a = editingAdherent
          setAdherentModalOpen(false)
          handlePrintSingleCard(a)
        })}
        onRenew={editingAdherent && (() => {
          const a = editingAdherent
          setAdherentModalOpen(false)
          setRenewingAdherent(a)
        })}
        onArchive={editingAdherent && (() => {
          const a = editingAdherent
          setAdherentModalOpen(false)
          setArchiveConfirm(a)
        })}
        onReactivate={editingAdherent && (() => {
          const a = editingAdherent
          setAdherentModalOpen(false)
          handleReactivate(a)
        })}
      />

      <AssignerListeModal
        open={assignListeOpen}
        onClose={() => setAssignListeOpen(false)}
        onAssigned={handleListeAssigned}
        organisationId={organisationId}
        adherentIds={Array.from(selectedIds)}
        availableTags={availableTags}
      />

      <RetirerListeModal
        open={retirerListeOpen}
        onClose={() => setRetirerListeOpen(false)}
        onRemoved={handleListeRemoved}
        organisationId={organisationId}
        selectedAdherents={selectedAdherents}
      />

      <GererListesModal
        open={gererListesOpen}
        onClose={() => setGererListesOpen(false)}
        onChanged={handleListesChanged}
        organisationId={organisationId}
      />

      <ConfigurerColonnesModal
        open={colonnesModalOpen}
        onClose={() => setColonnesModalOpen(false)}
        colonnesVisibles={colonnesVisibles}
        onToggle={toggleColonne}
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
            <div className="overflow-y-auto p-6">
              <h2 className="font-registre text-lg font-semibold text-ink">Archiver l'adhérent</h2>
              <p className="mt-2 font-registre text-sm text-ink-muted">
                Êtes-vous sûr de vouloir archiver <span className="font-medium text-ink">« {adherentFullName(archiveConfirm)} »</span> ?
                Il n'apparaîtra plus que dans le filtre « Archivés », et reste réactivable.
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
