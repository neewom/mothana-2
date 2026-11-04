import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'

// Page affichée pour toute adresse inconnue (route catch-all), y compris l'ancien
// formulaire public /adhesion/<slug>. Publique, sans appel réseau.
export default function NotFoundPage() {
  // Adresse inexistante : jamais indexée.
  useEffect(() => {
    const meta = document.createElement('meta')
    meta.name = 'robots'
    meta.content = 'noindex, nofollow'
    document.head.appendChild(meta)
    return () => {
      meta.remove()
    }
  }, [])

  return (
    <div className="min-h-dvh bg-paper px-4 py-10 font-registre">
      <div className="mx-auto max-w-xl">
        <div className="rounded-sm border border-paper-border bg-white p-6 text-center">
          <h1 className="text-lg font-semibold text-ink">Page introuvable</h1>
          <p className="mt-2 text-sm text-ink-faint">Cette adresse n'existe pas ou n'est plus disponible.</p>
          <Button asChild variant="secondary" className="mt-5">
            <Link to="/">Retour à l'accueil</Link>
          </Button>
        </div>
      </div>
    </div>
  )
}
