// Écran d'attente de la démo, affiché par-dessus l'application pendant son démarrage : barre qui
// suit le vrai téléchargement du moteur, étapes nommées, choix du point de départ, carrousel
// « À essayer dans la démo » et, si c'est long, une porte de sortie. Aux visites suivantes (base
// déjà dans le navigateur), version courte, qui n'apparaît qu'au-delà d'un court délai : sur un
// démarrage rapide, elle ne se voit pas.
import { useEffect, useId, useState, useSyncExternalStore } from 'react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { cn } from '@/lib/utils'
import { formatMegabytes } from '../engineDownload'
import { CONTACT_MAILTO } from '@/lib/contact'
import { DEMO_PIN } from '../messages'
import { DemoCarousel } from './DemoCarousel'
import { overallPercent, type BootState, type BootStore, type StartPoint } from './bootState'

type StepStatus = 'done' | 'current' | 'pending'

interface StepView {
  label: string
  detail?: string
  status: StepStatus
}

function openingLabel(start: StartPoint): string {
  return start === 'admin' ? 'Ouverture du tableau de bord' : "Ouverture de l'espace bénévole"
}

function downloadDetail(state: BootState): string | undefined {
  const { loadedBytes, totalBytes } = state.download
  if (loadedBytes === null || totalBytes === null) return undefined
  return `${formatMegabytes(loadedBytes)} Mo sur ${formatMegabytes(totalBytes)}`
}

function steps(state: BootState): StepView[] {
  const order = ['download', 'prepare', 'open'] as const
  const reached = state.phase === 'ready' ? 3 : state.phase === 'error' || state.phase === 'unsupported' ? -1 : order.indexOf(state.phase)
  const status = (i: number): StepStatus => (i < reached ? 'done' : i === reached ? 'current' : 'pending')
  const prepareDetail =
    state.phase === 'prepare' && state.prepareStep === 'schema'
      ? 'création de la base'
      : state.phase === 'prepare' && state.prepareStep === 'seed'
        ? 'donateurs, dons et adhérents fictifs'
        : undefined
  return [
    { label: 'Téléchargement du moteur', detail: reached <= 0 ? downloadDetail(state) : undefined, status: status(0) },
    { label: "Préparation de l'association fictive", detail: prepareDetail, status: status(1) },
    { label: openingLabel(state.start), status: status(2) },
  ]
}

/** Libellé de l'étape en cours, pour la barre (lecteurs d'écran) et l'annonce des changements. */
function currentStepLabel(state: BootState): string {
  const current = steps(state).find((s) => s.status === 'current')
  if (!current) return state.phase === 'ready' ? 'Démo prête' : ''
  return current.detail ? `${current.label} : ${current.detail}` : current.label
}

function StepMarker({ status, n }: { status: StepStatus; n: number }) {
  if (status === 'done') {
    return (
      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-success text-white" aria-hidden="true">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3} className="h-3 w-3">
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 12.5l4.5 4.5L19 7.5" />
        </svg>
      </span>
    )
  }
  return (
    <span
      className={cn(
        'flex h-5 w-5 shrink-0 items-center justify-center rounded-full border font-registre-mono text-[11px]',
        status === 'current' ? 'border-ink bg-ink text-paper' : 'border-paper-border bg-white text-ink-faint',
      )}
      aria-hidden="true"
    >
      {n}
    </span>
  )
}

function StartChoice({ value, disabled, onChange }: { value: StartPoint; disabled: boolean; onChange: (v: StartPoint) => void }) {
  const options: { value: StartPoint; title: string; hint: string }[] = [
    { value: 'admin', title: "Le tableau de bord de l'association", hint: 'Comme un membre du bureau : dons, adhérents, statistiques.' },
    { value: 'benevole', title: 'La saisie bénévole sur téléphone', hint: `Comme un bénévole à une collecte, avec le code ${DEMO_PIN}.` },
  ]
  return (
    <fieldset disabled={disabled} className="min-w-0">
      <legend className="text-sm font-semibold text-ink">Par où commencer ?</legend>
      <div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
        {options.map((o) => (
          <label
            key={o.value}
            className={cn(
              'flex cursor-pointer gap-3 rounded-sm border bg-white p-3 transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-stamp/70 has-[:focus-visible]:ring-offset-1',
              value === o.value ? 'border-stamp' : 'border-paper-border hover:border-ink-faint/50',
              disabled && 'cursor-default opacity-60',
            )}
          >
            <input
              type="radio"
              name="demo-start"
              value={o.value}
              checked={value === o.value}
              onChange={() => onChange(o.value)}
              className="mt-0.5 h-4 w-4 shrink-0 accent-stamp focus-visible:outline-none"
            />
            <span className="min-w-0">
              <span className="block text-sm font-medium text-ink">{o.title}</span>
              <span className="mt-0.5 block text-xs leading-snug text-ink-muted">{o.hint}</span>
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  )
}

interface LoadingScreenProps {
  store: BootStore
  /** Appelé quand l'écran peut disparaître (démo prête et visite en images fermée). */
  onDismiss: () => void
}

export function LoadingScreen({ store, onDismiss }: LoadingScreenProps) {
  const state = useSyncExternalStore(store.subscribe, store.get)
  const [visitOpen, setVisitOpen] = useState(false)
  const titleId = useId()
  const carouselHeadingId = useId()
  const percent = overallPercent(state)
  const stepLabel = currentStepLabel(state)
  const stepName = steps(state).find((s) => s.status === 'current')?.label ?? ''
  const returning = state.returning === true
  const ready = state.phase === 'ready'

  // La démo s'ouvre dès qu'elle est prête, sauf si le visiteur regarde la visite en images :
  // il l'ouvre alors lui-même (bouton dans la fenêtre).
  useEffect(() => {
    if (ready && !visitOpen) onDismiss()
  }, [ready, visitOpen, onDismiss])

  if (state.phase === 'unsupported') {
    const insecure = state.unsupported === 'insecure'
    return (
      <div className="mx-auto flex min-h-full w-full max-w-6xl flex-col px-4 py-6 sm:px-6 sm:py-8 lg:py-12">
        <p className="flex items-baseline gap-2">
          <span className="text-lg font-bold tracking-tight text-ink">Samakan</span>
          <span className="font-registre-mono text-[11px] uppercase tracking-wide text-ink-faint">démo</span>
        </p>
        <div className="mt-6 grid gap-8 sm:mt-8 lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)] lg:gap-12 xl:gap-16">
          <div role="alert" className="min-w-0 space-y-3">
            <h1 className="text-2xl font-bold text-ink">La démo ne peut pas s'ouvrir ici</h1>
            <p className="text-sm text-ink-muted">
              {insecure
                ? "La démo a besoin d'une connexion sécurisée (adresse en https://) pour fonctionner dans ton navigateur. Ouvre-la depuis demo.samakan.fr."
                : "La démo garde tes saisies dans ce navigateur, et il refuse de les stocker : c'est souvent le cas en navigation privée. Ouvre-la dans une fenêtre normale, ou fais la visite en images."}
            </p>
            <div className="flex flex-wrap gap-2 pt-1">
              <Button variant="secondary" className="h-11 sm:h-9" asChild>
                <a href={CONTACT_MAILTO}>Nous contacter</a>
              </Button>
            </div>
          </div>
          <div className="min-w-0">
            <h2 id={carouselHeadingId} className="mb-3 font-registre-mono text-[11px] font-medium uppercase tracking-wide text-ink-faint">
              La visite en images
            </h2>
            <DemoCarousel headingId={carouselHeadingId} />
          </div>
        </div>
      </div>
    )
  }

  if (state.phase === 'error') {
    return (
      <div className="mx-auto flex min-h-full max-w-xl flex-col justify-center px-4 py-10">
        <div role="alert" className="rounded-sm border border-paper-border bg-white p-5">
          <h1 className="text-lg font-semibold text-ink">La démo n'a pas pu démarrer</h1>
          <p className="mt-2 text-sm text-ink-muted">
            Ton navigateur n'a pas réussi à préparer la démo. Recharger la page suffit souvent ; sinon, essaie avec un autre
            navigateur à jour.
          </p>
          {state.error && <p className="mt-2 break-words font-registre-mono text-xs text-ink-faint">{state.error}</p>}
          <div className="mt-4 flex flex-wrap gap-2">
            <Button className="h-11 sm:h-9" onClick={() => location.reload()}>Recharger la page</Button>
            <Button variant="secondary" className="h-11 sm:h-9" asChild>
              <a href={CONTACT_MAILTO}>Nous contacter</a>
            </Button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto flex min-h-full w-full max-w-6xl flex-col px-4 py-6 sm:px-6 sm:py-8 lg:py-12">
      <p className="flex items-baseline gap-2">
        <span className="text-lg font-bold tracking-tight text-ink">Samakan</span>
        <span className="font-registre-mono text-[11px] uppercase tracking-wide text-ink-faint">démo</span>
      </p>

      {/* En grand écran, le contenu se centre dans la hauteur (sinon tout se tasse en haut). */}
      <div
        className={cn(
          'mt-6 grid gap-8 sm:mt-8 lg:my-auto lg:pb-12',
          !returning && 'lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)] lg:gap-12 xl:gap-16',
          returning && 'max-w-xl',
        )}
      >
        <div className="min-w-0 space-y-6">
          <div>
            <h1 id={titleId} className="text-2xl font-bold text-ink">
              {returning ? 'Ouverture de la démo' : 'Préparation de la démo'}
            </h1>
            <p className="mt-1 text-sm text-ink-muted">
              {returning ? 'Tout se passe dans ton navigateur.' : 'Tout se passe dans ton navigateur, la prochaine fois ce sera rapide.'}
            </p>
          </div>

          <div>
            <div className="flex items-baseline justify-between gap-3">
              <span className="text-xs font-medium text-ink-muted">Avancement</span>
              <span className="font-registre-mono text-xs text-ink-muted">{percent} %</span>
            </div>
            <div
              role="progressbar"
              aria-labelledby={titleId}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={percent}
              aria-valuetext={`${percent} % — ${stepLabel}`}
              className="mt-1.5 h-2 overflow-hidden rounded-full bg-paper-border"
            >
              <div
                className="h-full rounded-full bg-ink motion-safe:transition-[width] motion-safe:duration-300 motion-safe:ease-out"
                style={{ width: `${percent}%` }}
              />
            </div>
            {/* Seul le nom de l'étape est annoncé (pas chaque mégaoctet reçu). */}
            <p className="sr-only" aria-live="polite">
              {stepName}
            </p>
            <ol className="mt-4 space-y-2.5">
              {steps(state).map((s, i) => (
                <li key={s.label} className="flex items-start gap-2.5 text-sm" aria-current={s.status === 'current' ? 'step' : undefined}>
                  <StepMarker status={s.status} n={i + 1} />
                  <span className="min-w-0">
                    <span className={cn(s.status === 'pending' ? 'text-ink-faint' : 'text-ink', s.status === 'current' && 'font-medium')}>
                      {s.label}
                    </span>
                    {s.detail && (
                      <span className="block font-registre-mono text-xs text-ink-muted sm:ml-2 sm:inline">{s.detail}</span>
                    )}
                  </span>
                </li>
              ))}
            </ol>
          </div>

          <div aria-live="polite">
            {state.slow && !ready && (
              <div className="rounded-sm border border-paper-border bg-white p-4">
                <p className="text-sm font-semibold text-ink">Connexion lente ?</p>
                <p className="mt-1 text-sm text-ink-muted">
                  Le téléchargement continue. En attendant, fais la visite en images, ou écris-nous pour en parler.
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button className="h-11 sm:h-9" onClick={() => setVisitOpen(true)}>Voir la visite en images</Button>
                  <Button variant="secondary" className="h-11 sm:h-9" asChild>
                    <a href={CONTACT_MAILTO}>Nous contacter</a>
                  </Button>
                </div>
              </div>
            )}
          </div>

          <StartChoice value={state.start} disabled={state.phase === 'open' || ready} onChange={(start) => store.set({ start })} />
        </div>

        {!returning && (
          <div className="min-w-0 max-w-xl lg:max-w-none">
            <h2 id={carouselHeadingId} className="mb-3 font-registre-mono text-[11px] font-medium uppercase tracking-wide text-ink-faint">
              À essayer dans la démo
            </h2>
            <DemoCarousel headingId={carouselHeadingId} />
          </div>
        )}
      </div>

      <Dialog open={visitOpen} onOpenChange={setVisitOpen}>
        <DialogContent fullScreen>
          <DialogHeader>
            <DialogTitle>La visite en images</DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto px-4 py-4 sm:px-6">
            <div className="mx-auto max-w-4xl">
              <DemoCarousel variant="full" />
            </div>
          </div>
          <div className="flex flex-wrap items-center justify-end gap-x-4 gap-y-2 border-t border-paper-border px-4 py-3 sm:px-6">
            <p className="mr-auto text-sm text-ink-muted" aria-live="polite">
              {ready ? 'La démo est prête.' : `La démo continue de se charger (${percent} %).`}
            </p>
            {ready ? (
              <Button className="h-11 sm:h-9" onClick={() => setVisitOpen(false)}>Ouvrir la démo</Button>
            ) : (
              <Button variant="secondary" className="h-11 sm:h-9" asChild>
                <a href={CONTACT_MAILTO}>Nous contacter</a>
              </Button>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
