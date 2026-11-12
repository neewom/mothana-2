import { cn } from '../lib/utils'

interface PageLoaderProps {
  /** `screen` : page entière (avant qu'un layout soit chargé) ; `content` : zone de contenu d'un layout. */
  variant?: 'screen' | 'content'
}

/** Indicateur de chargement d'une page différée (même spinner que la connexion). */
export default function PageLoader({ variant = 'screen' }: PageLoaderProps) {
  return (
    <div
      role="status"
      aria-label="Chargement"
      className={cn(
        'flex items-center justify-center',
        variant === 'screen' ? 'min-h-dvh bg-paper' : 'py-16',
      )}
    >
      <div className="h-10 w-10 animate-spin rounded-full border-4 border-stamp border-t-transparent" />
    </div>
  )
}
