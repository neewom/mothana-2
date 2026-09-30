import { useCallback, useEffect, useRef, useState } from 'react'
import QRCode from 'qrcode'
import { Button } from '../components/ui/button'
import { StatusNotice } from '../components/ui/status-notice'
import {
  PAYMENT_CHANGED_EVENT,
  paymentDecisionReasonMessage,
} from '../lib/couponPaymentRealtime'
import { createPaymentTransport, TransportAccessError } from '../lib/transport/paymentTransport'
import {
  extractPortefeuilleSecret,
  formatCentimes,
  formatDateMouvement,
  formatPeriodeEvenement,
  hashPortefeuilleSecret,
  libelleMouvement,
} from '../lib/portefeuilleAcheteur'
import { supabase } from '../lib/supabaseClient'
import type { SyncReason } from '../types/paymentTransport'
import type {
  PortefeuilleAcheteurError,
  PortefeuilleAcheteurState,
} from '../types/portefeuilleAcheteur'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

class PortefeuilleHttpError extends Error {
  readonly status: number

  constructor(status: number) {
    super(`Portefeuille request failed with status ${status}`)
    this.status = status
  }
}

interface PaymentDecisionResponse {
  ok: boolean
  raison: string | null
  statut: 'validee' | 'refusee' | 'expiree' | 'annulee' | null
}

interface DecisionFeedback {
  statut: 'validee' | 'refusee'
}

function endpoint(functionName: string): string {
  return `${supabaseUrl}/functions/v1/${functionName}`
}

function requestHeaders(): HeadersInit {
  return {
    apikey: supabaseAnonKey,
    Authorization: `Bearer ${supabaseAnonKey}`,
    'Content-Type': 'application/json',
  }
}

function statusToError(status: number): PortefeuilleAcheteurError {
  if (status === 404) return 'lien_invalide'
  if (status === 429) return 'limite'
  return 'indisponible'
}

async function fetchPortefeuilleState(secretHash: string, signal?: AbortSignal): Promise<PortefeuilleAcheteurState> {
  const response = await fetch(endpoint('get-portefeuille'), {
    method: 'POST',
    headers: requestHeaders(),
    body: JSON.stringify({ secret_hash: secretHash }),
    cache: 'no-store',
    signal,
  })
  if (response.status === 404) throw new TransportAccessError('Portefeuille access denied')
  if (!response.ok) throw new PortefeuilleHttpError(response.status)
  return response.json() as Promise<PortefeuilleAcheteurState>
}

const ERROR_CONTENT: Record<PortefeuilleAcheteurError, { title: string; message: string }> = {
  lien_invalide: {
    title: 'Lien non valide',
    message: "Ce lien n'est plus actif ou ne permet pas d'accéder à un portefeuille.",
  },
  hors_ligne: {
    title: 'Vous êtes hors ligne',
    message: 'Reconnectez-vous à Internet pour afficher le solde de votre portefeuille.',
  },
  limite: {
    title: 'Trop de tentatives',
    message: 'Patientez quelques instants avant de réessayer.',
  },
  indisponible: {
    title: 'Service momentanément indisponible',
    message: "Nous n'arrivons pas à afficher votre portefeuille. Réessayez dans un instant.",
  },
}

function DownloadIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.6">
      <path d="M10 3v9m0 0 3.25-3.25M10 12 6.75 8.75M4 14.5v1.25c0 .69.56 1.25 1.25 1.25h9.5c.69 0 1.25-.56 1.25-1.25V14.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function LoadingState() {
  return (
    <main className="min-h-dvh bg-paper px-4 py-8 font-registre text-ink">
      <div className="mx-auto max-w-5xl animate-pulse" aria-label="Chargement du portefeuille">
        <div className="h-3 w-36 rounded-sm bg-paper-border" />
        <div className="mt-3 h-8 w-64 max-w-full rounded-sm bg-paper-border" />
        <div className="mt-8 grid gap-5 md:grid-cols-[minmax(0,1.05fr)_minmax(20rem,0.95fr)]">
          <div className="h-52 rounded-sm border border-paper-border bg-white" />
          <div className="h-[28rem] rounded-sm border border-paper-border bg-white" />
        </div>
      </div>
    </main>
  )
}

interface ErrorStateProps {
  error: PortefeuilleAcheteurError
  onRetry: () => void
}

function ErrorState({ error, onRetry }: ErrorStateProps) {
  const content = ERROR_CONTENT[error]
  return (
    <main className="flex min-h-dvh items-center justify-center bg-paper px-4 py-10 font-registre text-ink">
      <section className="w-full max-w-md rounded-sm border border-paper-border bg-white p-6 text-center">
        <h1 className="text-2xl font-semibold tracking-tight">{content.title}</h1>
        <p className="mt-3 text-sm leading-6 text-ink-muted">{content.message}</p>
        {error !== 'lien_invalide' && (
          <Button type="button" className="mt-6" onClick={onRetry}>Réessayer</Button>
        )}
      </section>
    </main>
  )
}

export default function PortefeuillePage() {
  const [initialSecret] = useState(() => extractPortefeuilleSecret(window.location.hash))
  const secretRef = useRef<string | null>(initialSecret)
  const secretHashRef = useRef<string | null>(null)
  const [secretHash, setSecretHash] = useState<string | null>(null)
  const [state, setState] = useState<PortefeuilleAcheteurState | null>(null)
  const [error, setError] = useState<PortefeuilleAcheteurError | null>(null)
  const [loading, setLoading] = useState(true)
  const [retryKey, setRetryKey] = useState(0)
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null)
  const [pdfState, setPdfState] = useState<'idle' | 'loading' | 'done' | 'limit' | 'offline' | 'error'>('idle')
  const [decisionState, setDecisionState] = useState<'idle' | 'accepting' | 'refusing'>('idle')
  const [decisionError, setDecisionError] = useState<string | null>(null)
  const [decisionFeedback, setDecisionFeedback] = useState<DecisionFeedback | null>(null)
  const [realtimeNote, setRealtimeNote] = useState<string | null>(null)
  const paymentRefreshRef = useRef<((reason: SyncReason) => Promise<void>) | null>(null)

  useEffect(() => {
    function handleHashChange() {
      const secret = extractPortefeuilleSecret(window.location.hash)
      if (!secret) return

      secretRef.current = secret
      secretHashRef.current = null
      setSecretHash(null)
      setPdfState('idle')
      setDecisionState('idle')
      setDecisionError(null)
      setDecisionFeedback(null)
      setRetryKey((value) => value + 1)
    }

    window.addEventListener('hashchange', handleHashChange)
    return () => window.removeEventListener('hashchange', handleHashChange)
  }, [])

  useEffect(() => {
    let cancelled = false
    const controller = new AbortController()

    async function load() {
      setLoading(true)
      setError(null)
      setState(null)

      let hash = secretHashRef.current
      if (!hash && !secretRef.current) {
        setError('lien_invalide')
        setLoading(false)
        return
      }
      if (!navigator.onLine) {
        setError('hors_ligne')
        setLoading(false)
        return
      }

      try {
        if (!hash) {
          hash = await hashPortefeuilleSecret(secretRef.current!)
          if (cancelled) return
          secretRef.current = null
          secretHashRef.current = hash
          setSecretHash(hash)
        }

        const payload = await fetchPortefeuilleState(hash, controller.signal)
        if (!cancelled) setState(payload)
      } catch (caught) {
        if (controller.signal.aborted || cancelled) return
        if (caught instanceof TransportAccessError) setError('lien_invalide')
        else if (caught instanceof PortefeuilleHttpError) setError(statusToError(caught.status))
        else setError(navigator.onLine ? 'indisponible' : 'hors_ligne')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void load()
    return () => {
      cancelled = true
      controller.abort()
    }
  }, [retryKey])

  useEffect(() => {
    if (!secretHash) return

    const transport = createPaymentTransport<PortefeuilleAcheteurState>({
      mode: 'broadcast',
      read: (signal) => fetchPortefeuilleState(secretHash, signal),
      subscribe: (hint, connected) => {
        const channel = supabase
          .channel(secretHash, { config: { private: false } })
          .on('broadcast', { event: PAYMENT_CHANGED_EVENT }, hint)
          .subscribe((status) => connected(status === 'SUBSCRIBED'))
        return () => { void supabase.removeChannel(channel) }
      },
      onSnapshot: (snapshot) => {
        setState(snapshot)
        setError(null)
        setLoading(false)
        setRealtimeNote(null)
      },
      onEvent: (event) => {
        if (event.event === 'access-denied') {
          setState(null)
          setError('lien_invalide')
          setLoading(false)
        } else if (event.event === 'offline') {
          setRealtimeNote('Connexion interrompue — la mise à jour reprendra automatiquement.')
        } else if (event.event === 'read-error' || event.event === 'broadcast-fallback') {
          setRealtimeNote('Connexion instable — vérification automatique en cours.')
        }
      },
      pollMs: 2500,
      reconcileMs: 5000,
    })

    paymentRefreshRef.current = transport.refresh
    const updateAvailability = () => {
      transport.setAvailability(document.visibilityState === 'visible', navigator.onLine)
    }
    document.addEventListener('visibilitychange', updateAvailability)
    window.addEventListener('online', updateAvailability)
    window.addEventListener('offline', updateAvailability)
    updateAvailability()
    transport.start()

    return () => {
      if (paymentRefreshRef.current === transport.refresh) paymentRefreshRef.current = null
      document.removeEventListener('visibilitychange', updateAvailability)
      window.removeEventListener('online', updateAvailability)
      window.removeEventListener('offline', updateAvailability)
      transport.stop()
    }
  }, [secretHash])

  useEffect(() => {
    if (!state) return
    let cancelled = false
    QRCode.toDataURL(state.portefeuille.codePublic, {
      width: 720,
      margin: 2,
      errorCorrectionLevel: 'M',
      color: { dark: '#241f19', light: '#ffffff' },
    }).then((url) => {
      if (!cancelled) setQrDataUrl(url)
    }).catch(() => {
      if (!cancelled) setQrDataUrl(null)
    })
    return () => { cancelled = true }
  }, [state])

  const retry = useCallback(() => setRetryKey((value) => value + 1), [])

  async function decidePayment(validate: boolean) {
    const pending = state?.demandeEnAttente
    if (!secretHash || !pending || decisionState !== 'idle') return

    setDecisionState(validate ? 'accepting' : 'refusing')
    setDecisionError(null)
    setDecisionFeedback(null)
    try {
      const response = await fetch(endpoint('decider-portefeuille-paiement'), {
        method: 'POST',
        headers: requestHeaders(),
        body: JSON.stringify({
          secret_hash: secretHash,
          demande_id: pending.id,
          valider: validate,
        }),
        cache: 'no-store',
      })
      if (!response.ok) {
        setDecisionError(response.status === 404
          ? 'Cette demande n’est plus disponible.'
          : 'La décision n’a pas pu être enregistrée. Réessayez.')
      } else {
        const result = await response.json() as PaymentDecisionResponse
        if (result.ok || (result.raison === 'DEJA_DECIDEE'
          && (result.statut === 'validee' || result.statut === 'refusee'))) {
          setDecisionFeedback({
            statut: result.statut === 'validee' || result.statut === 'refusee'
              ? result.statut
              : validate ? 'validee' : 'refusee',
          })
        } else {
          setDecisionError(paymentDecisionReasonMessage(result.raison))
        }
      }
    } catch {
      setDecisionError(navigator.onLine
        ? 'Résultat incertain. L’état du portefeuille va être vérifié.'
        : 'Vous êtes hors ligne. Reconnectez-vous avant de décider.')
    } finally {
      await paymentRefreshRef.current?.('mutation')
      setDecisionState('idle')
    }
  }

  async function downloadPdf() {
    if (!secretHash || !state || pdfState === 'loading') return
    setPdfState('loading')
    try {
      const response = await fetch(endpoint('generate-portefeuille-qr-pdf'), {
        method: 'POST',
        headers: requestHeaders(),
        body: JSON.stringify({ secret_hash: secretHash }),
        cache: 'no-store',
      })
      if (!response.ok) {
        setPdfState(response.status === 429 ? 'limit' : 'error')
        return
      }

      const blob = await response.blob()
      const url = URL.createObjectURL(blob)
      const anchor = document.createElement('a')
      anchor.href = url
      anchor.download = `portefeuille-${state.portefeuille.codePublic}.pdf`
      document.body.appendChild(anchor)
      anchor.click()
      anchor.remove()
      URL.revokeObjectURL(url)
      setPdfState('done')
      window.setTimeout(() => setPdfState('idle'), 2500)
    } catch {
      setPdfState(navigator.onLine ? 'error' : 'offline')
    }
  }

  if (loading) return <LoadingState />
  if (error || !state) return <ErrorState error={error ?? 'indisponible'} onRetry={retry} />

  const isClosed = state.evenement.statut === 'clos'

  return (
    <main className="min-h-dvh bg-paper px-4 py-6 font-registre text-ink sm:px-6 sm:py-10">
      <div className="mx-auto max-w-5xl">
        <header className="border-b border-paper-border pb-5">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-medium text-ink-muted">
              {state.evenement.organisationNom}
            </p>
            {isClosed && (
              <span className="rounded-sm border border-paper-border bg-white px-2 py-0.5 font-registre-mono text-[11px] uppercase tracking-[0.12em] text-ink-faint">
                Événement terminé
              </span>
            )}
          </div>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">{state.evenement.nom}</h1>
          <p className="mt-1 text-sm text-ink-faint">
            {formatPeriodeEvenement(state.evenement.dateDebut, state.evenement.dateFin)}
          </p>
        </header>

        {isClosed && (
          <StatusNotice tone="warning" className="mt-5">
            Cet événement est terminé. Votre portefeuille reste consultable en lecture seule.
          </StatusNotice>
        )}

        {realtimeNote && (
          <StatusNotice tone="warning" className="mt-5">
            {realtimeNote}
          </StatusNotice>
        )}

        {decisionFeedback && !state.demandeEnAttente && (
          <StatusNotice
            tone={decisionFeedback.statut === 'validee' ? 'success-emphasis' : 'danger-emphasis'}
            heading={decisionFeedback.statut === 'validee' ? 'Paiement accepté' : 'Paiement refusé'}
            className="mt-5"
          >
            Le vendeur a reçu la confirmation.
          </StatusNotice>
        )}

        {decisionError && !state.demandeEnAttente && (
          <StatusNotice tone="danger" role="alert" className="mt-5">
            {decisionError}
          </StatusNotice>
        )}

        {!isClosed && state.demandeEnAttente && (
          <section className="mt-5 overflow-hidden rounded-sm border border-warning-border bg-white" aria-labelledby="pending-payment-title">
            <div className="border-b border-warning-border bg-warning-tint px-5 py-4 sm:px-6">
              <h2 id="pending-payment-title" className="text-xl font-semibold text-ink">Demande de paiement à confirmer</h2>
              <p className="mt-1 text-sm leading-6 text-ink-muted">
                Vérifiez le montant demandé par le vendeur avant de choisir.
              </p>
            </div>
            <dl className="grid gap-4 px-5 py-5 sm:grid-cols-3 sm:px-6">
              <div>
                <dt className="font-registre-mono text-[11px] uppercase tracking-wide text-ink-faint">Montant</dt>
                <dd className="mt-1 font-registre-mono text-xl font-semibold text-ink">
                  {formatCentimes(state.demandeEnAttente.montantCentimes)}
                </dd>
              </div>
              <div>
                <dt className="font-registre-mono text-[11px] uppercase tracking-wide text-ink-faint">Solde actuel</dt>
                <dd className="mt-1 font-registre-mono text-xl font-semibold text-ink">
                  {formatCentimes(state.portefeuille.soldeCentimes)}
                </dd>
              </div>
              <div>
                <dt className="font-registre-mono text-[11px] uppercase tracking-wide text-ink-faint">Après paiement</dt>
                <dd className="mt-1 font-registre-mono text-xl font-semibold text-ink">
                  {formatCentimes(Math.max(0, state.portefeuille.soldeCentimes - state.demandeEnAttente.montantCentimes))}
                </dd>
              </div>
            </dl>
            <p className="border-t border-paper-border px-5 py-3 font-registre-mono text-[11px] text-ink-faint sm:px-6">
              Expire à {new Intl.DateTimeFormat('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' }).format(new Date(state.demandeEnAttente.expireLe))}
            </p>
            {decisionError && (
              <StatusNotice tone="danger" role="alert" className="mx-5 my-4 sm:mx-6">
                {decisionError}
              </StatusNotice>
            )}
            <div className="grid gap-3 border-t border-paper-border px-5 py-4 sm:grid-cols-2 sm:px-6">
              <Button
                type="button"
                variant="success"
                className="h-11 w-full"
                onClick={() => void decidePayment(true)}
                disabled={decisionState !== 'idle'}
              >
                {decisionState === 'accepting' ? 'Validation…' : 'Accepter'}
              </Button>
              <Button
                type="button"
                variant="danger"
                className="h-11 w-full"
                onClick={() => void decidePayment(false)}
                disabled={decisionState !== 'idle'}
              >
                {decisionState === 'refusing' ? 'Refus…' : 'Refuser'}
              </Button>
            </div>
          </section>
        )}

        <div className="mt-5 grid items-start gap-5 md:grid-cols-[minmax(0,1.05fr)_minmax(20rem,0.95fr)]">
          <section className="rounded-sm border border-paper-border bg-white p-5 sm:p-6" aria-labelledby="solde-title">
            <p id="solde-title" className="font-registre-mono text-[11px] uppercase tracking-[0.14em] text-ink-faint">Solde disponible</p>
            <p className="mt-2 font-registre-mono text-4xl font-semibold tracking-tight tabular-nums sm:text-5xl">
              {formatCentimes(state.portefeuille.soldeCentimes)}
            </p>
            {state.portefeuille.gele && (
              <p className="mt-3 text-sm text-warning">Ce portefeuille est temporairement bloqué.</p>
            )}
          </section>

          <section className="rounded-sm border border-paper-border bg-white p-5 text-center md:sticky md:top-6 md:row-span-2 md:col-start-2 md:row-start-1 sm:p-6" aria-labelledby="qr-title">
            <h2 id="qr-title" className="text-xl font-semibold">Votre QR code</h2>
            <p className="mt-1 text-sm text-ink-muted">Présentez-le au vendeur</p>
            <div className="mx-auto mt-4 flex aspect-square w-full max-w-[17rem] items-center justify-center border border-paper-border bg-white p-3">
              {qrDataUrl ? (
                <img src={qrDataUrl} alt={`QR code du portefeuille ${state.portefeuille.codePublic}`} className="h-full w-full" />
              ) : (
                <span className="text-sm text-ink-faint">QR code indisponible</span>
              )}
            </div>
            <p className="mt-3 font-registre-mono text-lg font-semibold tracking-[0.13em]">{state.portefeuille.codePublic}</p>
            <p className="mt-2 text-xs leading-5 text-ink-faint">Le vendeur peut saisir ce code si le scan ne fonctionne pas.</p>
            <Button type="button" variant="secondary" className="mt-5 w-full" onClick={() => void downloadPdf()} disabled={pdfState === 'loading'}>
              <DownloadIcon />
              {pdfState === 'loading' ? 'Préparation du PDF…' : pdfState === 'done' ? 'PDF téléchargé' : 'Télécharger le QR en PDF'}
            </Button>
            {(pdfState === 'error' || pdfState === 'offline' || pdfState === 'limit') && (
              <p role="alert" className="mt-3 text-xs leading-5 text-stamp">
                {pdfState === 'limit'
                  ? 'Trop de téléchargements successifs. Patientez quelques minutes avant de réessayer.'
                  : pdfState === 'offline'
                    ? 'Reconnectez-vous à Internet pour télécharger le PDF.'
                    : 'Le PDF n’a pas pu être généré. Réessayez dans un instant.'}
              </p>
            )}
          </section>

          <section className="rounded-sm border border-paper-border bg-white md:col-start-1 md:row-start-2" aria-labelledby="history-title">
            <div className="flex items-baseline justify-between border-b border-paper-border px-5 py-4 sm:px-6">
              <h2 id="history-title" className="text-lg font-semibold">Historique</h2>
              <span className="font-registre-mono text-[11px] uppercase tracking-[0.12em] text-ink-faint">
                {state.mouvements.length} mouvement{state.mouvements.length === 1 ? '' : 's'}
              </span>
            </div>
            {state.mouvements.length === 0 ? (
              <p className="px-5 py-8 text-center text-sm text-ink-faint">Aucun mouvement pour le moment.</p>
            ) : (
              <ol className="divide-y divide-paper-border-muted">
                {state.mouvements.map((movement, index) => {
                  const isDebit = movement.type === 'debit'
                  return (
                    <li key={`${movement.createdAt}-${index}`} className="grid grid-cols-[1fr_auto] gap-x-4 px-5 py-4 sm:px-6">
                      <div>
                        <p className="text-sm font-medium">{libelleMouvement(movement.type)}</p>
                        <p className="mt-1 font-registre-mono text-[11px] text-ink-faint">{formatDateMouvement(movement.createdAt)}</p>
                      </div>
                      <div className="text-right">
                        <p className={`font-registre-mono text-sm font-semibold tabular-nums ${isDebit ? 'text-ink' : 'text-success'}`}>
                          {isDebit ? '−' : '+'}{formatCentimes(movement.montantCentimes)}
                        </p>
                        <p className="mt-1 font-registre-mono text-[11px] tabular-nums text-ink-faint">
                          Solde {formatCentimes(movement.soldeApresCentimes)}
                        </p>
                      </div>
                    </li>
                  )
                })}
              </ol>
            )}
          </section>
        </div>

        <footer className="mt-6 border-t border-paper-border pt-4 text-xs leading-5 text-ink-faint">
          Gardez ce lien privé : il donne accès au solde et à l’historique de ce portefeuille.
        </footer>
      </div>
    </main>
  )
}
