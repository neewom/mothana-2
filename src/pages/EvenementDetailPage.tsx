import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import CreditManuelModal from '../components/CreditManuelModal'
import EvenementAfficheModal from '../components/EvenementAfficheModal'
import EvenementModal from '../components/EvenementModal'
import PortefeuilleDetailPanel from '../components/PortefeuilleDetailPanel'
import RenvoyerAccesPortefeuilleModal from '../components/RenvoyerAccesPortefeuilleModal'
import ScrollShadowX from '../components/ScrollShadowX'
import Toast from '../components/Toast'
import { Badge } from '../components/ui/badge'
import { Button } from '../components/ui/button'
import { Dialog, DialogContent, DialogTitle } from '../components/ui/dialog'
import { Input } from '../components/ui/input'
import { StatusNotice } from '../components/ui/status-notice'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table'
import { Tabs } from '../components/ui/tabs'
import { useAdminOutletContext } from '../hooks/useAdminOutletContext'
import { useOrganisationId } from '../hooks/useOrganisationId'
import { useToast } from '../hooks/useToast'
import {
  calculerStatsEvenement,
  emailAffiche,
  emailCommandeAffiche,
  filtrerPortefeuilles,
  libelleMoyenPaiement,
  libelleMouvementAdmin,
  libelleStatutCommande,
  resumerAccesParPortefeuille,
} from '../lib/evenementDashboard'
import { formatCentimes, formatPeriodeEvenement } from '../lib/portefeuilleAcheteur'
import { supabase } from '../lib/supabaseClient'
import { cn } from '../lib/utils'
import { PageHeader } from '../components/ui/page-header'
import { StatTiles } from '../components/ui/stat-tiles'
import type { Activite } from '../types'
import type { Evenement } from '../types/evenement'
import { useDeepLinkSelection } from '../hooks/useDeepLinkSelection'
import type {
  CommandeEvenement,
  EvenementDashboardData,
  MouvementPortefeuilleAdmin,
  PortefeuilleEvenement,
  SecretPortefeuilleAdmin,
} from '../types/evenementDashboard'

const PAGE_SIZE = 1000

type Onglet = 'portefeuilles' | 'mouvements' | 'commandes'

interface PageResult<T> {
  data: T[] | null
  error: { message: string } | null
}

async function fetchAllPages<T>(
  fetchPage: (from: number, to: number) => Promise<PageResult<T>>,
): Promise<T[]> {
  const rows: T[] = []

  for (let from = 0; ; from += PAGE_SIZE) {
    const result = await fetchPage(from, from + PAGE_SIZE - 1)
    if (result.error) throw new Error(result.error.message)
    const page = result.data ?? []
    rows.push(...page)
    if (page.length < PAGE_SIZE) return rows
  }
}

function formatDateTime(value: string): string {
  return new Intl.DateTimeFormat('fr-FR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value))
}

function LoadingState() {
  return (
    <div className="space-y-6" aria-label="Chargement du détail de l’événement" aria-busy="true">
      <div className="space-y-3">
        <div className="h-4 w-28 animate-pulse rounded-sm bg-paper-border" />
        <div className="h-8 w-64 max-w-full animate-pulse rounded-sm bg-paper-border" />
        <div className="h-4 w-48 animate-pulse rounded-sm bg-paper-border-muted" />
      </div>
      <div className="grid grid-cols-3 overflow-hidden rounded-sm border border-paper-border bg-white">
        {[0, 1, 2].map((item) => (
          <div key={item} className="space-y-3 border-l border-paper-border p-3 first:border-l-0 sm:p-5">
            <div className="h-3 w-16 animate-pulse rounded-sm bg-paper-border sm:w-24" />
            <div className="h-6 w-20 animate-pulse rounded-sm bg-paper-border-muted sm:w-32" />
          </div>
        ))}
      </div>
      <div className="h-64 animate-pulse rounded-sm border border-paper-border bg-white" />
    </div>
  )
}

function Chevron() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" className="inline h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
    </svg>
  )
}

export default function EvenementDetailPage() {
  const { id: evenementId } = useParams<{ id: string }>()
  const organisationId = useOrganisationId()
  const { fonctionnalitesActivees } = useAdminOutletContext()
  const { toast, showToast, dismissToast } = useToast()
  const [data, setData] = useState<EvenementDashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [revokeError, setRevokeError] = useState<string | null>(null)
  const [onglet, setOnglet] = useState<Onglet>('portefeuilles')
  const [walletSearch, setWalletSearch] = useState('')
  const [selectedWalletId, setSelectedWalletId] = useState<string | null>(null)
  const [mobilePanelVisible, setMobilePanelVisible] = useState(false)
  const [freezingWalletId, setFreezingWalletId] = useState<string | null>(null)
  const [revokeTarget, setRevokeTarget] = useState<PortefeuilleEvenement | null>(null)
  const [revoking, setRevoking] = useState(false)
  const [anonymizeTarget, setAnonymizeTarget] = useState<PortefeuilleEvenement | null>(null)
  const [anonymizing, setAnonymizing] = useState(false)
  const [anonymizeError, setAnonymizeError] = useState<string | null>(null)
  const [resendTarget, setResendTarget] = useState<PortefeuilleEvenement | null>(null)
  const [editOpen, setEditOpen] = useState(false)
  const [afficheOpen, setAfficheOpen] = useState(false)
  const [creditOpen, setCreditOpen] = useState(false)
  // Rechargement différé à la fermeture : CreditManuelModal se réinitialise quand l'objet
  // événement change, ce qui effacerait son écran de résultat (code public).
  const creditedRef = useRef(false)

  const fetchData = useCallback(async (showLoading = true) => {
    if (!organisationId || !evenementId) return
    if (showLoading) setLoading(true)
    setError(null)
    setNotFound(false)

    try {
      const eventResult = await supabase
        .from('evenements')
        .select('id, organisation_id, activite_id, slug, nom, date_evenement, date_fin, statut, montants_credit_centimes, created_at, updated_at')
        .eq('id', evenementId)
        .eq('organisation_id', organisationId)
        .maybeSingle()

      if (eventResult.error) throw new Error(eventResult.error.message)
      if (!eventResult.data) {
        setData(null)
        setNotFound(true)
        return
      }

      const [portefeuilles, commandes, organisationResult, activitesResult, profilsResult] = await Promise.all([
        fetchAllPages<PortefeuilleEvenement>(async (from, to) => {
          const result = await supabase
            .from('portefeuilles')
            .select('id, organisation_id, evenement_id, email, code_public, solde_centimes, gele, email_modifie_le, email_modifie_par, anonymise_le, anonymise_par, created_at, updated_at')
            .eq('organisation_id', organisationId)
            .eq('evenement_id', evenementId)
            .order('email')
            .range(from, to)
          return { data: result.data as PortefeuilleEvenement[] | null, error: result.error }
        }),
        fetchAllPages<CommandeEvenement>(async (from, to) => {
          const result = await supabase
            .from('commandes')
            .select('id, organisation_id, evenement_id, email, montant_centimes, moyen_paiement, statut, payee_le, portefeuille_id, created_at')
            .eq('organisation_id', organisationId)
            .eq('evenement_id', evenementId)
            .order('created_at', { ascending: false })
            .range(from, to)
          return { data: result.data as CommandeEvenement[] | null, error: result.error }
        }),
        supabase.from('organisations').select('slug').eq('id', organisationId).single(),
        supabase.from('activites').select('id, nom, organisation_id, date_debut, date_fin').eq('organisation_id', organisationId),
        // Noms affichés des comptes de l'organisation (RLS scopée à l'organisation), pour
        // attribuer une correction d'adresse ou un lien généré — sans lire auth.users.
        supabase.from('profils_organisation').select('utilisateur_id, nom_affiche').eq('organisation_id', organisationId),
      ])

      if (organisationResult.error) throw new Error(organisationResult.error.message)
      if (activitesResult.error) throw new Error(activitesResult.error.message)
      if (profilsResult.error) throw new Error(profilsResult.error.message)

      const walletIds = portefeuilles.map((portefeuille) => portefeuille.id)
      const [mouvements, secrets] = walletIds.length === 0
        ? [[], []]
        : await Promise.all([
            fetchAllPages<MouvementPortefeuilleAdmin>(async (from, to) => {
              const result = await supabase
                .from('mouvements_portefeuille')
                .select('id, organisation_id, portefeuille_id, type, montant_centimes, solde_apres_centimes, commande_id, demande_paiement_id, acteur_id, created_at')
                .eq('organisation_id', organisationId)
                .in('portefeuille_id', walletIds)
                .order('created_at', { ascending: false })
                .range(from, to)
              return { data: result.data as MouvementPortefeuilleAdmin[] | null, error: result.error }
            }),
            fetchAllPages<SecretPortefeuilleAdmin>(async (from, to) => {
              const result = await supabase
                .from('secrets_portefeuille')
                .select('id, portefeuille_id, revoque_le, created_at, cree_par')
                .eq('organisation_id', organisationId)
                .in('portefeuille_id', walletIds)
                .order('created_at', { ascending: false })
                .range(from, to)
              return { data: result.data as SecretPortefeuilleAdmin[] | null, error: result.error }
            }),
          ])

      const profils = (profilsResult.data ?? []) as { utilisateur_id: string; nom_affiche: string | null }[]
      setData({
        evenement: eventResult.data as Evenement,
        portefeuilles,
        commandes,
        mouvements,
        secrets,
        organisationSlug: (organisationResult.data as { slug: string }).slug,
        auteurs: new Map(
          profils
            .filter((profil) => profil.nom_affiche?.trim())
            .map((profil) => [profil.utilisateur_id, profil.nom_affiche!.trim()]),
        ),
        activites: (activitesResult.data as unknown as Activite[]) ?? [],
      })
    } catch {
      setError('Les informations de cet événement n’ont pas pu être chargées.')
    } finally {
      if (showLoading) setLoading(false)
    }
  }, [evenementId, organisationId])

  useEffect(() => {
    void fetchData()
  }, [fetchData])

  const stats = useMemo(
    () => calculerStatsEvenement(data?.portefeuilles ?? [], data?.mouvements ?? []),
    [data],
  )
  const walletById = useMemo(
    () => new Map((data?.portefeuilles ?? []).map((portefeuille) => [portefeuille.id, portefeuille])),
    [data],
  )
  const accesParPortefeuille = useMemo(
    () => resumerAccesParPortefeuille(data?.secrets ?? []),
    [data],
  )
  const filteredWallets = useMemo(
    () => filtrerPortefeuilles(data?.portefeuilles ?? [], walletSearch),
    [data, walletSearch],
  )
  const remainingWallets = useMemo(
    () => (data?.portefeuilles ?? []).filter((portefeuille) => portefeuille.solde_centimes > 0),
    [data],
  )
  // Dérivé des données (et non stocké) pour refléter immédiatement un gel ou un renvoi.
  const selectedWallet = selectedWalletId ? walletById.get(selectedWalletId) ?? null : null

  // Lien profond depuis la recherche globale : ?portefeuille=<id> ouvre son panneau.
  const openWalletFromLink = useCallback((portefeuille: PortefeuilleEvenement) => {
    setOnglet('portefeuilles')
    setSelectedWalletId(portefeuille.id)
  }, [])
  useDeepLinkSelection(data?.portefeuilles ?? null, openWalletFromLink, 'portefeuille')
  const selectedMouvements = useMemo(
    () => (data?.mouvements ?? []).filter((mouvement) => mouvement.portefeuille_id === selectedWalletId),
    [data, selectedWalletId],
  )
  const selectedCommandes = useMemo(
    () => (data?.commandes ?? []).filter((commande) => commande.portefeuille_id === selectedWalletId),
    [data, selectedWalletId],
  )

  useEffect(() => {
    if (selectedWallet) {
      const timer = setTimeout(() => setMobilePanelVisible(true), 10)
      return () => clearTimeout(timer)
    }
    setMobilePanelVisible(false)
  }, [selectedWallet])

  // Panneau desktop — hauteur plafonnée à l'espace réellement disponible (même logique
  // que ParticipantsPage), le corps du panneau scrolle seul.
  const desktopPanelRef = useRef<HTMLDivElement>(null)
  const [desktopPanelMaxHeight, setDesktopPanelMaxHeight] = useState<number | undefined>(undefined)
  const panelOpen = selectedWallet !== null && onglet === 'portefeuilles'

  useLayoutEffect(() => {
    if (!panelOpen) return

    function recompute() {
      const el = desktopPanelRef.current
      if (!el) return
      const top = el.getBoundingClientRect().top
      if (top <= 0) return
      setDesktopPanelMaxHeight(Math.max(300, window.innerHeight - top - 24))
    }

    recompute()
    window.addEventListener('resize', recompute)
    return () => window.removeEventListener('resize', recompute)
  }, [panelOpen])

  const busy = freezingWalletId !== null || revoking || anonymizing || resendTarget !== null

  async function toggleFreeze(portefeuille: PortefeuilleEvenement) {
    setActionError(null)
    setFreezingWalletId(portefeuille.id)
    const nextFrozen = !portefeuille.gele
    const result = await supabase.rpc('geler_portefeuille', {
      p_portefeuille_id: portefeuille.id,
      p_gele: nextFrozen,
    })

    if (result.error) {
      setActionError(`Le portefeuille de ${emailAffiche(portefeuille)} n’a pas pu être ${nextFrozen ? 'gelé' : 'dégelé'}. Réessayez.`)
    } else {
      await fetchData(false)
      showToast(`Portefeuille ${nextFrozen ? 'gelé' : 'dégelé'}`)
    }
    setFreezingWalletId(null)
  }

  async function revokeSecrets() {
    if (!revokeTarget) return
    setRevokeError(null)
    setRevoking(true)
    const result = await supabase.rpc('revoquer_secrets_portefeuille', {
      p_portefeuille_id: revokeTarget.id,
    })

    if (result.error) {
      setRevokeError(`Les accès au portefeuille de ${revokeTarget.email} n’ont pas pu être révoqués. Réessayez.`)
    } else {
      await fetchData(false)
      showToast('Tous les accès au portefeuille ont été révoqués')
      setRevokeTarget(null)
    }
    setRevoking(false)
  }

  async function anonymize() {
    if (!anonymizeTarget) return
    setAnonymizeError(null)
    setAnonymizing(true)
    const result = await supabase.rpc('anonymiser_portefeuille', {
      p_portefeuille_id: anonymizeTarget.id,
    })

    if (result.error) {
      setAnonymizeError(
        result.error.code === '42501'
          ? 'Vous n’avez pas les droits nécessaires pour anonymiser cet acheteur.'
          : 'L’acheteur n’a pas pu être anonymisé. Réessayez.',
      )
    } else {
      await fetchData(false)
      showToast('Acheteur anonymisé')
      setAnonymizeTarget(null)
    }
    setAnonymizing(false)
  }

  if (loading) {
    return (
      <div className="-m-6 min-h-[calc(100%+3rem)] bg-paper p-6 font-registre">
        <LoadingState />
      </div>
    )
  }

  if (notFound) {
    return (
      <div className="-m-6 min-h-[calc(100%+3rem)] bg-paper p-6 font-registre">
        <StatusNotice tone="warning" heading="Événement introuvable">
          <p>Cet événement n’existe pas ou n’appartient pas à l’organisation consultée.</p>
          <Button asChild variant="secondary" className="mt-3">
            <Link to="/admin/activites/porte-monnaie">Retour au porte-monnaie</Link>
          </Button>
        </StatusNotice>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="-m-6 min-h-[calc(100%+3rem)] bg-paper p-6 font-registre">
        <StatusNotice tone="danger" heading="Chargement impossible" role="alert">
          <p>{error ?? 'Les informations de cet événement ne sont pas disponibles.'}</p>
          <Button type="button" variant="secondary" className="mt-3" onClick={() => void fetchData()}>
            Réessayer
          </Button>
        </StatusNotice>
      </div>
    )
  }

  const { evenement, portefeuilles, mouvements, commandes } = data
  const statusVariant = evenement.statut === 'ouvert' ? 'success' : evenement.statut === 'clos' ? 'neutral' : 'warning'
  const statusLabel = evenement.statut === 'ouvert' ? 'Ouvert' : evenement.statut === 'clos' ? 'Clos' : 'Brouillon'
  // Crédit sans encaissement : activé par le super-admin seulement (refusé aussi côté base).
  const canCredit = evenement.statut === 'ouvert' && fonctionnalitesActivees?.credit_manuel === true
  const publicUrl = `/e/${encodeURIComponent(data.organisationSlug)}/${encodeURIComponent(evenement.slug)}`

  const panel = selectedWallet && (
    <PortefeuilleDetailPanel
      portefeuille={selectedWallet}
      acces={accesParPortefeuille.get(selectedWallet.id)}
      auteurs={data.auteurs}
      mouvements={selectedMouvements}
      commandes={selectedCommandes}
      busy={busy}
      freezing={freezingWalletId === selectedWallet.id}
      onClose={() => setSelectedWalletId(null)}
      onResend={() => setResendTarget(selectedWallet)}
      onToggleFreeze={() => void toggleFreeze(selectedWallet)}
      onRevoke={() => {
        setRevokeError(null)
        setRevokeTarget(selectedWallet)
      }}
      onAnonymize={() => {
        setAnonymizeError(null)
        setAnonymizeTarget(selectedWallet)
      }}
    />
  )

  return (
    <div className="-m-6 min-h-[calc(100%+3rem)] space-y-6 bg-paper p-6 font-registre">
      <PageHeader
        before={
        <Button asChild variant="ghost" size="sm" className="-ml-3 mb-2">
          <Link to="/admin/activites/porte-monnaie">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} className="h-4 w-4" aria-hidden>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 18l-6-6 6-6" />
            </svg>
            Porte-monnaie
          </Link>
        </Button>
        }
        title={evenement.nom}
        badge={<Badge variant={statusVariant}>{statusLabel}</Badge>}
        subtitle={
            <span className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <span>
                {formatPeriodeEvenement(evenement.date_evenement, evenement.date_fin)}
              </span>
              <a
                href={publicUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-sm font-medium text-stamp underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stamp/70"
              >
                Page d’achat en ligne ↗
              </a>
            </span>
        }
        actions={
          // Actions sur l'événement uniquement ; celles sur les portefeuilles vivent dans leur onglet.
          <>
            <Button type="button" variant="secondary" onClick={() => setAfficheOpen(true)}>
              Affiche QR code
            </Button>
            <Button type="button" onClick={() => setEditOpen(true)}>
              Modifier l’événement
            </Button>
          </>
        }
      />

      {actionError && (
        <StatusNotice tone="danger" role="alert">
          {actionError}
        </StatusNotice>
      )}

      <StatTiles
        items={[
          { label: 'Vendu', value: formatCentimes(stats.venduCentimes), hint: 'Crédits initialement vendus et recharges' },
          { label: 'Dépensé', value: formatCentimes(stats.depenseCentimes), hint: 'Paiements validés auprès des vendeurs' },
          {
            label: 'Restant',
            value: formatCentimes(stats.restantCentimes),
            hint: `Solde cumulé des ${portefeuilles.length} portefeuille${portefeuilles.length !== 1 ? 's' : ''}`,
          },
        ]}
      />

      {evenement.statut === 'clos' && (
        <section aria-labelledby="soldes-restants-title" className="overflow-hidden rounded-sm border border-paper-border bg-white">
          <div className="border-b border-warning-border bg-warning-tint px-4 py-4 md:px-6">
            <h2 id="soldes-restants-title" className="text-lg font-semibold text-warning">Soldes restants après clôture</h2>
            <p className="mt-0.5 text-sm text-warning">
              Base de suivi pour les remboursements futurs. Aucune action de remboursement n’est disponible ici.
            </p>
          </div>
          {remainingWallets.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-ink-faint md:px-6">Aucun solde restant à traiter.</p>
          ) : (
            <ScrollShadowX>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Email</TableHead>
                    <TableHead className="hidden md:table-cell">Code public</TableHead>
                    <TableHead className="text-right">Solde restant</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {remainingWallets.map((portefeuille) => (
                    <TableRow key={portefeuille.id}>
                      <TableCell className="whitespace-nowrap font-medium text-ink">{emailAffiche(portefeuille)}</TableCell>
                      <TableCell className="hidden whitespace-nowrap font-registre-mono text-xs text-ink-muted md:table-cell">{portefeuille.code_public}</TableCell>
                      <TableCell className="whitespace-nowrap text-right font-registre-mono font-semibold tabular-nums text-ink">
                        {formatCentimes(portefeuille.solde_centimes)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollShadowX>
          )}
        </section>
      )}

      <div>
        <Tabs
          aria-label="Contenu de l’événement"
          idPrefix="evenement"
          value={onglet}
          onChange={setOnglet}
          items={[
            { value: 'portefeuilles', label: 'Portefeuilles', count: portefeuilles.length },
            { value: 'mouvements', label: 'Mouvements', count: mouvements.length },
            { value: 'commandes', label: 'Commandes', count: commandes.length },
          ]}
          className="mb-4"
        />

        {onglet === 'portefeuilles' && (
          <div
            role="tabpanel"
            id="evenement-panel-portefeuilles"
            aria-labelledby="evenement-tab-portefeuilles"
            className={cn('flex gap-6', panelOpen && 'items-start')}
          >
            <section className="min-w-0 flex-1 overflow-hidden rounded-sm border border-paper-border border-l-[3px] border-l-stamp bg-white">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-paper-border px-4 py-4 md:px-6">
                <Input
                  type="search"
                  value={walletSearch}
                  onChange={(event) => setWalletSearch(event.target.value)}
                  placeholder="Rechercher par email ou code"
                  aria-label="Rechercher un portefeuille"
                  className="w-full md:w-72"
                />
                {canCredit && (
                  <Button type="button" onClick={() => setCreditOpen(true)}>
                    Créditer un portefeuille
                  </Button>
                )}
              </div>
              {portefeuilles.length === 0 ? (
                <p className="px-4 py-12 text-center text-sm text-ink-faint md:px-6">Aucun portefeuille créé pour cet événement.</p>
              ) : filteredWallets.length === 0 ? (
                <p className="px-4 py-12 text-center text-sm text-ink-faint md:px-6">Aucun portefeuille ne correspond à cette recherche.</p>
              ) : (
                <ScrollShadowX>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Email</TableHead>
                        <TableHead className={panelOpen ? 'hidden' : 'hidden md:table-cell'}>Code public</TableHead>
                        <TableHead className="text-right">Solde</TableHead>
                        <TableHead className="hidden sm:table-cell">Accès</TableHead>
                        <TableHead className="w-8" />
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredWallets.map((portefeuille) => {
                        const acces = accesParPortefeuille.get(portefeuille.id)
                        const actifs = acces?.actifs ?? 0
                        const selected = portefeuille.id === selectedWalletId
                        return (
                          <TableRow
                            key={portefeuille.id}
                            onClick={() => setSelectedWalletId(selected ? null : portefeuille.id)}
                            className={cn(
                              'cursor-pointer hover:bg-paper-border/20',
                              selected && 'bg-stamp/[0.05] hover:bg-stamp/[0.05]'
                            )}
                          >
                            <TableCell className="whitespace-nowrap font-medium text-ink">
                              <span className="inline-flex items-center gap-2">
                                <span className={portefeuille.anonymise_le ? 'italic text-ink-faint' : undefined}>{emailAffiche(portefeuille)}</span>
                                {portefeuille.gele && <Badge variant="stamp">Gelé</Badge>}
                              </span>
                            </TableCell>
                            {/* Masqué quand le panneau est ouvert : le code y figure, et la table garde sa place. */}
                            <TableCell className={cn('hidden whitespace-nowrap font-registre-mono text-xs text-ink-muted', !panelOpen && 'md:table-cell')}>{portefeuille.code_public}</TableCell>
                            <TableCell className="whitespace-nowrap text-right font-registre-mono font-semibold tabular-nums text-ink">
                              {formatCentimes(portefeuille.solde_centimes)}
                            </TableCell>
                            <TableCell className="hidden whitespace-nowrap font-registre-mono text-xs text-ink-muted sm:table-cell">
                              {actifs > 0 ? `${actifs} lien${actifs > 1 ? 's' : ''}` : (acces?.total ?? 0) > 0 ? 'Révoqué' : 'Aucun'}
                            </TableCell>
                            <TableCell className="text-right text-ink-faint">
                              <Chevron />
                            </TableCell>
                          </TableRow>
                        )
                      })}
                    </TableBody>
                  </Table>
                </ScrollShadowX>
              )}
            </section>

            {panelOpen && (
              <div
                ref={desktopPanelRef}
                className="hidden w-80 flex-shrink-0 rounded-sm border border-paper-border bg-white lg:sticky lg:top-6 lg:flex lg:max-h-[calc(100vh-3rem)] lg:flex-col"
                style={{ minHeight: '400px', ...(desktopPanelMaxHeight ? { maxHeight: desktopPanelMaxHeight } : {}) }}
              >
                {panel}
              </div>
            )}
          </div>
        )}

        {onglet === 'mouvements' && (
          <section
            role="tabpanel"
            id="evenement-panel-mouvements"
            aria-labelledby="evenement-tab-mouvements"
            className="overflow-hidden rounded-sm border border-paper-border bg-white"
          >
            {mouvements.length === 0 ? (
              <p className="px-4 py-12 text-center text-sm text-ink-faint md:px-6">Aucun mouvement enregistré.</p>
            ) : (
              <ScrollShadowX>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Portefeuille</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead className="text-right">Montant</TableHead>
                      <TableHead className="text-right">Solde après</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {mouvements.map((mouvement) => {
                      const portefeuille = walletById.get(mouvement.portefeuille_id)
                      const isDebit = mouvement.type === 'debit'
                      return (
                        <TableRow key={mouvement.id}>
                          <TableCell className="whitespace-nowrap font-registre-mono text-xs text-ink-faint">{formatDateTime(mouvement.created_at)}</TableCell>
                          <TableCell className="whitespace-nowrap text-ink-muted">{portefeuille ? emailAffiche(portefeuille) : 'Portefeuille inconnu'}</TableCell>
                          <TableCell className="whitespace-nowrap text-ink-muted">{libelleMouvementAdmin(mouvement.type)}</TableCell>
                          <TableCell className={`whitespace-nowrap text-right font-registre-mono font-semibold tabular-nums ${isDebit ? 'text-ink' : 'text-success'}`}>
                            {isDebit ? '−' : '+'}{formatCentimes(mouvement.montant_centimes)}
                          </TableCell>
                          <TableCell className="whitespace-nowrap text-right font-registre-mono tabular-nums text-ink-muted">
                            {formatCentimes(mouvement.solde_apres_centimes)}
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              </ScrollShadowX>
            )}
          </section>
        )}

        {onglet === 'commandes' && (
          <section
            role="tabpanel"
            id="evenement-panel-commandes"
            aria-labelledby="evenement-tab-commandes"
            className="overflow-hidden rounded-sm border border-paper-border bg-white"
          >
            {commandes.length === 0 ? (
              <p className="px-4 py-12 text-center text-sm text-ink-faint md:px-6">Aucune commande enregistrée.</p>
            ) : (
              <ScrollShadowX>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Moyen</TableHead>
                      <TableHead>Statut</TableHead>
                      <TableHead className="text-right">Montant</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {commandes.map((commande) => (
                      <TableRow key={commande.id}>
                        <TableCell className="whitespace-nowrap font-registre-mono text-xs text-ink-faint">{formatDateTime(commande.created_at)}</TableCell>
                        <TableCell className="whitespace-nowrap font-medium text-ink">{emailCommandeAffiche(commande.email)}</TableCell>
                        <TableCell className="whitespace-nowrap text-ink-muted">{libelleMoyenPaiement(commande.moyen_paiement)}</TableCell>
                        <TableCell>
                          <Badge variant={commande.statut === 'payee' ? 'success' : commande.statut === 'en_attente_paiement' ? 'warning' : 'neutral'}>
                            {libelleStatutCommande(commande.statut)}
                          </Badge>
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-right font-registre-mono font-semibold tabular-nums text-ink">
                          {formatCentimes(commande.montant_centimes)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </ScrollShadowX>
            )}
          </section>
        )}
      </div>

      {/* Panneau mobile (tiroir) — même animation que ParticipantsPage */}
      {panelOpen && (
        <div className="fixed inset-0 z-30 lg:hidden">
          <div className="absolute inset-0 bg-ink/40" onClick={() => setSelectedWalletId(null)} />
          <div
            className={cn(
              'absolute inset-y-0 right-0 flex w-full max-w-sm flex-col bg-white shadow-xl transition-transform duration-200',
              mobilePanelVisible ? 'translate-x-0' : 'translate-x-full'
            )}
          >
            {panel}
          </div>
        </div>
      )}

      <RenvoyerAccesPortefeuilleModal
        portefeuille={resendTarget}
        onClose={() => setResendTarget(null)}
        onSent={(email) => {
          setResendTarget(null)
          showToast(`Nouveau lien envoyé à ${email}`)
          void fetchData(false)
        }}
        onLinkCreated={() => void fetchData(false)}
        onCopyResult={showToast}
      />

      <Dialog
        open={revokeTarget !== null}
        onOpenChange={(next) => {
          if (!next && !revoking) {
            setRevokeTarget(null)
            setRevokeError(null)
          }
        }}
      >
        <DialogContent aria-describedby={undefined}>
          {revokeTarget && (
            <div className="overflow-y-auto p-6">
              <DialogTitle>Révoquer tous les accès</DialogTitle>
              <p className="mt-2 text-sm text-ink-muted">
                Tous les liens actuellement associés au portefeuille de{' '}
                <span className="font-medium text-ink">{revokeTarget.email}</span> seront invalidés.
                L’acheteur perdra immédiatement l’accès à son portefeuille avec ces liens.
              </p>
              <StatusNotice tone="warning" className="mt-4">
                Cette action est irréversible. Vous pourrez ensuite renvoyer un nouvel accès depuis le détail du portefeuille.
              </StatusNotice>
              {revokeError && (
                <StatusNotice tone="danger" role="alert" className="mt-3">
                  {revokeError}
                </StatusNotice>
              )}
              <div className="mt-5 flex justify-end gap-3">
                <Button
                  type="button"
                  variant="secondary"
                  disabled={revoking}
                  onClick={() => {
                    setRevokeTarget(null)
                    setRevokeError(null)
                  }}
                >
                  Annuler
                </Button>
                <Button type="button" variant="destructive" disabled={revoking} onClick={() => void revokeSecrets()}>
                  {revoking ? 'Révocation…' : 'Révoquer tous les accès'}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog
        open={anonymizeTarget !== null}
        onOpenChange={(next) => {
          if (!next && !anonymizing) {
            setAnonymizeTarget(null)
            setAnonymizeError(null)
          }
        }}
      >
        <DialogContent aria-describedby={undefined}>
          {anonymizeTarget && (
            <div className="overflow-y-auto p-6">
              <DialogTitle>Anonymiser cet acheteur</DialogTitle>
              <p className="mt-2 text-sm text-ink-muted">
                L’adresse <span className="break-all font-medium text-ink">{anonymizeTarget.email}</span> sera
                définitivement effacée du portefeuille et de ses commandes. Tous ses liens d’accès seront révoqués :
                il ne pourra plus recevoir de nouvel accès ni de crédit. Les mouvements et le solde restent conservés.
              </p>
              {anonymizeTarget.solde_centimes > 0 && (
                <StatusNotice tone="warning" heading={`${formatCentimes(anonymizeTarget.solde_centimes)} restants`} className="mt-4">
                  À rembourser avant d’anonymiser : l’acheteur ne pourra plus dépenser ce solde.
                </StatusNotice>
              )}
              <StatusNotice tone="warning" className="mt-3">
                Cette action est irréversible.
              </StatusNotice>
              {anonymizeError && (
                <StatusNotice tone="danger" role="alert" className="mt-3">
                  {anonymizeError}
                </StatusNotice>
              )}
              <div className="mt-5 flex justify-end gap-3">
                <Button
                  type="button"
                  variant="secondary"
                  disabled={anonymizing}
                  onClick={() => {
                    setAnonymizeTarget(null)
                    setAnonymizeError(null)
                  }}
                >
                  Annuler
                </Button>
                <Button type="button" variant="destructive" disabled={anonymizing} onClick={() => void anonymize()}>
                  {anonymizing ? 'Anonymisation…' : 'Anonymiser définitivement'}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <EvenementModal
        open={editOpen}
        onClose={() => setEditOpen(false)}
        organisationId={organisationId}
        activites={data.activites}
        evenement={evenement}
        onSaved={(message) => {
          showToast(message)
          void fetchData(false)
        }}
      />
      <EvenementAfficheModal
        open={afficheOpen}
        onClose={() => setAfficheOpen(false)}
        evenement={afficheOpen ? evenement : null}
        organisationSlug={data.organisationSlug}
      />
      <CreditManuelModal
        open={creditOpen}
        onClose={() => {
          setCreditOpen(false)
          if (creditedRef.current) {
            creditedRef.current = false
            void fetchData(false)
          }
        }}
        evenement={creditOpen ? evenement : null}
        onCredited={(message) => {
          creditedRef.current = true
          showToast(message)
        }}
      />

      {toast && <Toast key={toast.id} message={toast.message} onDismiss={dismissToast} />}
    </div>
  )
}
