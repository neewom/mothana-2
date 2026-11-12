import { useEffect, type RefObject } from 'react'

/**
 * Révèle les éléments `[data-reveal]` contenus dans `racine` quand ils entrent à l'écran :
 * pose `data-visible="true"` (une seule fois), que les classes de l'élément animent.
 * Sans IntersectionObserver, tout est révélé d'emblée. Les classes de départ (masqué,
 * décalé) doivent être sous `motion-safe:` pour respecter « Réduire les animations ».
 */
export function useReveal(racine: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const el = racine.current
    if (!el) return
    const cibles = Array.from(el.querySelectorAll<HTMLElement>('[data-reveal]'))
    if (typeof IntersectionObserver === 'undefined') {
      cibles.forEach((c) => (c.dataset.visible = 'true'))
      return
    }
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            ;(entry.target as HTMLElement).dataset.visible = 'true'
            observer.unobserve(entry.target)
          }
        }
      },
      { threshold: 0.12, rootMargin: '0px 0px -6% 0px' },
    )
    cibles.forEach((c) => observer.observe(c))
    return () => observer.disconnect()
  }, [racine])
}
