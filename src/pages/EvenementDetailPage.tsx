import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import ScrollShadowX from '../components/ScrollShadowX'
import Toast from '../components/Toast'
import { Badge } from '../components/ui/badge'
import { Button } from '../components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '../components/ui/dialog'
import { Input } from '../components/ui/input'
import { Label } from '../components/ui/label'
import { StatusNotice } from '../components/ui/status-notice'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table'
import { useOrganisationId } from '../hooks/useOrganisationId'
import { useToast } from '../hooks/useToast'
import { copyTextToClipboard } from '../lib/clipboard'
import { getCanonicalSiteUrl } from '../lib/environment'
import {
  calculerStatsEvenement,
  filtrerPortefeuilles,
  libelleMoyenPaiement,
  libelleMouvementAdmin,
  libelleStatutCommande,
} from '../lib/evenementDashboard'
import { formatCentimes, formatPeriodeEvenement } from '../lib/portefeuilleAcheteur'
import { supabase } from '../lib/supabaseClient'
import { isValidEmail } from '../lib/textFormat'
import {
  walletAccessResendErrorMessage,
  type WalletAccessResendResponse,
} from '../lib/walletAccessResend'
import type { Evenement } from '../types/evenement'
import type {
  CommandeEvenement,
  EvenementDashboardData,
  MouvementPortefeuilleAdmin,
  PortefeuilleEvenement,
  SecretPortefeuilleAdmin,
} from '../types/evenementDashboard'

const PAGE_SIZE = 1000

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
      <div className="grid overflow-hidden rounded-sm border border-paper-border bg-white sm:grid-cols-3">
        {[0, 1, 2].map((item) => (
          <div key={item} className="space-y-3 border-t border-paper-border p-5 first:border-t-0 sm:border-l sm:border-t-0 sm:first:border-l-0">
            <div className="h-3 w-24 animate-pulse rounded-sm bg-paper-border" />
            <div className="h-7 w-32 animate-pulse rounded-sm bg-paper-border-muted" />
          </div>
        ))}
      </div>
      <div className="h-64 animate-pulse rounded-sm border border-paper-border bg-white" />
    </div>
  )
}

function SectionHeader({
  title,
  description,
  children,
}: {
  title: string
  description: string
  children?: React.ReactNode
}) {
  return (
    <div className="flex flex-col gap-3 border-b border-paper-border px-4 py-4 md:flex-row md:items-center md:justify-between md:px-6">
      <div>
        <h2 className="text-lg font-semibold text-ink">{title}</h2>
        <p className="mt-0.5 text-sm text-ink-faint">{description}</p>
      </div>
      {children}
    </div>
  )
}

export default function EvenementDetailPage() {
  const { id: evenementId } = useParams<{ id: string }>()
  const organisationId = useOrganisationId()
  const { toast, showToast, dismissToast } = useToast()
  const [data, setData] = useState<EvenementDashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [revokeError, setRevokeError] = useState<string | null>(null)
  const [walletSearch, setWalletSearch] = useState('')
  const [freezingWalletId, setFreezingWalletId] = useState<string | null>(null)
  const [revokeTarget, setRevokeTarget] = useState<PortefeuilleEvenement | null>(null)
  const [revoking, setRevoking] = useState(false)
  const [resendTarget, setResendTarget] = useState<PortefeuilleEvenement | null>(null)
  const [resendEmail, setResendEmail] = useState('')
  const [resendRevokeOld, setResendRevokeOld] = useState(false)
  const [resendSubmittingAction, setResendSubmittingAction] = useState<'email' | 'link' | null>(null)
  const [resendError, setResendError] = useState<string | null>(null)
  const [resendLink, setResendLink] = useState<string | null>(null)
  const [resendEmailSent, setResendEmailSent] = useState(false)
  const resendEmailInvalid = resendEmail.length > 0 && !isValidEmail(resendEmail.trim())

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

      const [portefeuilles, commandes] = await Promise.all([
        fetchAllPages<PortefeuilleEvenement>(async (from, to) => {
          const result = await supabase
            .from('portefeuilles')
            .select('id, organisation_id, evenement_id, email, code_public, solde_centimes, gele, email_modifie_le, email_modifie_par, created_at, updated_at')
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
      ])

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
                .select('id, portefeuille_id, revoque_le')
                .eq('organisation_id', organisationId)
                .in('portefeuille_id', walletIds)
                .order('created_at', { ascending: false })
                .range(from, to)
              return { data: result.data as SecretPortefeuilleAdmin[] | null, error: result.error }
            }),
          ])

      setData({
        evenement: eventResult.data as Evenement,
        portefeuilles,
        commandes,
        mouvements,
        secrets,
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
  const secretCounts = useMemo(() => {
    const counts = new Map<string, { total: number; actifs: number }>()
    for (const secret of data?.secrets ?? []) {
      const current = counts.get(secret.portefeuille_id) ?? { total: 0, actifs: 0 }
      current.total += 1
      if (!secret.revoque_le) current.actifs += 1
      counts.set(secret.portefeuille_id, current)
    }
    return counts
  }, [data])
  const filteredWallets = useMemo(
    () => filtrerPortefeuilles(data?.portefeuilles ?? [], walletSearch),
    [data, walletSearch],
  )
  const remainingWallets = useMemo(
    () => (data?.portefeuilles ?? []).filter((portefeuille) => portefeuille.solde_centimes > 0),
    [data],
  )

  async function toggleFreeze(portefeuille: PortefeuilleEvenement) {
    setActionError(null)
    setFreezingWalletId(portefeuille.id)
    const nextFrozen = !portefeuille.gele
    const result = await supabase.rpc('geler_portefeuille', {
      p_portefeuille_id: portefeuille.id,
      p_gele: nextFrozen,
    })

    if (result.error) {
      setActionError(`Le portefeuille de ${portefeuille.email} n’a pas pu être ${nextFrozen ? 'gelé' : 'dégelé'}. Réessayez.`)
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

  function openResendAccess(portefeuille: PortefeuilleEvenement) {
    setResendTarget(portefeuille)
    setResendEmail(portefeuille.email)
    setResendRevokeOld(false)
    setResendSubmittingAction(null)
    setResendError(null)
    setResendLink(null)
    setResendEmailSent(false)
  }

  function closeResendAccess() {
    if (resendSubmittingAction) return
    setResendTarget(null)
    setResendEmail('')
    setResendRevokeOld(false)
    setResendError(null)
    setResendLink(null)
    setResendEmailSent(false)
  }

  async function resendAccess(action: 'email' | 'link') {
    if (!resendTarget || resendSubmittingAction) return
    const normalizedEmail = resendEmail.trim().toLowerCase()
    if (!isValidEmail(normalizedEmail)) {
      setResendError('Renseignez une adresse email valide.')
      return
    }

    setResendSubmittingAction(action)
    setResendError(null)
    setResendLink(null)
    setResendEmailSent(false)

    const { data: response, error: invocationError } = await supabase.functions.invoke<WalletAccessResendResponse>(
      'renvoyer-acces-portefeuille',
      {
        body: {
          portefeuille_id: resendTarget.id,
          nouvel_email: normalizedEmail,
          revoquer_anciens: resendRevokeOld,
          envoyer_email: action === 'email',
          site_url: getCanonicalSiteUrl(),
        },
      },
    )

    if (invocationError || !response) {
      setResendError(walletAccessResendErrorMessage(null))
      setResendSubmittingAction(null)
      return
    }

    if (!response.ok) {
      setResendError(walletAccessResendErrorMessage(response.error ?? null))
      if (response.error === 'EMAIL_NON_ENVOYE' && response.portefeuille_url) {
        setResendLink(response.portefeuille_url)
        await fetchData(false)
      }
      setResendSubmittingAction(null)
      return
    }

    await fetchData(false)
    if (action === 'email') {
      setResendEmailSent(true)
    } else if (response.portefeuille_url) {
      setResendLink(response.portefeuille_url)
    }
    setResendSubmittingAction(null)
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
            <Link to="/admin/evenements">Retour aux événements</Link>
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

  return (
    <div className="-m-6 min-h-[calc(100%+3rem)] space-y-6 bg-paper p-6 font-registre">
      <header>
        <Button asChild variant="ghost" size="sm" className="-ml-3 mb-2">
          <Link to="/admin/evenements">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} className="h-4 w-4" aria-hidden>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 18l-6-6 6-6" />
            </svg>
            Événements
          </Link>
        </Button>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-bold text-ink md:text-3xl">{evenement.nom}</h1>
          <Badge variant={statusVariant}>{statusLabel}</Badge>
        </div>
        <p className="mt-1 font-registre-mono text-sm text-ink-faint">
          {formatPeriodeEvenement(evenement.date_evenement, evenement.date_fin)} · /{evenement.slug}
        </p>
      </header>

      {actionError && (
        <StatusNotice tone="danger" role="alert">
          {actionError}
        </StatusNotice>
      )}

      <dl className="grid overflow-hidden rounded-sm border border-paper-border bg-white sm:grid-cols-3">
        <div className="p-5">
          <dt className="font-registre-mono text-[11px] uppercase tracking-wide text-ink-faint">Crédit vendu</dt>
          <dd className="mt-2 font-registre-mono text-2xl font-semibold tabular-nums text-ink">{formatCentimes(stats.venduCentimes)}</dd>
          <p className="mt-1 text-xs text-ink-faint">Crédits initialement vendus et recharges</p>
        </div>
        <div className="border-t border-paper-border p-5 sm:border-l sm:border-t-0">
          <dt className="font-registre-mono text-[11px] uppercase tracking-wide text-ink-faint">Dépensé</dt>
          <dd className="mt-2 font-registre-mono text-2xl font-semibold tabular-nums text-ink">{formatCentimes(stats.depenseCentimes)}</dd>
          <p className="mt-1 text-xs text-ink-faint">Paiements validés auprès des vendeurs</p>
        </div>
        <div className="border-t border-paper-border p-5 sm:border-l sm:border-t-0">
          <dt className="font-registre-mono text-[11px] uppercase tracking-wide text-ink-faint">Restant</dt>
          <dd className="mt-2 font-registre-mono text-2xl font-semibold tabular-nums text-ink">{formatCentimes(stats.restantCentimes)}</dd>
          <p className="mt-1 text-xs text-ink-faint">Solde cumulé des {portefeuilles.length} portefeuille{portefeuilles.length !== 1 ? 's' : ''}</p>
        </div>
      </dl>

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
              <Table className="min-w-[680px]">
                <TableHeader>
                  <TableRow>
                    <TableHead>Email</TableHead>
                    <TableHead>Code public</TableHead>
                    <TableHead className="text-right">Solde restant</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {remainingWallets.map((portefeuille) => (
                    <TableRow key={portefeuille.id}>
                      <TableCell className="whitespace-nowrap font-medium text-ink">{portefeuille.email}</TableCell>
                      <TableCell className="whitespace-nowrap font-registre-mono text-xs text-ink-muted">{portefeuille.code_public}</TableCell>
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

      <section aria-labelledby="portefeuilles-title" className="overflow-hidden rounded-sm border border-paper-border border-l-[3px] border-l-stamp bg-white">
        <SectionHeader
          title="Portefeuilles"
          description={`${portefeuilles.length} portefeuille${portefeuilles.length !== 1 ? 's' : ''} associé${portefeuilles.length !== 1 ? 's' : ''} à l’événement`}
        >
          <Input
            type="search"
            value={walletSearch}
            onChange={(event) => setWalletSearch(event.target.value)}
            placeholder="Rechercher par email ou code"
            aria-label="Rechercher un portefeuille"
            className="w-full md:w-72"
          />
        </SectionHeader>
        {portefeuilles.length === 0 ? (
          <p className="px-4 py-12 text-center text-sm text-ink-faint md:px-6">Aucun portefeuille créé pour cet événement.</p>
        ) : filteredWallets.length === 0 ? (
          <p className="px-4 py-12 text-center text-sm text-ink-faint md:px-6">Aucun portefeuille ne correspond à cette recherche.</p>
        ) : (
          <ScrollShadowX>
            <Table className="min-w-[1240px]">
              <TableHeader>
                <TableRow>
                  <TableHead>Email</TableHead>
                  <TableHead>Code public</TableHead>
                  <TableHead className="text-right">Solde</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead>Accès acheteur</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredWallets.map((portefeuille) => {
                  const secrets = secretCounts.get(portefeuille.id) ?? { total: 0, actifs: 0 }
                  const freezing = freezingWalletId === portefeuille.id
                  return (
                    <TableRow key={portefeuille.id}>
                      <TableCell className="whitespace-nowrap font-medium text-ink">{portefeuille.email}</TableCell>
                      <TableCell className="whitespace-nowrap font-registre-mono text-xs text-ink-muted">{portefeuille.code_public}</TableCell>
                      <TableCell className="whitespace-nowrap text-right font-registre-mono font-semibold tabular-nums text-ink">
                        {formatCentimes(portefeuille.solde_centimes)}
                      </TableCell>
                      <TableCell>
                        <Badge variant={portefeuille.gele ? 'stamp' : 'success'}>{portefeuille.gele ? 'Gelé' : 'Actif'}</Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={secrets.actifs > 0 ? 'success' : 'neutral'}>
                          {secrets.actifs > 0 ? `${secrets.actifs} actif${secrets.actifs > 1 ? 's' : ''}` : secrets.total > 0 ? 'Révoqué' : 'Aucun accès'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex justify-end gap-2 whitespace-nowrap">
                          <Button
                            type="button"
                            size="sm"
                            disabled={freezing || revoking || resendSubmittingAction !== null}
                            onClick={() => openResendAccess(portefeuille)}
                          >
                            Renvoyer l’accès
                          </Button>
                          <Button
                            type="button"
                            variant="secondary"
                            size="sm"
                            disabled={freezing || revoking || resendSubmittingAction !== null}
                            onClick={() => void toggleFreeze(portefeuille)}
                          >
                            {freezing ? 'Mise à jour…' : portefeuille.gele ? 'Dégeler' : 'Geler'}
                          </Button>
                          <Button
                            type="button"
                            variant="danger"
                            size="sm"
                            disabled={secrets.actifs === 0 || freezing || revoking || resendSubmittingAction !== null}
                            onClick={() => {
                              setRevokeError(null)
                              setRevokeTarget(portefeuille)
                            }}
                          >
                            Révoquer les accès
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
      </section>

      <section aria-labelledby="mouvements-title" className="overflow-hidden rounded-sm border border-paper-border bg-white">
        <SectionHeader
          title="Historique des mouvements"
          description={`${mouvements.length} mouvement${mouvements.length !== 1 ? 's' : ''}, du plus récent au plus ancien`}
        />
        {mouvements.length === 0 ? (
          <p className="px-4 py-12 text-center text-sm text-ink-faint md:px-6">Aucun mouvement enregistré.</p>
        ) : (
          <ScrollShadowX>
            <Table className="min-w-[900px]">
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
                      <TableCell className="whitespace-nowrap text-ink-muted">{portefeuille?.email ?? 'Portefeuille inconnu'}</TableCell>
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

      <section aria-labelledby="commandes-title" className="overflow-hidden rounded-sm border border-paper-border bg-white">
        <SectionHeader
          title="Commandes"
          description={`${commandes.length} commande${commandes.length !== 1 ? 's' : ''}, tous statuts confondus`}
        />
        {commandes.length === 0 ? (
          <p className="px-4 py-12 text-center text-sm text-ink-faint md:px-6">Aucune commande enregistrée.</p>
        ) : (
          <ScrollShadowX>
            <Table className="min-w-[940px]">
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
                    <TableCell className="whitespace-nowrap font-medium text-ink">{commande.email}</TableCell>
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

      <Dialog
        open={resendTarget !== null}
        onOpenChange={(next) => {
          if (!next) closeResendAccess()
        }}
      >
        <DialogContent className="max-w-lg" aria-describedby="resend-access-description">
          {resendTarget && (
            <>
              <DialogHeader className="shrink-0 pr-12">
                <DialogTitle>Renvoyer l’accès au portefeuille</DialogTitle>
                <DialogDescription id="resend-access-description" className="mt-1">
                  Générez un lien neuf pour {resendTarget.email}.
                </DialogDescription>
              </DialogHeader>

              <div className="flex-1 space-y-5 overflow-y-auto px-6 py-5">
                <StatusNotice tone="warning" heading="Vérification indispensable">
                  Vérifiez l’identité de la personne avant de modifier l’adresse ou de transmettre le lien : il permet de dépenser le solde du portefeuille.
                </StatusNotice>

                <div>
                  <Label htmlFor="resend-wallet-email">Adresse email</Label>
                  <Input
                    id="resend-wallet-email"
                    type="email"
                    inputMode="email"
                    autoComplete="email"
                    value={resendEmail}
                    disabled={resendEmailSent || resendLink !== null}
                    onChange={(event) => {
                      setResendEmail(event.target.value)
                      setResendError(null)
                    }}
                    aria-invalid={resendEmailInvalid}
                    aria-describedby="resend-wallet-email-help"
                    className="mt-1"
                  />
                  <p id="resend-wallet-email-help" className={`mt-1.5 text-xs ${resendEmailInvalid ? 'text-stamp' : 'text-ink-faint'}`}>
                    La correction met à jour le portefeuille, pas l’historique de la commande.
                  </p>
                </div>

                <label className="flex items-start gap-3 rounded-sm border border-paper-border bg-white p-3 text-sm text-ink-muted">
                  <input
                    type="checkbox"
                    checked={resendRevokeOld}
                    disabled={resendEmailSent || resendLink !== null}
                    onChange={(event) => setResendRevokeOld(event.target.checked)}
                    className="mt-0.5 h-4 w-4 rounded-sm border-paper-border accent-stamp focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stamp/70"
                  />
                  <span>
                    <span className="block font-medium text-ink">Révoquer les anciens liens</span>
                    <span className="mt-0.5 block text-xs leading-5 text-ink-faint">
                      À cocher si le téléphone a été perdu ou volé. Les anciens accès cesseront immédiatement de fonctionner.
                    </span>
                  </span>
                </label>

                {resendEmailSent && (
                  <StatusNotice tone="success" heading="Email envoyé">
                    Un nouveau lien d’accès a été envoyé à {resendEmail.trim().toLowerCase()}.
                  </StatusNotice>
                )}

                {resendError && (
                  <StatusNotice tone="danger" role="alert">
                    {resendError}
                  </StatusNotice>
                )}

                {resendLink && (
                  <div>
                    <Label htmlFor="resend-wallet-link">Nouveau lien — affiché une seule fois</Label>
                    <div className="mt-1 flex flex-col gap-2 sm:flex-row">
                      <Input
                        id="resend-wallet-link"
                        value={resendLink}
                        readOnly
                        className="font-registre-mono text-xs"
                        onFocus={(event) => event.currentTarget.select()}
                      />
                      <Button
                        type="button"
                        variant="secondary"
                        onClick={() => {
                          copyTextToClipboard(resendLink)
                          showToast('Lien copié')
                        }}
                      >
                        Copier
                      </Button>
                    </div>
                    <p className="mt-1.5 text-xs text-ink-faint">
                      Fermer cette fenêtre effacera le lien de l’écran.
                    </p>
                  </div>
                )}
              </div>

              <div className="flex shrink-0 flex-col-reverse gap-3 border-t border-paper-border px-6 py-4 sm:flex-row sm:justify-end">
                <Button type="button" variant="secondary" disabled={resendSubmittingAction !== null} onClick={closeResendAccess}>
                  {resendEmailSent || resendLink ? 'Terminer' : 'Annuler'}
                </Button>
                {!resendEmailSent && !resendLink && (
                  <>
                    <Button
                      type="button"
                      variant="secondary"
                      disabled={!isValidEmail(resendEmail.trim()) || resendSubmittingAction !== null}
                      onClick={() => void resendAccess('link')}
                    >
                      {resendSubmittingAction === 'link' ? 'Génération…' : 'Afficher le lien'}
                    </Button>
                    <Button
                      type="button"
                      disabled={!isValidEmail(resendEmail.trim()) || resendSubmittingAction !== null}
                      onClick={() => void resendAccess('email')}
                    >
                      {resendSubmittingAction === 'email' ? 'Envoi…' : 'Envoyer par email'}
                    </Button>
                  </>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

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
                Cette action est irréversible. La réémission d’un accès n’est pas disponible dans cette version.
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

      {toast && <Toast key={toast.id} message={toast.message} onDismiss={dismissToast} />}
    </div>
  )
}
