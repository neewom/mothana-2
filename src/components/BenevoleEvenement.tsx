import { useCallback, useEffect, useId, useRef, useState, type FormEvent } from 'react'
import type { Html5Qrcode } from 'html5-qrcode'
import {
  PAYMENT_CHANGED_EVENT,
  paymentRequestRevision,
  sellerPaymentTopic,
} from '../lib/couponPaymentRealtime'
import { supabase } from '../lib/supabaseClient'
import { createPaymentTransport } from '../lib/transport/paymentTransport'
import {
  eurosToCentimes,
  isValidWalletCode,
  normalizeWalletCode,
  paymentRequestErrorMessage,
  paymentRequestReasonMessage,
  paymentRequestStatusLabel,
  type PaymentRequestStatus,
} from '../lib/paiementVendeur'
import { formatCentimes, formatPeriodeEvenement } from '../lib/portefeuilleAcheteur'
import { disposeQrScanner } from '../lib/qrScannerLifecycle'
import { cn } from '../lib/utils'
import type { Evenement } from '../types/evenement'
import type { SyncReason, TransportSnapshot } from '../types/paymentTransport'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { Label } from './ui/label'
import { StatusNotice } from './ui/status-notice'

type OpenEvent = Pick<Evenement, 'id' | 'nom' | 'date_evenement' | 'date_fin' | 'statut'>

interface CreatePaymentRequestResult {
  ok: boolean
  raison: string | null
  demande_id: string | null
}

interface CancelPaymentRequestResult {
  ok: boolean
  raison: string | null
  statut: PaymentRequestStatus | null
}

interface PaymentRequestRow {
  id: string
  statut: PaymentRequestStatus
  montant_centimes: number
  expire_le: string
  updated_at: string
}

interface SellerPaymentSnapshot extends TransportSnapshot {
  statut: PaymentRequestStatus
  expireLe: string
}

interface CurrentPaymentRequest {
  id: string
  evenementId: string
  evenementNom: string
  codePublic: string
  montantCentimes: number
  statut: PaymentRequestStatus
  expireLe: string | null
}

interface BenevoleEvenementProps {
  organisationId: string
}

function responseRow<T>(data: unknown): T | null {
  return (Array.isArray(data) ? data[0] : data) as T | null
}

function effectiveStatus(row: PaymentRequestRow): PaymentRequestStatus {
  if (row.statut === 'en_attente' && new Date(row.expire_le).getTime() <= Date.now()) return 'expiree'
  return row.statut
}

async function readPaymentRequest(requestId: string, signal: AbortSignal): Promise<SellerPaymentSnapshot> {
  const { data, error } = await supabase
    .from('demandes_paiement')
    .select('id, statut, montant_centimes, expire_le, updated_at')
    .eq('id', requestId)
    .abortSignal(signal)
    .single()

  if (error || !data) throw new Error('PAYMENT_REQUEST_READ_FAILED')
  const row = data as PaymentRequestRow
  const statut = effectiveStatus(row)
  return {
    revision: paymentRequestRevision(row.updated_at, row.expire_le, row.statut),
    statut,
    expireLe: row.expire_le,
  }
}

function requestStatusTone(status: PaymentRequestStatus): 'neutral' | 'warning' | 'success-emphasis' | 'danger-emphasis' {
  if (status === 'validee') return 'success-emphasis'
  if (status === 'refusee') return 'danger-emphasis'
  if (status === 'en_attente' || status === 'expiree') return 'warning'
  return 'neutral'
}

function requestStatusDescription(status: PaymentRequestStatus): string {
  switch (status) {
    case 'en_attente':
      return 'Demandez à l’acheteur de valider sur son téléphone. Le résultat apparaîtra automatiquement.'
    case 'validee':
      return 'Le paiement a été accepté et le portefeuille a été débité.'
    case 'refusee':
      return 'L’acheteur a refusé la demande ou le paiement n’a pas pu être finalisé.'
    case 'expiree':
      return 'Le délai de validation est dépassé. Créez une nouvelle demande si nécessaire.'
    case 'annulee':
      return 'La demande a été annulée. Aucun débit n’a été effectué.'
  }
}

export default function BenevoleEvenement({ organisationId }: BenevoleEvenementProps) {
  const scannerElementId = `wallet-scanner-${useId().replace(/:/g, '')}`
  const scannerRef = useRef<Html5Qrcode | null>(null)
  const scannerStartRef = useRef<Promise<null> | null>(null)
  const scannerOperationRef = useRef(0)
  const mountedRef = useRef(true)
  const inputModeRef = useRef<'scan' | 'manual'>('manual')
  const [events, setEvents] = useState<OpenEvent[]>([])
  const [eventId, setEventId] = useState('')
  const [loadingEvents, setLoadingEvents] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [inputMode, setInputMode] = useState<'scan' | 'manual'>('manual')
  const [walletCode, setWalletCode] = useState('')
  const [amount, setAmount] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [scanMessage, setScanMessage] = useState<string | null>(null)
  const [scannerState, setScannerState] = useState<'idle' | 'starting' | 'active'>('idle')
  const [saving, setSaving] = useState(false)
  const [checking, setChecking] = useState(false)
  const [cancelling, setCancelling] = useState(false)
  const [statusNote, setStatusNote] = useState<string | null>(null)
  const [request, setRequest] = useState<CurrentPaymentRequest | null>(null)
  const sellerRefreshRef = useRef<((reason: SyncReason) => Promise<void>) | null>(null)
  const trackedRequestId = request?.statut === 'en_attente' ? request.id : null

  const loadEvents = useCallback(async () => {
    setLoadingEvents(true)
    setLoadError(null)
    const { data, error: queryError } = await supabase
      .from('evenements')
      .select('id, nom, date_evenement, date_fin, statut')
      .eq('organisation_id', organisationId)
      .eq('statut', 'ouvert')
      .order('date_evenement', { ascending: true })

    if (!mountedRef.current) return
    if (queryError) {
      setLoadError('Les événements ouverts n’ont pas pu être chargés. Réessayez.')
      setLoadingEvents(false)
      return
    }

    const openEvents = (data ?? []) as OpenEvent[]
    setEvents(openEvents)
    setEventId((current) => openEvents.some((event) => event.id === current) ? current : (openEvents[0]?.id ?? ''))
    setLoadingEvents(false)
  }, [organisationId])

  const stopScanner = useCallback(async () => {
    const operation = ++scannerOperationRef.current
    const scanner = scannerRef.current
    const startPromise = scannerStartRef.current
    scannerRef.current = null
    scannerStartRef.current = null
    if (!scanner) {
      if (mountedRef.current && scannerOperationRef.current === operation) setScannerState('idle')
      return
    }
    await disposeQrScanner(scanner, startPromise)
    if (mountedRef.current && scannerOperationRef.current === operation) setScannerState('idle')
  }, [])

  useEffect(() => {
    mountedRef.current = true
    void loadEvents()
    return () => {
      mountedRef.current = false
      scannerOperationRef.current += 1
      const scanner = scannerRef.current
      const startPromise = scannerStartRef.current
      scannerRef.current = null
      scannerStartRef.current = null
      if (scanner) void disposeQrScanner(scanner, startPromise)
    }
  }, [loadEvents])

  useEffect(() => {
    if (inputMode !== 'scan') void stopScanner()
  }, [inputMode, stopScanner])

  useEffect(() => {
    if (!trackedRequestId) return

    const transport = createPaymentTransport<SellerPaymentSnapshot>({
      mode: 'broadcast',
      read: (signal) => readPaymentRequest(trackedRequestId, signal),
      subscribe: (hint, connected) => {
        const channel = supabase
          .channel(sellerPaymentTopic(trackedRequestId), { config: { private: false } })
          .on('broadcast', { event: PAYMENT_CHANGED_EVENT }, hint)
          .subscribe((status) => connected(status === 'SUBSCRIBED'))
        return () => { void supabase.removeChannel(channel) }
      },
      onSnapshot: (snapshot, reason) => {
        setRequest((current) => current?.id === trackedRequestId
          ? { ...current, statut: snapshot.statut, expireLe: snapshot.expireLe }
          : current)
        if (snapshot.statut === 'en_attente' && reason === 'mutation') {
          const time = new Intl.DateTimeFormat('fr-FR', {
            hour: '2-digit', minute: '2-digit', second: '2-digit',
          }).format(new Date())
          setStatusNote(`Toujours en attente — vérifié à ${time}.`)
        } else if (snapshot.statut !== 'en_attente') {
          setStatusNote('Décision reçue automatiquement.')
        }
      },
      onEvent: (event) => {
        if (event.event === 'broadcast-connected') {
          setStatusNote('Suivi automatique actif.')
        } else if (event.event === 'offline') {
          setStatusNote('Hors ligne — le suivi reprendra automatiquement à la reconnexion.')
        } else if (event.event === 'read-error' || event.event === 'broadcast-fallback') {
          setStatusNote('Connexion instable — vérification automatique en cours.')
        }
      },
      pollMs: 1000,
      reconcileMs: 5000,
    })

    sellerRefreshRef.current = transport.refresh
    const updateAvailability = () => {
      transport.setAvailability(document.visibilityState === 'visible', navigator.onLine)
    }
    document.addEventListener('visibilitychange', updateAvailability)
    window.addEventListener('online', updateAvailability)
    window.addEventListener('offline', updateAvailability)
    updateAvailability()
    transport.start()

    return () => {
      if (sellerRefreshRef.current === transport.refresh) sellerRefreshRef.current = null
      document.removeEventListener('visibilitychange', updateAvailability)
      window.removeEventListener('online', updateAvailability)
      window.removeEventListener('offline', updateAvailability)
      transport.stop()
    }
  }, [trackedRequestId])

  function switchInputMode(mode: 'scan' | 'manual') {
    inputModeRef.current = mode
    setInputMode(mode)
  }

  async function startScanner() {
    const operation = ++scannerOperationRef.current
    setError(null)
    setScanMessage(null)
    if (!window.isSecureContext) {
      setError('La caméra exige une connexion HTTPS. Utilisez la saisie manuelle sur cette adresse.')
      return
    }

    setScannerState('starting')
    let scanner: Html5Qrcode | null = null
    let startPromise: Promise<null> | null = null
    try {
      const { Html5Qrcode: Html5QrcodeClient, Html5QrcodeSupportedFormats } = await import('html5-qrcode')
      if (!mountedRef.current || inputModeRef.current !== 'scan' || scannerOperationRef.current !== operation) {
        if (mountedRef.current && scannerOperationRef.current === operation) setScannerState('idle')
        return
      }

      scanner = new Html5QrcodeClient(scannerElementId, {
        formatsToSupport: [Html5QrcodeSupportedFormats.QR_CODE],
        verbose: false,
      })
      scannerRef.current = scanner
      startPromise = scanner.start(
        { facingMode: 'environment' },
        {
          fps: 10,
          aspectRatio: 1,
          qrbox: (width, height) => {
            const size = Math.floor(Math.min(width, height) * 0.72)
            return { width: size, height: size }
          },
        },
        (decodedText) => {
          const code = normalizeWalletCode(decodedText)
          if (!isValidWalletCode(code)) {
            setError('Ce QR code ne correspond pas à un portefeuille Samakan.')
            return
          }
          setWalletCode(code)
          setError(null)
          setScanMessage('QR code lu. Vérifiez le code puis saisissez le montant.')
          switchInputMode('manual')
        },
        undefined,
      )
      scannerStartRef.current = startPromise
      await startPromise
      if (scannerStartRef.current === startPromise) scannerStartRef.current = null

      const stillOwned = scannerRef.current === scanner
      const shouldStayActive = mountedRef.current
        && inputModeRef.current === 'scan'
        && scannerOperationRef.current === operation
      if (!shouldStayActive) {
        if (stillOwned) {
          scannerRef.current = null
          await disposeQrScanner(scanner)
        }
        return
      }
      if (stillOwned) setScannerState('active')
    } catch {
      const stillOwned = scanner !== null && scannerRef.current === scanner
      if (stillOwned && scanner) {
        scannerRef.current = null
        if (scannerStartRef.current === startPromise) scannerStartRef.current = null
        await disposeQrScanner(scanner)
      }
      if (mountedRef.current && inputModeRef.current === 'scan' && scannerOperationRef.current === operation) {
        setScannerState('idle')
        setError('Impossible d’accéder à la caméra. Autorisez-la dans le navigateur ou utilisez la saisie manuelle.')
      }
    }
  }

  async function createRequest(event: FormEvent) {
    event.preventDefault()
    setError(null)
    setStatusNote(null)

    const selectedEvent = events.find((candidate) => candidate.id === eventId)
    if (!selectedEvent) {
      setError('Sélectionnez un événement ouvert.')
      return
    }

    const normalizedCode = normalizeWalletCode(walletCode)
    if (!isValidWalletCode(normalizedCode)) {
      setError('Saisissez un code portefeuille valide ou scannez son QR code.')
      return
    }

    const amountCentimes = eurosToCentimes(amount)
    if (!amountCentimes) {
      setError('Saisissez un montant supérieur à 0, avec deux décimales maximum.')
      return
    }

    setSaving(true)
    const { data, error: rpcError } = await supabase.rpc('creer_demande_paiement', {
      p_evenement_id: selectedEvent.id,
      p_code_public: normalizedCode,
      p_montant_centimes: amountCentimes,
    })

    if (rpcError) {
      setError(paymentRequestErrorMessage(rpcError.message))
      setSaving(false)
      return
    }

    const result = responseRow<CreatePaymentRequestResult>(data)
    if (!result?.ok || !result.demande_id) {
      setError(paymentRequestReasonMessage(result?.raison))
      setSaving(false)
      return
    }

    setWalletCode(normalizedCode)
    setRequest({
      id: result.demande_id,
      evenementId: selectedEvent.id,
      evenementNom: selectedEvent.nom,
      codePublic: normalizedCode,
      montantCentimes: amountCentimes,
      statut: 'en_attente',
      expireLe: null,
    })
    setStatusNote('Connexion au suivi automatique…')
    setSaving(false)
  }

  async function checkStatus() {
    if (!request || !sellerRefreshRef.current) return
    setChecking(true)
    setError(null)
    await sellerRefreshRef.current('mutation')
    setChecking(false)
  }

  async function cancelRequest() {
    if (!request) return
    setCancelling(true)
    setError(null)
    setStatusNote(null)

    const { data, error: rpcError } = await supabase.rpc('annuler_demande_paiement', {
      p_demande_id: request.id,
    })
    if (rpcError) {
      setError(paymentRequestErrorMessage(rpcError.message))
      setCancelling(false)
      return
    }

    const result = responseRow<CancelPaymentRequestResult>(data)
    if (result?.statut) {
      setRequest((current) => current ? { ...current, statut: result.statut! } : current)
    }
    if (!result?.ok) setError(paymentRequestReasonMessage(result?.raison))
    setCancelling(false)
  }

  function resetRequest() {
    void stopScanner()
    setRequest(null)
    setWalletCode('')
    setAmount('')
    setError(null)
    setScanMessage(null)
    setStatusNote(null)
    switchInputMode('manual')
  }

  if (loadingEvents) {
    return <p className="py-16 text-center text-sm text-ink-faint">Chargement des événements…</p>
  }

  if (loadError) {
    return (
      <div className="text-center">
        <StatusNotice tone="danger" role="alert">{loadError}</StatusNotice>
        <Button type="button" className="mt-4" onClick={() => void loadEvents()}>
          Réessayer
        </Button>
      </div>
    )
  }

  if (events.length === 0) {
    return (
      <section className="rounded-sm border border-paper-border bg-white p-6 text-center">
        <h1 className="text-xl font-semibold text-ink">Aucun événement ouvert</h1>
        <p className="mt-2 text-sm leading-6 text-ink-muted">
          Un administrateur doit ouvrir un événement avant de pouvoir créer une demande de paiement.
        </p>
        <Button type="button" variant="secondary" className="mt-5" onClick={() => void loadEvents()}>
          Actualiser
        </Button>
      </section>
    )
  }

  const selectedEvent = events.find((event) => event.id === eventId)

  if (request) {
    const isPending = request.statut === 'en_attente'
    return (
      <section aria-labelledby="payment-request-title" className="space-y-5">
        <div>
          <h1 id="payment-request-title" className="text-2xl font-bold text-ink">Demande de paiement</h1>
          <p className="mt-1 text-sm text-ink-muted">{request.evenementNom}</p>
        </div>

        <StatusNotice tone={requestStatusTone(request.statut)} heading={paymentRequestStatusLabel(request.statut)}>
          <p>{requestStatusDescription(request.statut)}</p>
          {statusNote && <p className="mt-2 text-xs font-medium opacity-80">{statusNote}</p>}
        </StatusNotice>

        <div className="rounded-sm border border-paper-border bg-white">
          <dl className="grid grid-cols-2 gap-x-4 gap-y-4 px-5 py-5 text-sm">
            <div>
              <dt className="font-registre-mono text-[11px] uppercase tracking-wide text-ink-faint">Montant</dt>
              <dd className="mt-1 font-registre-mono text-lg font-semibold text-ink">{formatCentimes(request.montantCentimes)}</dd>
            </div>
            <div>
              <dt className="font-registre-mono text-[11px] uppercase tracking-wide text-ink-faint">Code</dt>
              <dd className="mt-1 break-all font-registre-mono text-sm font-semibold text-ink">{request.codePublic}</dd>
            </div>
          </dl>
          {error && <StatusNotice tone="danger" role="alert" className="mx-5 mb-5">{error}</StatusNotice>}
          <div className="grid gap-3 border-t border-paper-border px-5 py-4 sm:grid-cols-2">
            {isPending ? (
              <>
                <Button type="button" onClick={() => void checkStatus()} disabled={checking || cancelling} className="w-full">
                  {checking ? 'Actualisation…' : 'Actualiser maintenant'}
                </Button>
                <Button type="button" variant="danger" onClick={() => void cancelRequest()} disabled={checking || cancelling} className="w-full">
                  {cancelling ? 'Annulation…' : 'Annuler la demande'}
                </Button>
              </>
            ) : (
              <Button type="button" onClick={resetRequest} className="w-full sm:col-span-2">
                Nouvelle demande
              </Button>
            )}
          </div>
        </div>
      </section>
    )
  }

  return (
    <section aria-labelledby="seller-payment-title">
      <div className="mb-6">
        <h1 id="seller-payment-title" className="text-2xl font-bold text-ink">Encaisser sur un portefeuille</h1>
        <p className="mt-1 text-sm text-ink-muted">Scannez le QR de l’acheteur ou saisissez son code.</p>
      </div>

      <form onSubmit={createRequest} className="space-y-6 rounded-sm border border-paper-border bg-white p-5 sm:p-6">
        {error && <StatusNotice tone="danger" role="alert">{error}</StatusNotice>}
        {scanMessage && <StatusNotice tone="success">{scanMessage}</StatusNotice>}

        <div className="space-y-1.5">
          <Label htmlFor="seller-event">Événement</Label>
          <select
            id="seller-event"
            value={eventId}
            onChange={(event) => setEventId(event.target.value)}
            className="flex h-10 w-full rounded-sm border border-paper-border bg-white px-3 py-2 font-registre text-sm text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stamp/70"
            required
          >
            {events.map((event) => <option key={event.id} value={event.id}>{event.nom}</option>)}
          </select>
          {selectedEvent && (
            <p className="font-registre-mono text-[11px] text-ink-faint">
              {formatPeriodeEvenement(selectedEvent.date_evenement, selectedEvent.date_fin)}
            </p>
          )}
        </div>

        <fieldset className="space-y-4">
          <legend className="font-registre text-sm font-medium text-ink-muted">Portefeuille de l’acheteur</legend>
          <div className="grid grid-cols-2 rounded-sm bg-paper-border/40 p-1" aria-label="Mode de lecture du portefeuille">
            <button
              type="button"
              onClick={() => { switchInputMode('scan'); setError(null); setScanMessage(null) }}
              className={cn(
                'min-h-10 rounded-sm px-3 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stamp/70',
                inputMode === 'scan' ? 'bg-white text-ink shadow-sm' : 'text-ink-faint hover:text-ink-muted',
              )}
              aria-pressed={inputMode === 'scan'}
            >
              Scanner le QR
            </button>
            <button
              type="button"
              onClick={() => { switchInputMode('manual'); setError(null) }}
              className={cn(
                'min-h-10 rounded-sm px-3 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stamp/70',
                inputMode === 'manual' ? 'bg-white text-ink shadow-sm' : 'text-ink-faint hover:text-ink-muted',
              )}
              aria-pressed={inputMode === 'manual'}
            >
              Saisir le code
            </button>
          </div>

          {inputMode === 'scan' ? (
            <div className="space-y-3">
              <div
                id={scannerElementId}
                className="min-h-56 overflow-hidden rounded-sm border border-paper-border bg-ink [&_canvas]:!w-full [&_video]:!w-full"
                aria-label="Aperçu de la caméra"
              />
              <p className="text-xs leading-5 text-ink-faint">
                La caméra fonctionne uniquement en HTTPS. Cadrez le QR en entier et maintenez le téléphone immobile.
              </p>
              {scannerState === 'active' ? (
                <Button type="button" variant="secondary" className="w-full" onClick={() => void stopScanner()}>
                  Arrêter la caméra
                </Button>
              ) : (
                <Button type="button" className="w-full" onClick={() => void startScanner()} disabled={scannerState === 'starting'}>
                  {scannerState === 'starting' ? 'Ouverture de la caméra…' : 'Ouvrir la caméra'}
                </Button>
              )}
            </div>
          ) : (
            <div className="space-y-1.5">
              <Label htmlFor="wallet-code">Code portefeuille</Label>
              <Input
                id="wallet-code"
                value={walletCode}
                onChange={(event) => setWalletCode(event.target.value.toUpperCase())}
                placeholder="Ex : A23BC45DEF67"
                className="h-11 font-registre-mono uppercase tracking-wide"
                autoCapitalize="characters"
                autoComplete="off"
                spellCheck={false}
                maxLength={80}
              />
              <p className="font-registre-mono text-[11px] text-ink-faint">Le code figure sous le QR de l’acheteur.</p>
            </div>
          )}
        </fieldset>

        <div className="space-y-1.5">
          <Label htmlFor="seller-amount">Montant à encaisser</Label>
          <div className="relative">
            <Input
              id="seller-amount"
              type="text"
              inputMode="decimal"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              className="h-12 pr-11 font-registre-mono text-lg font-semibold"
              placeholder="0,00"
            />
            <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 font-registre-mono text-sm text-ink-faint">€</span>
          </div>
        </div>

        <Button type="submit" className="h-11 w-full" disabled={saving || inputMode === 'scan'}>
          {saving ? 'Création de la demande…' : 'Demander la validation'}
        </Button>
      </form>
    </section>
  )
}
