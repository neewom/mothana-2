// Carrousel « À essayer dans la démo ». Défilement automatique seulement si le visiteur n'a pas
// demandé moins d'animations, en pause au survol, au focus et sur demande (bouton) ; flèches du
// clavier dans tout le carrousel. Seule l'image affichée est chargée : le carrousel ne dispute pas
// la bande passante au téléchargement du moteur.
import { useEffect, useId, useState, type KeyboardEvent } from 'react'
import { cn } from '@/lib/utils'
import { SLIDES } from './slides'

const AUTO_ADVANCE_MS = 7000

function usePrefersReducedMotion(): boolean {
  const query = '(prefers-reduced-motion: reduce)'
  const [reduced, setReduced] = useState(() => window.matchMedia?.(query).matches ?? false)
  useEffect(() => {
    const mql = window.matchMedia?.(query)
    if (!mql) return
    const onChange = () => setReduced(mql.matches)
    mql.addEventListener('change', onChange)
    return () => mql.removeEventListener('change', onChange)
  }, [])
  return reduced
}

const controlClass =
  'inline-flex h-11 w-11 items-center justify-center rounded-sm border border-paper-border bg-white text-ink-muted transition-colors hover:bg-paper hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stamp/70 focus-visible:ring-offset-1 sm:h-9 sm:w-9'

function Chevron({ direction }: { direction: 'left' | 'right' }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} className="h-4 w-4" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d={direction === 'left' ? 'M15 18l-6-6 6-6' : 'M9 6l6 6-6 6'} />
    </svg>
  )
}

interface DemoCarouselProps {
  /** `full` : visite en images (grandes captures, sans défilement automatique). */
  variant?: 'inline' | 'full'
  /** Titre visible du carrousel (`inline`) ; en `full`, le titre est celui de la fenêtre. */
  headingId?: string
}

export function DemoCarousel({ variant = 'inline', headingId }: DemoCarouselProps) {
  const [index, setIndex] = useState(0)
  const [userPaused, setUserPaused] = useState(false)
  const [hovered, setHovered] = useState(false)
  const [focused, setFocused] = useState(false)
  const reducedMotion = usePrefersReducedMotion()
  const slideId = useId()

  const autoplayAllowed = variant === 'inline' && !reducedMotion
  const playing = autoplayAllowed && !userPaused && !hovered && !focused
  const count = SLIDES.length
  const go = (delta: number) => setIndex((i) => (i + delta + count) % count)

  useEffect(() => {
    if (!playing) return
    const t = window.setTimeout(() => setIndex((i) => (i + 1) % count), AUTO_ADVANCE_MS)
    return () => window.clearTimeout(t)
  }, [playing, index, count])

  function onKeyDown(e: KeyboardEvent) {
    if (e.key === 'ArrowLeft') {
      e.preventDefault()
      go(-1)
    } else if (e.key === 'ArrowRight') {
      e.preventDefault()
      go(1)
    }
  }

  const slide = SLIDES[index]
  const full = variant === 'full'

  return (
    <section
      aria-roledescription="carrousel"
      aria-labelledby={headingId}
      aria-label={headingId ? undefined : 'À essayer dans la démo'}
      onKeyDown={onKeyDown}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onFocus={() => setFocused(true)}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setFocused(false)
      }}
      className="min-w-0"
    >
      {/* Annoncé seulement quand le défilement est arrêté : sinon chaque changement automatique serait lu. */}
      <div
        id={slideId}
        aria-live={playing ? 'off' : 'polite'}
        role="group"
        aria-roledescription="diapositive"
        aria-label={`${index + 1} sur ${count} : ${slide.title}`}
      >
        <div
          className={cn(
            'overflow-hidden rounded-sm border border-paper-border bg-paper-border-muted',
            full ? 'aspect-[4/3] sm:aspect-[16/10]' : 'aspect-[16/10]',
          )}
        >
          <img
            key={slide.src}
            src={slide.src}
            srcSet={slide.srcSet}
            sizes={full ? '(min-width: 1024px) 960px, 100vw' : '(min-width: 1024px) 520px, 100vw'}
            alt={slide.alt}
            decoding="async"
            fetchPriority="high"
            className={cn('h-full w-full', slide.portrait ? 'object-contain' : 'object-cover object-left-top')}
          />
        </div>
        <div className={cn('mt-3', full ? 'min-h-[4.5rem]' : 'min-h-[5.25rem] sm:min-h-[4.5rem]')}>
          <p className="font-semibold text-ink">{slide.title}</p>
          <p className="mt-0.5 text-sm text-ink-muted">{slide.action}</p>
        </div>
      </div>

      <div className="mt-2 flex items-center gap-2">
        <button type="button" onClick={() => go(-1)} aria-controls={slideId} className={controlClass}>
          <Chevron direction="left" />
          <span className="sr-only">Visuel précédent</span>
        </button>
        <button type="button" onClick={() => go(1)} aria-controls={slideId} className={controlClass}>
          <Chevron direction="right" />
          <span className="sr-only">Visuel suivant</span>
        </button>
        <span className="ml-1 font-registre-mono text-xs text-ink-faint" aria-hidden="true">
          {index + 1} / {count}
        </span>
        {autoplayAllowed && (
          <button
            type="button"
            onClick={() => setUserPaused((p) => !p)}
            className="ml-auto inline-flex min-h-11 items-center rounded-sm px-2 text-sm text-ink-muted underline-offset-2 hover:text-ink hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stamp/70 sm:min-h-9"
          >
            {userPaused ? 'Reprendre le défilement' : 'Arrêter le défilement'}
          </button>
        )}
      </div>
    </section>
  )
}
