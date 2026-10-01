import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { useParams } from 'react-router-dom'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { Label } from '../components/ui/label'
import { StatusNotice } from '../components/ui/status-notice'
import { getCanonicalSiteUrl } from '../lib/environment'
import { achatSimuleErrorMessage, isEvenementPublic } from '../lib/evenementAchat'
import { formatCentimes } from '../lib/portefeuilleAcheteur'
import { supabase } from '../lib/supabaseClient'
import { isValidEmail } from '../lib/textFormat'
import type { AchatSimuleResponse, EvenementPublic } from '../types/evenement'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string

type Step = 'details' | 'payment' | 'success'

interface PurchaseErrorPayload {
  error?: string
}

function formatEventDate(value: string): string {
  return new Intl.DateTimeFormat('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(new Date(`${value}T12:00:00`))
}

export default function EvenementAchatPage() {
  const { organisationSlug, evenementSlug } = useParams<{
    organisationSlug: string
    evenementSlug: string
  }>()
  const [event, setEvent] = useState<EvenementPublic | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [amount, setAmount] = useState<number | null>(null)
  const [email, setEmail] = useState('')
  const [step, setStep] = useState<Step>('details')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<AchatSimuleResponse | null>(null)
  const [idempotencyKey] = useState(() => crypto.randomUUID())
  const emailInvalid = email.length > 0 && !isValidEmail(email.trim())

  useEffect(() => {
    let cancelled = false

    async function loadEvent() {
      if (!organisationSlug || !evenementSlug) {
        setNotFound(true)
        setLoading(false)
        return
      }
      const { data, error: rpcError } = await supabase.rpc('get_evenement_public', {
        p_org_slug: organisationSlug,
        p_slug: evenementSlug,
      })
      if (cancelled) return
      const candidate = Array.isArray(data) ? data[0] : data
      if (rpcError || !isEvenementPublic(candidate)) {
        setNotFound(true)
        setLoading(false)
        return
      }
      setEvent(candidate)
      setAmount(candidate.montants_credit_centimes[0] ?? null)
      setLoading(false)
    }

    void loadEvent()
    return () => { cancelled = true }
  }, [evenementSlug, organisationSlug])

  const canContinue = useMemo(
    () => amount !== null && isValidEmail(email.trim()),
    [amount, email],
  )

  function handleContinue(event_: FormEvent) {
    event_.preventDefault()
    setError(null)
    if (!canContinue) {
      setError("Choisissez un montant et renseignez une adresse email valide.")
      return
    }
    setStep('payment')
  }

  async function handleSimulatedPayment() {
    if (!event || amount === null || submitting) return
    setSubmitting(true)
    setError(null)

    try {
      const response = await fetch(`${supabaseUrl}/functions/v1/simuler-achat-evenement`, {
        method: 'POST',
        headers: {
          apikey: supabaseAnonKey,
          Authorization: `Bearer ${supabaseAnonKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          evenement_id: event.id,
          email: email.trim(),
          montant_centimes: amount,
          cle_idempotence: idempotencyKey,
          site_url: getCanonicalSiteUrl(),
        }),
      })
      const payload = await response.json().catch(() => ({})) as PurchaseErrorPayload | AchatSimuleResponse
      if (!response.ok) {
        setError(achatSimuleErrorMessage('error' in payload ? payload.error ?? null : null))
        return
      }

      const purchase = payload as AchatSimuleResponse
      if (!purchase.ok) {
        setError(achatSimuleErrorMessage(null))
        return
      }
      setResult(purchase)
      setStep('success')
    } catch {
      setError(achatSimuleErrorMessage('SERVICE_INDISPONIBLE'))
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <main className="flex min-h-dvh items-center justify-center bg-paper px-4 font-registre text-sm text-ink-faint">
        Chargement de l’événement…
      </main>
    )
  }

  if (notFound || !event) {
    return (
      <main className="flex min-h-dvh items-center justify-center bg-paper px-4 font-registre text-ink">
        <section className="w-full max-w-md rounded-sm border border-paper-border bg-white p-6 text-center">
          <h1 className="text-2xl font-semibold">Événement indisponible</h1>
          <p className="mt-3 text-sm leading-6 text-ink-muted">
            Ce lien n’est pas valide ou l’événement n’est pas ouvert aux achats.
          </p>
        </section>
      </main>
    )
  }

  return (
    <main className="min-h-dvh bg-paper px-4 py-8 font-registre text-ink sm:py-12">
      <div className="mx-auto w-full max-w-xl">
        <header className="mb-6 text-center">
          <p className="text-sm text-ink-faint">{event.nom_organisation}</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">{event.nom}</h1>
          <p className="mt-2 text-sm capitalize text-ink-muted">{formatEventDate(event.date_evenement)}</p>
        </header>

        <StatusNotice tone="warning" heading="Mode démonstration — aucun paiement réel">
          Ce parcours crédite un portefeuille fictivement pour la démonstration du service.
        </StatusNotice>

        {step === 'details' && (
          <form onSubmit={handleContinue} className="mt-5 space-y-6 rounded-sm border border-paper-border bg-white p-5 sm:p-6">
            <fieldset>
              <legend className="text-base font-semibold">Choisissez votre crédit</legend>
              <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
                {event.montants_credit_centimes.map((candidate) => (
                  <button
                    key={candidate}
                    type="button"
                    aria-pressed={amount === candidate}
                    onClick={() => setAmount(candidate)}
                    className={`min-h-12 rounded-sm border px-3 py-2 text-base font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stamp/70 ${
                      amount === candidate
                        ? 'border-stamp bg-stamp/[0.07] text-stamp'
                        : 'border-paper-border bg-white text-ink hover:bg-paper'
                    }`}
                  >
                    {formatCentimes(candidate)}
                  </button>
                ))}
              </div>
            </fieldset>

            <div>
              <Label htmlFor="email">Adresse email</Label>
              <Input
                id="email"
                type="email"
                inputMode="email"
                autoComplete="email"
                required
                value={email}
                onChange={(event_) => setEmail(event_.target.value)}
                aria-invalid={emailInvalid}
                aria-describedby="email-help"
                placeholder="vous@exemple.fr"
                className="mt-1"
              />
              <p id="email-help" className={`mt-1.5 text-xs ${emailInvalid ? 'text-stamp' : 'text-ink-faint'}`}>
                Le lien vers votre portefeuille et son QR code seront envoyés à cette adresse.
              </p>
            </div>

            {error && <StatusNotice tone="danger" role="alert">{error}</StatusNotice>}
            <Button type="submit" className="w-full" disabled={!canContinue}>
              Continuer vers le paiement fictif
            </Button>
          </form>
        )}

        {step === 'payment' && (
          <section className="mt-5 rounded-sm border border-paper-border bg-white p-5 sm:p-6">
            <h2 className="text-xl font-semibold">Paiement fictif</h2>
            <dl className="mt-5 divide-y divide-paper-border border-y border-paper-border text-sm">
              <div className="flex items-center justify-between gap-4 py-3">
                <dt className="text-ink-muted">Crédit choisi</dt>
                <dd className="font-semibold">{amount !== null && formatCentimes(amount)}</dd>
              </div>
              <div className="flex items-center justify-between gap-4 py-3">
                <dt className="text-ink-muted">Email</dt>
                <dd className="break-all text-right">{email.trim()}</dd>
              </div>
              <div className="flex items-center justify-between gap-4 py-3">
                <dt className="text-ink-muted">Montant réellement prélevé</dt>
                <dd className="font-semibold text-success">0,00 €</dd>
              </div>
            </dl>

            <p className="mt-4 text-sm leading-6 text-ink-muted">
              En confirmant, vous simulez le paiement et créez immédiatement le portefeuille de démonstration.
            </p>
            {error && <StatusNotice tone="danger" role="alert" className="mt-4">{error}</StatusNotice>}
            <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <Button type="button" variant="secondary" disabled={submitting} onClick={() => { setError(null); setStep('details') }}>
                Modifier
              </Button>
              <Button type="button" disabled={submitting} onClick={() => void handleSimulatedPayment()}>
                {submitting ? 'Création du portefeuille…' : 'Simuler le paiement'}
              </Button>
            </div>
          </section>
        )}

        {step === 'success' && (
          <section className="mt-5 rounded-sm border border-paper-border bg-white p-5 text-center sm:p-6">
            <StatusNotice tone="success-emphasis" heading="Portefeuille crédité">
              Votre crédit de {amount !== null ? formatCentimes(amount) : ''} est disponible immédiatement.
            </StatusNotice>
            <p className="mt-5 text-sm leading-6 text-ink-muted">
              Un email avec le lien du portefeuille et le PDF QR a été envoyé à <strong className="text-ink">{email.trim()}</strong>.
            </p>
            {result?.portefeuille_url && (
              <Button asChild className="mt-6">
                <a href={result.portefeuille_url}>Ouvrir mon portefeuille</a>
              </Button>
            )}
          </section>
        )}
      </div>
    </main>
  )
}
