import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { StatusNotice } from '../components/ui/status-notice'
import { supabase } from '../lib/supabaseClient'
import { useOrganisationId } from '../hooks/useOrganisationId'
import { useToast } from '../hooks/useToast'
import type { RecuFiscal, RecuFiscalVersion, ProfilParticipant } from '../types'
import { fetchAllRows } from '../lib/fetchAllRows'
import { participantFullName, matchesParticipantSearch } from '../lib/participantSearch'
import {
  pagesParametresACompleter, resumeValidationParticipant, validateOrganisationCerfa,
  validateParticipantCerfa,
  type OrganisationFiscale,
  type ParticipantValidation,
} from '../lib/cerfaValidation'
import ParticipantModal from '../components/ParticipantModal'
import DeclarationCerfaCard from '../components/DeclarationCerfaCard'
import { useRecapitulatif222Bis } from '../hooks/useRecapitulatif222Bis'
import Toast from '../components/Toast'
import { Button } from '../components/ui/button'
import { Select } from '../components/ui/select'
import { Badge } from '../components/ui/badge'
import ButtonHint from '../components/ButtonHint'
import { Dialog, DialogContent } from '../components/ui/dialog'
import { PageHeader } from '../components/ui/page-header'
import { TablePagination } from '../components/ui/table-pagination'
import { ListToolbar, FilterChips, type FilterChip } from '../components/ui/list-toolbar'
import { FilterSheet } from '../components/ui/filter-sheet'
import { ActionMenu } from '../components/ui/action-menu'
import { SidePanel, DetailField } from '../components/ui/side-panel'
import { cn } from '../lib/utils'
import { comparerOrdreAttribution, raisonExclusion, recusAGenerer, recusExclus } from '../lib/recusAGenerer'
import { useRecusLot } from '../hooks/useRecusLot'
import { useCleCourante } from '../hooks/useCleCourante'
import { lotTraites, messageErreurLot, messageLancementLot } from '../lib/recusLot'
import RecusLotBandeau from '../components/RecusLotBandeau'
import RecusLotRecapitulatifDialog from '../components/RecusLotRecapitulatifDialog'
import EmailInvalideIndicateur from '../components/EmailInvalideIndicateur'
import type { RecapitulatifEnvoi } from '../types/recusLot'
import { ListeConteneur, ListeDonnees, type ColonneListe } from '../components/ui/liste-donnees'
import { useTableSort } from '../hooks/useTableSort'
import { useModeListe } from '../hooks/useModeListe'
import { compareText, directionInitiale, sortRows, type SortColumns } from '../lib/tableSort'
import {
  ENVOI_OPTIONS, GENERATION_OPTIONS, RECUS_FILTRES_VIDES, envoiVersionActuelle, filtrerRecus, nombreFiltresRecus, statutEnvoi,
  type RecusFiltres,
} from '../lib/recusFiltres'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ParticipantRow {
  profil: ProfilParticipant
  total_dons: number
  recu: RecuFiscal | null
  validation: ParticipantValidation
}

type RecuSortField = 'donateur' | 'total' | 'numero'

// Donateur : ordre d'annuaire (nom puis prénom, l'affichage reste « Prénom Nom ») ;
// N° reçu : comparaison numérique des chiffres, lignes sans reçu en dernier.
const RECU_SORT_COLUMNS: SortColumns<ParticipantRow, RecuSortField> = {
  donateur: { type: 'text', value: (r) => [r.profil.personnes.nom, r.profil.personnes.prenom] },
  total: { type: 'number', value: (r) => r.total_dons },
  numero: { type: 'text', value: (r) => r.recu?.numero_ordre },
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

// Pastille d'envoi : jour et mois suffisent (l'année est celle de la page, à quelques semaines près).
function formatJourMois(iso: string): string {
  return new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' })
}

// Date et heure : plusieurs versions d'un même reçu peuvent être générées le même jour.
function formatDateEtHeure(iso: string): string {
  return new Date(iso).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

function yearOptions() {
  const cy = currentYear()
  return [cy, cy - 1, cy - 2, cy - 3]
}

// Bilan d'un lot fermé par l'admin (par lot, dans ce navigateur) : ne réapparaît pas à la réouverture.
function cleBilanFerme(lotId: string) {
  return `recus-lot-bilan-ferme:${lotId}`
}

function bilanDejaFerme(lotId: string): boolean {
  try {
    return window.localStorage.getItem(cleBilanFerme(lotId)) === '1'
  } catch {
    return false
  }
}

const TYPE_CERFA_LABELS: Record<string, string> = {
  '11580': '11580 · Particuliers',
  '16216': '16216 · Entreprises',
}

// Choix unique d'un filtre du tiroir, en pastilles (« Tous » + options), comme la période des Dons.
function ChoixFiltre<V extends string>({ legend, aide, options, value, onChange }: {
  legend: string
  aide: string
  options: { value: V; label: string }[]
  value: V | ''
  onChange: (value: V | '') => void
}) {
  const choix: { value: V | ''; label: string }[] = [{ value: '', label: 'Tous' }, ...options]
  return (
    <fieldset className="space-y-2">
      <legend className="text-sm font-medium text-ink">{legend}</legend>
      <div className="flex flex-wrap gap-2">
        {choix.map((o) => (
          <button
            key={o.value || 'tous'}
            type="button"
            onClick={() => onChange(o.value)}
            aria-pressed={value === o.value}
            className={cn(
              'rounded-full border px-3 py-1 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stamp/70',
              value === o.value ? 'border-stamp bg-stamp/[0.06] text-stamp' : 'border-paper-border bg-white text-ink-muted hover:bg-paper',
            )}
          >
            {o.label}
          </button>
        ))}
      </div>
      <p className="text-xs text-ink-faint">{aide}</p>
    </fieldset>
  )
}

// ---------------------------------------------------------------------------
// RecusFiscauxPage
// ---------------------------------------------------------------------------

export default function RecusFiscauxPage() {
  const organisationId = useOrganisationId()
  const { toast, showToast, dismissToast } = useToast()

  // ?annee=AAAA&q=<nom> : lien « Reçu » du détail d'un don, raccourci de la recherche globale.
  const [searchParams] = useSearchParams()
  const [annee, setAnnee] = useState<number>(() => {
    const demandee = Number(searchParams.get('annee'))
    return yearOptions().includes(demandee) ? demandee : currentYear()
  })
  const [rows, setRows] = useState<ParticipantRow[]>([])
  // Organisation et année affichées : une réponse arrivée après leur changement est ignorée.
  const estCleCourante = useCleCourante(`${organisationId}|${annee}`)
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

  // Lot de génération côté serveur : récapitulatif avant lancement, bilan fermé
  const [recapOpen, setRecapOpen] = useState(false)
  const [recapError, setRecapError] = useState<string | null>(null)
  const [bilansFermes, setBilansFermes] = useState<Record<string, boolean>>({})

  // Lot d'envoi : récapitulatif serveur (recapitulatif_envoi_lot_recus), canal Brevo / Samakan
  const [recapEnvoi, setRecapEnvoi] = useState<RecapitulatifEnvoi | null>(null)
  const [recapEnvoiOpen, setRecapEnvoiOpen] = useState(false)
  const [recapEnvoiError, setRecapEnvoiError] = useState<string | null>(null)
  const [recapEnvoiLoading, setRecapEnvoiLoading] = useState(false)

  // Régénération (confirmation) et édition participant
  const [regenerateConfirm, setRegenerateConfirm] = useState<ParticipantRow | null>(null)
  const [editingProfil, setEditingProfil] = useState<ProfilParticipant | undefined>(undefined)
  const [participantModalOpen, setParticipantModalOpen] = useState(false)
  const [selectedId, setSelectedId] = useState<string | null>(null)

  // Historique des versions du reçu affiché dans le panneau de détail
  const [versions, setVersions] = useState<RecuFiscalVersion[]>([])
  const [versionsLoading, setVersionsLoading] = useState(false)
  const [versionsError, setVersionsError] = useState<string | null>(null)
  const [versionDlLoading, setVersionDlLoading] = useState<Record<string, boolean>>({})
  const versionsRecuIdRef = useRef<string | null>(null)

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
        .select('id, personne_id, organisation_id, notes, id_externe, created_at, email_invalide_at, email_invalide_evenement, email_invalide_raison, personnes!inner(id, nom, prenom, email, telephone, civilite, nom2, prenom2, adresse, code_postal, ville, pays)')
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

    // Sort by nom then prenom — garde l'ordre de « Tout générer » (attribution des numéros),
    // indépendant du tri affiché.
    built.sort(comparerOrdreAttribution)

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
      body: JSON.stringify({ profil_participant_id: profilId, annee, organisation_id: organisationId }),
    })

    const json = await res.json()
    if (!res.ok) {
      setGenError((prev) => ({ ...prev, [profilId]: json.error ?? 'Erreur inconnue' }))
      setGenLoading((prev) => ({ ...prev, [profilId]: false }))
      return
    }

    await rafraichirLigne(profilId)
    setGenLoading((prev) => ({ ...prev, [profilId]: false }))
    showToast(`Reçu généré pour ${participantFullName(row.profil)}`)
  }

  // Relecture du seul reçu d'un donateur (après génération) : la réponse de generate-recu ne
  // porte ni l'id ni le montant ni la date du reçu, et un rechargement complet de la liste après
  // chaque reçu était lent sur une grosse organisation.
  // Une réponse arrivée après un changement d'année ou d'organisation est ignorée.
  const rafraichirLigne = useCallback(async (profilId: string) => {
    const cle = `${organisationId}|${annee}`
    const { data, error: err } = await supabase
      .from('recus_fiscaux')
      .select('*')
      .eq('organisation_id', organisationId)
      .eq('profil_participant_id', profilId)
      .eq('annee', annee)
      .maybeSingle()
    if (!estCleCourante(cle)) return
    if (err) {
      fetchData()
      return
    }
    const recu = (data as RecuFiscal | null) ?? null
    setRows((prev) => prev.map((r) => (r.profil.id === profilId ? { ...r, recu } : r)))
  }, [organisationId, annee, fetchData, estCleCourante])


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

  async function openSignedRecu(path: string): Promise<boolean> {
    const { data, error: urlErr } = await supabase.storage
      .from('recus-fiscaux')
      .createSignedUrl(path, 3600)
    if (urlErr || !data?.signedUrl) return false
    window.open(data.signedUrl, '_blank')
    return true
  }

  async function downloadRecu(row: ParticipantRow) {
    if (!row.recu?.fichier_url) return
    const id = row.profil.id
    setDlLoading((prev) => ({ ...prev, [id]: true }))
    setDlError((prev) => ({ ...prev, [id]: '' }))

    const ok = await openSignedRecu(row.recu.fichier_url)
    if (!ok) setDlError((prev) => ({ ...prev, [id]: 'Impossible de générer le lien' }))
    setDlLoading((prev) => ({ ...prev, [id]: false }))
  }

  async function downloadVersion(row: ParticipantRow, version: RecuFiscalVersion) {
    const id = row.profil.id
    setVersionDlLoading((prev) => ({ ...prev, [version.id]: true }))
    setDlError((prev) => ({ ...prev, [id]: '' }))

    const ok = await openSignedRecu(version.fichier_url)
    if (!ok) setDlError((prev) => ({ ...prev, [id]: `Impossible de générer le lien de la version ${version.version}` }))
    setVersionDlLoading((prev) => ({ ...prev, [version.id]: false }))
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
      body: JSON.stringify({ profil_participant_id: id, annee, organisation_id: organisationId }),
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
  // Générer les reçus manquants : seulement les reçus pas encore générés (une
  // régénération crée une nouvelle version conservée, elle passe par « Régénérer »)
  // ---------------------------------------------------------------------------

  const manquants = useMemo(() => recusAGenerer(rows, orgMissing.length > 0), [rows, orgMissing])

  const exclus = useMemo(
    () => recusExclus(rows, orgMissing.length > 0).map((r) => ({
      id: r.profil.id,
      nom: participantFullName(r.profil),
      raison: raisonExclusion(r.validation),
    })),
    [rows, orgMissing]
  )

  const recusLot = useRecusLot(organisationId, annee, 'generation', fetchData)
  const lot = recusLot.lot
  const lotEnCours = lot?.statut === 'en_cours'
  const afficherLot = !!lot && (lotEnCours || !(bilansFermes[lot.id] ?? bilanDejaFerme(lot.id)))

  function ouvrirRecapitulatif() {
    setRecapError(null)
    setRecapOpen(true)
  }

  async function lancerLot() {
    setRecapError(null)
    const res = await recusLot.lancer()
    if (!res.ok) {
      setRecapError(res.message)
      // Liste périmée (reçus générés entre-temps) : relue pour un récapitulatif exact.
      fetchData()
      return
    }
    setRecapOpen(false)
    showToast(messageLancementLot('generation', res.nbTotal))
  }

  async function arreterLot() {
    const res = await recusLot.arreter()
    if (!res.ok) showToast(res.message)
  }

  function fermerBilan(lotId: string) {
    try {
      window.localStorage.setItem(cleBilanFerme(lotId), '1')
    } catch {
      // Stockage indisponible (navigation privée) : fermé pour cette visite seulement.
    }
    setBilansFermes((prev) => ({ ...prev, [lotId]: true }))
  }

  // ---------------------------------------------------------------------------
  // Envoyer les reçus non envoyés : lot d'envoi côté serveur, étalé selon le rythme de l'organisation
  // ---------------------------------------------------------------------------

  const recusEnvoi = useRecusLot(organisationId, annee, 'envoi', fetchData)
  const lotEnvoi = recusEnvoi.lot
  const lotEnvoiEnCours = lotEnvoi?.statut === 'en_cours'
  const afficherLotEnvoi = !!lotEnvoi && (lotEnvoiEnCours || !(bilansFermes[lotEnvoi.id] ?? bilanDejaFerme(lotEnvoi.id)))
  const nbAEnvoyer = recapEnvoi?.a_envoyer ?? 0
  const rythmeEnvoiOrg = recapEnvoi ? { parJour: recapEnvoi.par_jour, parMinute: recapEnvoi.par_minute } : undefined
  // Envoi en lot réservé à Brevo (décision utilisateur 2026-11-04) ; l'envoi unitaire reste possible.
  const brevoLot = recapEnvoi ? recapEnvoi.brevo_configure : null

  const chargerRecapEnvoi = useCallback(async () => {
    if (!organisationId) return
    setRecapEnvoiLoading(true)
    const { data, error: err } = await supabase.rpc('recapitulatif_envoi_lot_recus', {
      p_organisation_id: organisationId,
      p_annee: annee,
    })
    setRecapEnvoiLoading(false)
    if (err) {
      setRecapEnvoi(null)
      setRecapEnvoiError(messageErreurLot(err.message))
      return
    }
    setRecapEnvoi(data as RecapitulatifEnvoi)
  }, [organisationId, annee])

  // Relu avec la liste (génération, envoi unitaire, fin de lot) : nombre de reçus à envoyer du bouton.
  useEffect(() => {
    if (loading) return
    void chargerRecapEnvoi()
  }, [rows, loading, chargerRecapEnvoi])

  // Pendant un envoi en lot : relu à chaque avancée, pour que l'estimation de fin retranche les envois
  // des dernières 24 h (quota du jour déjà entamé).
  const traitesEnvoi = lotEnvoi && lotEnvoiEnCours ? lotTraites(lotEnvoi) : null
  useEffect(() => {
    if (traitesEnvoi === null) return
    void chargerRecapEnvoi()
  }, [traitesEnvoi, chargerRecapEnvoi])


  function ouvrirRecapEnvoi() {
    setRecapEnvoiError(null)
    setRecapEnvoiOpen(true)
    void chargerRecapEnvoi()
  }

  async function lancerEnvoi() {
    setRecapEnvoiError(null)
    const res = await recusEnvoi.lancer()
    if (!res.ok) {
      setRecapEnvoiError(res.message)
      void chargerRecapEnvoi()
      return
    }
    setRecapEnvoiOpen(false)
    showToast(messageLancementLot('envoi', res.nbTotal))
    void chargerRecapEnvoi()
  }

  async function arreterEnvoi() {
    const res = await recusEnvoi.arreter()
    if (!res.ok) showToast(res.message)
  }

  const envoiDesactive = recusEnvoi.actif || recusEnvoi.loading || recusLot.actif || !recapEnvoi || nbAEnvoyer === 0 || brevoLot === false
  // Raison d'un envoi en lot impossible : infobulle du bouton (à partir de md), ligne sous l'élément du menu « ⋯ ».
  const raisonEnvoiDesactive = !envoiDesactive
    ? undefined
    : lotEnvoiEnCours
      ? `Un envoi des reçus ${annee} est déjà en cours`
      : brevoLot === false
        ? 'Configurez Brevo dans Paramètres › Intégrations pour envoyer les reçus en lot'
        : recusLot.actif
          ? 'Une génération en lot est en cours : attendez sa fin pour envoyer les reçus'
          : recapEnvoi && nbAEnvoyer === 0
            ? 'Aucun reçu à envoyer (reçus déjà envoyés, ou donateurs sans email valide)'
            : undefined
  const libelleEnvoi = lotEnvoiEnCours
    ? 'Envoi en cours…'
    : !recapEnvoi || nbAEnvoyer === 0
      ? 'Envoyer les reçus non envoyés'
      : `Envoyer ${nbAEnvoyer === 1 ? 'le reçu non envoyé' : `les ${nbAEnvoyer} reçus non envoyés`}`

  const exclusEnvoi = useMemo(
    () => (recapEnvoi?.exclus ?? []).map((e) => ({
      id: e.profil_participant_id,
      nom: [e.prenom, e.nom].filter(Boolean).join(' '),
      raison: e.raison,
    })),
    [recapEnvoi]
  )

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
  // Récapitulatif 222 bis (toutes années) : rechargé quand la liste de l'année change.
  const recapitulatif = useRecapitulatif222Bis(organisationId, rows)
  const selectedRow = rows.find((r) => r.profil.id === selectedId) ?? null

  // Versions rechargées à l'ouverture du panneau et après chaque génération / envoi (la fiche du
  // reçu change alors de date de génération ou d'envoi).
  const selectedRecuId = selectedRow?.recu?.id ?? null
  const selectedRecuStamp = selectedRow?.recu ? `${selectedRow.recu.date_generation}|${selectedRow.recu.email_envoye_at ?? ''}` : null
  useEffect(() => {
    if (!selectedRecuId) {
      versionsRecuIdRef.current = null
      setVersions([])
      setVersionsError(null)
      return
    }
    let cancelled = false
    // Autre reçu : l'historique du précédent n'est ni affiché ni téléchargeable pendant le chargement.
    // Même reçu (rechargement après génération / envoi) : la liste reste affichée jusqu'à la réponse.
    if (versionsRecuIdRef.current !== selectedRecuId) setVersions([])
    versionsRecuIdRef.current = selectedRecuId
    setVersionsLoading(true)
    setVersionsError(null)
    supabase
      .from('recus_fiscaux_versions')
      .select('id, recu_id, version, fichier_url, montant_total, genere_le, email_envoye_le')
      .eq('recu_id', selectedRecuId)
      .order('version', { ascending: false })
      .then(({ data, error: err }) => {
        if (cancelled) return
        if (err) {
          setVersionsError("Impossible de charger l'historique des versions")
          setVersions([])
        } else {
          setVersions((data ?? []) as RecuFiscalVersion[])
        }
        setVersionsLoading(false)
      })
    return () => { cancelled = true }
  }, [selectedRecuId, selectedRecuStamp])
  // Colonnes du tableau selon la place (rien hors écran de 768 à 1 440 px, panneau ouvert ou non) :
  // les pastilles (statut, envoi) ont leurs colonnes à partir de 1 280 px sans panneau ; en dessous,
  // ou panneau ouvert (liste réduite à ~370 px à 1 024 px), elles passent sous le nom du donateur.
  // Les colonnes secondaires (n° de reçu, total : repris dans le panneau) cèdent la place d'abord.
  const pastillesCol = selectedRow ? 'hidden' : 'hidden xl:table-cell'
  const pastillesSousNom = selectedRow ? '' : 'xl:hidden'
  const numeroCol = selectedRow ? 'hidden' : 'hidden md:table-cell xl:hidden min-[1400px]:table-cell'
  const totalCol = selectedRow ? 'hidden xl:table-cell' : ''

  // ---------------------------------------------------------------------------
  // Recherche
  // ---------------------------------------------------------------------------

  // ?q=<nom> pré-remplit la recherche.
  const [search, setSearch] = useState(() => searchParams.get('q') ?? '')

  // Filtres du tiroir (génération, envoi) : appliqués + brouillon en cours d'édition.
  const [filtres, setFiltres] = useState<RecusFiltres>(RECUS_FILTRES_VIDES)
  const [brouillon, setBrouillon] = useState<RecusFiltres>(RECUS_FILTRES_VIDES)
  const [filtresOpen, setFiltresOpen] = useState(false)
  const nombreFiltres = nombreFiltresRecus(filtres)

  function appliquerFiltres(next: RecusFiltres) {
    setFiltres(next)
    setCurrentPage(1)
  }

  function openFiltres() {
    setBrouillon(filtres)
    setFiltresOpen(true)
  }

  const chips: FilterChip[] = []
  if (filtres.generation) {
    chips.push({
      key: 'generation', label: 'Reçu', value: GENERATION_OPTIONS.find((o) => o.value === filtres.generation)?.label ?? '',
      onRemove: () => appliquerFiltres({ ...filtres, generation: '' }),
    })
  }
  if (filtres.envoi) {
    chips.push({
      key: 'envoi', label: 'Envoi', value: ENVOI_OPTIONS.find((o) => o.value === filtres.envoi)?.label ?? '',
      onRemove: () => appliquerFiltres({ ...filtres, envoi: '' }),
    })
  }

  const filteredRows = useMemo(
    () => filtrerRecus(rows.filter((r) => matchesParticipantSearch(r.profil, search)), filtres),
    [rows, search, filtres]
  )

  // ---------------------------------------------------------------------------
  // Tri (navigateur, sur toute la liste filtrée, avant pagination)
  // ---------------------------------------------------------------------------

  const { sortField, sortDirection, sort, toggleSort } = useTableSort<RecuSortField>({
    initial: { field: 'donateur', direction: 'asc' },
    initialDirection: (field) => directionInitiale(RECU_SORT_COLUMNS[field].type),
    onSortChange: () => setCurrentPage(1),
  })

  const sortedRows = useMemo(
    () => sortRows(filteredRows, RECU_SORT_COLUMNS, sort, (a, b) =>
      compareText(a.profil.personnes.nom, b.profil.personnes.nom) ||
      compareText(a.profil.personnes.prenom, b.profil.personnes.prenom) ||
      a.profil.id.localeCompare(b.profil.id)
    ),
    [filteredRows, sort]
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
    return sortedRows.slice(start, start + pageSize)
  }, [sortedRows, safePage, pageSize])

  // Sous 768 px : cartes par défaut, ou tableau au choix (mémorisé sur l'appareil).
  const { mode, selecteur } = useModeListe('recus-fiscaux')

  // Statut du reçu (pastilles) : généré ou non, blocage de validation, erreur d'une action.
  const statutRecu = (row: ParticipantRow) => {
    const resume = resumeValidationParticipant(row.validation)
    const profilId = row.profil.id
    return (
      <>
        {/* Un reçu bloqué n'est pas généré : la pastille d'avertissement suffit. */}
        {(row.recu || !resume) && (
          <Badge variant={row.recu ? 'success' : 'neutral'}>{row.recu ? 'Généré' : 'Non généré'}</Badge>
        )}
        {resume && <Badge variant="warning">{resume}</Badge>}
        {(genError[profilId] || dlError[profilId] || sendError[profilId]) && <Badge variant="stamp">Erreur</Badge>}
      </>
    )
  }

  // Envoi par email de la version actuelle (même règle que le panneau et le lot d'envoi, lib/recusFiltres) ;
  // rien pour un donateur sans reçu.
  const pastilleEnvoi = (row: ParticipantRow) => {
    const statut = statutEnvoi(row.recu, row.profil.personnes.email)
    if (!statut || !row.recu) return null
    if (statut === 'envoye') return <Badge variant="success">Envoyé le {formatJourMois(envoiVersionActuelle(row.recu)!)}</Badge>
    return <Badge variant="neutral">{statut === 'sans_email' ? 'Sans email' : 'Non envoyé'}</Badge>
  }

  // Colonnes du tableau et place de chacune dans une carte : donateur et total en première
  // ligne, n° de reçu et email dessous, statut en pastilles (tout l'essentiel sans ouvrir la fiche).
  const colonnes: ColonneListe<ParticipantRow, RecuSortField>[] = [
    {
      key: 'donateur', label: 'Donateur', sortField: 'donateur', role: 'titre',
      cellClassName: 'whitespace-nowrap',
      cell: (row) => (
        <>
          <span className="font-medium text-ink">{participantFullName(row.profil)}</span>
          {row.profil.personnes.email && <div className={cn('text-xs text-ink-faint', selectedRow && 'hidden 2xl:block')}>{row.profil.personnes.email}</div>}
          {row.profil.email_invalide_at && (
            <div className="mt-1"><EmailInvalideIndicateur invalideLe={row.profil.email_invalide_at} /></div>
          )}
          <div className={cn('mt-1 flex flex-wrap items-center gap-1.5', pastillesSousNom)}>
            {statutRecu(row)}
            {pastilleEnvoi(row)}
          </div>
        </>
      ),
      carte: (row) => participantFullName(row.profil),
    },
    {
      key: 'total', label: 'Total dons', sortField: 'total', role: 'montant', align: 'right',
      headClassName: totalCol, cellClassName: cn(totalCol, 'whitespace-nowrap font-registre-mono font-medium text-ink'),
      cell: (row) => formatMontant(row.total_dons),
    },
    {
      key: 'numero', label: 'N° reçu', sortField: 'numero', role: 'secondaire',
      headClassName: numeroCol, cellClassName: cn(numeroCol, 'whitespace-nowrap font-registre-mono text-ink-muted'),
      cell: (row) => row.recu?.numero_ordre ?? '—',
      carte: (row) => row.recu?.numero_ordre && <span className="font-registre-mono">N° {row.recu.numero_ordre}</span>,
    },
    {
      // Réservée aux cartes : dans le tableau, l'email vit sous le nom du donateur.
      key: 'email', label: 'Email', role: 'secondaire',
      headClassName: 'hidden', cellClassName: 'hidden',
      cell: () => null,
      carte: (row) => row.profil.personnes.email,
    },
    {
      key: 'statut', label: 'Statut', role: 'pastille',
      headClassName: pastillesCol, cellClassName: pastillesCol,
      cell: (row) => <div className="flex items-center gap-1.5">{statutRecu(row)}</div>,
      carte: (row) => (
        <>
          {statutRecu(row)}
          <EmailInvalideIndicateur invalideLe={row.profil.email_invalide_at} />
        </>
      ),
    },
    {
      key: 'envoi', label: 'Envoi', role: 'pastille',
      headClassName: pastillesCol, cellClassName: cn(pastillesCol, 'whitespace-nowrap'),
      cell: (row) => pastilleEnvoi(row) ?? <span className="text-ink-faint">—</span>,
      carte: (row) => pastilleEnvoi(row),
    },
  ]

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div className="-m-6 min-h-[calc(100%+3rem)] space-y-6 bg-paper px-4 py-6 font-registre md:px-6">
      <PageHeader
        title="Reçus fiscaux"
        subtitle={
          <>
            {rows.length} donateur{rows.length !== 1 ? 's' : ''} avec des dons en {annee}
            {totalGeneres > 0 && ` · ${totalGeneres} reçu${totalGeneres !== 1 ? 's' : ''} généré${totalGeneres !== 1 ? 's' : ''}`}
            {nombreFiltres > 0 && ` · ${filteredRows.length} affiché${filteredRows.length !== 1 ? 's' : ''}`}
          </>
        }
        actions={
          <>
            <Select
              aria-label="Année"
              value={annee}
              onChange={(e) => { setAnnee(Number(e.target.value)); setCurrentPage(1); setSelectedId(null) }}
            >
              {yearOptions().map((y) => (
                <option key={y} value={y}>{y}</option>
              ))}
            </Select>
            {/* Sous `md` : l'envoi passe dans le menu « ⋯ » (même modèle que Dons, Donateurs, Adhérents). */}
            {rows.length > 0 && (
              <ActionMenu
                iconOnly
                label="Autres actions"
                className="md:hidden"
                items={[{
                  label: libelleEnvoi,
                  onSelect: ouvrirRecapEnvoi,
                  disabled: envoiDesactive,
                  // « Envoi en cours… » se suffit à lui-même.
                  disabledReason: lotEnvoiEnCours ? undefined : raisonEnvoiDesactive,
                }]}
              />
            )}
            {rows.length > 0 && (
              <ButtonHint hint={raisonEnvoiDesactive} className="hidden md:inline-block">
              <Button
                variant="secondary"
                className="hidden md:inline-flex"
                onClick={ouvrirRecapEnvoi}
                disabled={envoiDesactive}
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
                </svg>
                {libelleEnvoi}
              </Button>
              </ButtonHint>
            )}
            {rows.length > 0 && (
              <ButtonHint
                align="right"
                hint={
                  !(recusLot.actif || recusLot.loading || manquants.length === 0)
                    ? undefined
                    : lotEnCours
                      ? `Une génération des reçus ${annee} est déjà en cours`
                      : orgMissing.length > 0
                        ? "Complétez les paramètres de l'organisation pour générer des reçus"
                        : manquants.length === 0
                          ? 'Aucun reçu manquant prêt à générer (un reçu existant se régénère depuis son détail)'
                          : undefined
                }
              >
              <Button
                onClick={ouvrirRecapitulatif}
                disabled={recusLot.actif || recusLot.loading || manquants.length === 0}
              >
                {lotEnCours ? (
                  <svg className="h-4 w-4 animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                </svg>
                ) : (
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                  </svg>
                )}
                {/* Sous `md`, libellé court : année, menu ⋯ et action principale tiennent sur une ligne. */}
                <span className="hidden md:inline">
                  {lotEnCours
                    ? 'Génération en cours…'
                    : orgMissing.length > 0
                    ? 'Générer les reçus manquants'
                    : manquants.length === 0
                      ? 'Aucun reçu à générer'
                      : `Générer ${manquants.length === 1 ? 'le reçu manquant' : `les ${manquants.length} reçus manquants`}`}
                </span>
                <span className="md:hidden">
                  {lotEnCours
                    ? 'En cours…'
                    : orgMissing.length > 0
                      ? 'Générer'
                      : manquants.length === 0
                        ? 'Rien à générer'
                        : `Générer ${manquants.length} reçu${manquants.length > 1 ? 's' : ''}`}
                </span>
              </Button>
              </ButtonHint>
            )}
          </>
        }
      />

      {/* Bannière organisation incomplète */}
      {orgFiscal && orgMissing.length > 0 && (
        <div className="rounded-sm border border-warning-border bg-warning-tint px-4 py-3 text-sm text-warning">
          <p>
            <span className="font-medium">Complétez les paramètres de votre organisation</span> pour pouvoir générer des reçus fiscaux
            {' '}— champs manquants : {orgMissing.join(', ')}.
          </p>
          <p className="mt-1 flex flex-wrap gap-x-4 gap-y-1">
            {pagesParametresACompleter(orgMissing).map((page) => (
              <Link key={page.to} to={page.to} className="font-medium underline hover:no-underline">
                Compléter dans {page.label}
              </Link>
            ))}
          </p>
        </div>
      )}

      {/* Envoi en lot réservé à Brevo : bouton désactivé, raison visible (le title ne s'affiche pas au toucher) */}
      {rows.length > 0 && brevoLot === false && !lotEnvoiEnCours && (
        <StatusNotice tone="warning">
          <Link to="/admin/parametres/integrations" className="font-medium underline underline-offset-2 hover:no-underline">
            Configurez Brevo dans Paramètres › Intégrations
          </Link>{' '}
          pour envoyer les reçus en lot. Sans Brevo, chaque reçu s'envoie depuis son détail.
        </StatusNotice>
      )}

      {/* Lot de génération : progression, puis bilan */}
      {afficherLot && lot && (
        <RecusLotBandeau
          lot={lot}
          echecs={recusLot.echecs}
          erreurEchecs={recusLot.erreurEchecs}
          nbRestants={manquants.length}
          arretEnCours={recusLot.actif && !lotEnCours}
          actionEnCours={recusLot.actionEnCours}
          onArreter={arreterLot}
          onRelancer={ouvrirRecapitulatif}
          onFermer={() => fermerBilan(lot.id)}
          maintenant={recusLot.luLe}
        />
      )}
      {/* Lot d'envoi : progression (rythme, quota), puis bilan */}
      {afficherLotEnvoi && lotEnvoi && (
        <RecusLotBandeau
          lot={lotEnvoi}
          echecs={recusEnvoi.echecs}
          erreurEchecs={recusEnvoi.erreurEchecs}
          nbRestants={nbAEnvoyer}
          arretEnCours={recusEnvoi.actif && !lotEnvoiEnCours}
          actionEnCours={recusEnvoi.actionEnCours}
          onArreter={arreterEnvoi}
          onRelancer={ouvrirRecapEnvoi}
          onFermer={() => fermerBilan(lotEnvoi.id)}
          maintenant={recusEnvoi.luLe}
          rythme={rythmeEnvoiOrg}
          envoyes24h={recapEnvoi?.envoyes_24h ?? 0}
          nbDejaEnvoyes={recusEnvoi.nbDejaEnvoyes}
        />
      )}
      {recusEnvoi.error && (
        <div className="rounded-sm border border-stamp/30 bg-stamp/[0.04] px-4 py-3 text-sm text-stamp">{recusEnvoi.error}</div>
      )}
      {recusLot.error && (
        <div className="rounded-sm border border-stamp/30 bg-stamp/[0.04] px-4 py-3 text-sm text-stamp">{recusLot.error}</div>
      )}

      {/* Error banner */}
      {error && (
        <div className="rounded-sm border border-stamp/30 bg-stamp/[0.04] px-4 py-3 text-sm text-stamp">{error}</div>
      )}

      {/* Liste + panneau de détail */}
      <div className={cn('flex gap-6', selectedRow && 'items-start')}>
      <ListeConteneur>
        {!loading && rows.length > 0 && (
          <ListToolbar
            search={{ value: search, onChange: (v) => { setSearch(v); setCurrentPage(1) }, placeholder: 'Nom, prénom…', label: 'Rechercher un donateur' }}
            filterCount={nombreFiltres}
            onOpenFilters={openFiltres}
            mode={selecteur}
          />
        )}
        {!loading && rows.length > 0 && (
          <FilterChips chips={chips} onClearAll={() => appliquerFiltres(RECUS_FILTRES_VIDES)} />
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
            <p className="font-registre text-sm font-medium text-ink-faint">
              {nombreFiltres > 0 ? 'Aucun donateur ne correspond à la recherche et aux filtres' : 'Aucun résultat pour votre recherche'}
            </p>
          </div>
        ) : (
          <ListeDonnees
            rows={paginatedRows}
            rowKey={(row) => row.profil.id}
            columns={colonnes}
            mode={mode}
            sort={{ field: sortField, direction: sortDirection, onSort: toggleSort }}
            onRowClick={(row) => setSelectedId(row.profil.id === selectedId ? null : row.profil.id)}
            activeKey={selectedId}
            rowLabel={(row) => participantFullName(row.profil)}
            chevronClassName={selectedRow ? 'hidden xl:table-cell' : 'hidden md:table-cell'}
          />
        )}

        {/* Pagination */}
        {!loading && filteredRows.length > 0 && (
          <TablePagination
            page={safePage}
            pageCount={pageCount}
            totalCount={filteredRows.length}
            pageSize={pageSize}
            onPageChange={setCurrentPage}
            onPageSizeChange={setPageSize}
          />
        )}
      </ListeConteneur>

      <SidePanel
        open={!!selectedRow}
        onClose={() => setSelectedId(null)}
        title="Reçu fiscal"
        footer={selectedRow && (() => {
          const id = selectedRow.profil.id
          const isBlocked = orgMissing.length > 0 || selectedRow.validation.blocking || selectedRow.validation.missing.length > 0
          const blockedTitle = isBlocked ? (orgMissing.length > 0 ? "Complétez les paramètres de l'organisation" : selectedRow.validation.message ?? 'Fiche du donateur incomplète') : undefined
          if (!selectedRow.recu) {
            // Pendant un lot, un nouveau reçu généré à la main prendrait un numéro hors de l'ordre du lot.
            return (
              <ButtonHint
                className="block w-full"
                triggerClassName="block"
                hint={recusLot.actif ? 'Une génération en lot est en cours : attendez sa fin pour générer ce reçu' : blockedTitle}
              >
                <Button
                  className="w-full"
                  onClick={() => generateRecu(selectedRow)}
                  disabled={genLoading[id] || recusLot.actif || isBlocked}
                >
                  {genLoading[id] ? 'Génération…' : 'Générer le reçu'}
                </Button>
              </ButtonHint>
            )
          }
          return (
            <>
              {/* Boutons empilés pleine largeur : côte à côte, ils débordaient du panneau (w-80). */}
              <Button className="w-full" onClick={() => downloadRecu(selectedRow)} disabled={dlLoading[id]}>
                {dlLoading[id] ? 'Ouverture…' : 'Télécharger le PDF'}
              </Button>
              {selectedRow.profil.personnes.email && (
                <Button variant="secondary" className="w-full" onClick={() => sendRecuEmail(selectedRow)} disabled={sendLoading[id]}>
                  {sendLoading[id] ? 'Envoi…' : 'Envoyer par email'}
                </Button>
              )}
              <ButtonHint className="block w-full" triggerClassName="block" hint={blockedTitle}>
                <Button
                  variant="secondary"
                  className="w-full"
                  onClick={() => handleGenerateClick(selectedRow)}
                  disabled={genLoading[id] || isBlocked}
                >
                  {genLoading[id] ? 'Génération…' : 'Régénérer'}
                </Button>
              </ButtonHint>
            </>
          )
        })()}
      >
        {selectedRow && (() => {
          const id = selectedRow.profil.id
          const validationMessage = selectedRow.validation.message
            ?? (selectedRow.validation.missing.length > 0 ? `Champs manquants : ${selectedRow.validation.missing.join(', ')}.` : null)
          const errors = [genError[id], dlError[id], sendError[id]].filter(Boolean)
          return (
            <>
              <DetailField label="Donateur">
                <p className="font-semibold">{participantFullName(selectedRow.profil)}</p>
                {selectedRow.profil.personnes.email && <p className="text-ink-muted">{selectedRow.profil.personnes.email}</p>}
                {selectedRow.profil.email_invalide_at && (
                  <div className="mt-1">
                    <EmailInvalideIndicateur
                      variante="detail"
                      invalideLe={selectedRow.profil.email_invalide_at}
                      evenement={selectedRow.profil.email_invalide_evenement}
                      raison={selectedRow.profil.email_invalide_raison}
                    />
                  </div>
                )}
              </DetailField>
              <div className="grid grid-cols-2 gap-4">
                <DetailField label={`Total ${annee}`}>
                  <p className="font-registre-mono text-xl font-bold">{formatMontant(selectedRow.total_dons)}</p>
                </DetailField>
                <DetailField label="Statut">
                  {/* Mêmes pastilles que la liste : génération, avertissement de fiche, erreur, envoi. */}
                  <div className="flex flex-wrap items-center gap-1.5">
                    {statutRecu(selectedRow)}
                    {pastilleEnvoi(selectedRow)}
                  </div>
                </DetailField>
              </div>
              {selectedRow.recu && (
                <div className="grid grid-cols-2 gap-4">
                  <DetailField label="N° de reçu"><span className="font-registre-mono">{selectedRow.recu.numero_ordre ?? '—'}</span></DetailField>
                  <DetailField label="Type">
                    {selectedRow.recu.type_cerfa ? TYPE_CERFA_LABELS[selectedRow.recu.type_cerfa] ?? selectedRow.recu.type_cerfa : '—'}
                  </DetailField>
                </div>
              )}
              {selectedRow.recu && (
                <DetailField label="Envoi par email">
                  {envoiVersionActuelle(selectedRow.recu)
                    ? `Envoyé le ${formatDateHeure(selectedRow.recu.email_envoye_at!)}`
                    : selectedRow.recu.email_envoye_at
                      ? `Version actuelle pas encore envoyée (version précédente envoyée le ${formatDateHeure(selectedRow.recu.email_envoye_at)})`
                      : 'Pas encore envoyé'}
                </DetailField>
              )}
              {selectedRow.recu && (
                <DetailField label="Historique des versions">
                  {versionsLoading && versions.length === 0 ? (
                    <p className="text-ink-muted">Chargement…</p>
                  ) : versionsError ? (
                    <p className="text-stamp">{versionsError}</p>
                  ) : versions.length === 0 ? (
                    <p className="text-ink-muted">Aucune version enregistrée.</p>
                  ) : (
                    <ul className="divide-y divide-paper-border rounded-sm border border-paper-border">
                      {versions.map((v, index) => (
                        <li key={v.id} className={cn('flex items-start justify-between gap-3 px-3 py-2.5', index === 0 && 'bg-paper')}>
                          <div className="min-w-0">
                            <p className="flex flex-wrap items-center gap-x-2 gap-y-1">
                              <span className="font-semibold">Version {v.version}</span>
                              {index === 0 && <Badge variant="success">Actuelle</Badge>}
                            </p>
                            <p className="mt-0.5 flex flex-wrap gap-x-3 font-registre-mono text-xs text-ink-muted">
                              <span className="whitespace-nowrap">{formatDateEtHeure(v.genere_le)}</span>
                              <span className="whitespace-nowrap">{formatMontant(Number(v.montant_total))}</span>
                            </p>
                            <p className="mt-0.5 text-xs text-ink-muted">
                              {v.email_envoye_le ? `Envoyée le ${formatDateEtHeure(v.email_envoye_le)}` : 'Non envoyée'}
                            </p>
                          </div>
                          <Button
                            variant="secondary"
                            size="sm"
                            className="shrink-0"
                            onClick={() => downloadVersion(selectedRow, v)}
                            disabled={versionDlLoading[v.id]}
                            aria-label={`Télécharger la version ${v.version}`}
                          >
                            {versionDlLoading[v.id] ? 'Ouverture…' : 'Télécharger'}
                          </Button>
                        </li>
                      ))}
                    </ul>
                  )}
                </DetailField>
              )}
              {validationMessage && (
                <div className="rounded-sm border border-warning-border bg-warning-tint px-3 py-2.5 text-sm text-warning">
                  <p>{validationMessage}</p>
                  <button
                    type="button"
                    onClick={() => openEditParticipant(selectedRow)}
                    className="mt-1 rounded-sm font-medium underline hover:no-underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stamp/70"
                  >
                    Compléter la fiche du donateur
                  </button>
                </div>
              )}
              {errors.map((err) => (
                <p key={err} className="rounded-sm border border-stamp/30 bg-stamp/[0.04] px-3 py-2 text-sm text-stamp">{err}</p>
              ))}
            </>
          )
        })()}
      </SidePanel>
      </div>

      <DeclarationCerfaCard rows={recapitulatif.rows} loading={recapitulatif.loading} />

      <FilterSheet
        open={filtresOpen}
        onOpenChange={setFiltresOpen}
        description={`Donateurs avec des dons en ${annee}.`}
        onReset={() => setBrouillon(RECUS_FILTRES_VIDES)}
        onApply={() => { appliquerFiltres(brouillon); setFiltresOpen(false) }}
      >
        <ChoixFiltre
          legend="Reçu"
          aide="À compléter : pas encore de reçu, fiche du donateur incomplète."
          options={GENERATION_OPTIONS}
          value={brouillon.generation}
          onChange={(generation) => setBrouillon((b) => ({ ...b, generation }))}
        />
        <ChoixFiltre
          legend="Envoi par email"
          aide="Version actuelle des reçus générés : un reçu régénéré depuis son envoi redevient « Non envoyé ». Sans email : le donateur n'a pas d'adresse."
          options={ENVOI_OPTIONS}
          value={brouillon.envoi}
          onChange={(envoi) => setBrouillon((b) => ({ ...b, envoi }))}
        />
      </FilterSheet>

      <RecusLotRecapitulatifDialog
        open={recapOpen}
        onClose={() => setRecapOpen(false)}
        onConfirm={lancerLot}
        annee={annee}
        nbAGenerer={manquants.length}
        exclus={exclus}
        lancement={recusLot.actionEnCours}
        error={recapError}
      />

      <RecusLotRecapitulatifDialog
        type="envoi"
        open={recapEnvoiOpen}
        onClose={() => setRecapEnvoiOpen(false)}
        onConfirm={lancerEnvoi}
        annee={annee}
        nbAGenerer={nbAEnvoyer}
        exclus={exclusEnvoi}
        lancement={recusEnvoi.actionEnCours}
        error={recapEnvoiError}
        rythme={rythmeEnvoiOrg}
        envoyes24h={recapEnvoi?.envoyes_24h ?? 0}
        brevoConfigure={brevoLot}
        chargement={recapEnvoiLoading && !recapEnvoi}
      />

      {/* Regenerate confirmation */}
      <Dialog open={!!regenerateConfirm} onOpenChange={(next) => { if (!next) setRegenerateConfirm(null) }}>
        <DialogContent className="max-w-sm" aria-describedby={undefined}>
          {regenerateConfirm && (
            <div className="p-6">
              <h2 className="font-registre text-lg font-semibold text-ink">Régénérer le reçu</h2>
              <p className="mt-2 font-registre text-sm text-ink-muted">
                Un reçu a déjà été généré pour{' '}
                <span className="font-medium text-ink">« {participantFullName(regenerateConfirm.profil)} »</span> en {annee}
                {regenerateConfirm.recu?.numero_ordre && <> (n° {regenerateConfirm.recu.numero_ordre})</>}.
                Une nouvelle version du PDF sera créée avec le même numéro d'ordre ; la version précédente est conservée
                dans l'historique du reçu.
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
                  Régénérer
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
