import { Link } from 'react-router-dom'
import { cn } from '@/lib/utils'

/** Barre du haut des pages publiques du site (landing, pages légales). */
export default function SiteHeader({ className }: { className?: string }) {
  return (
    <header className={cn('relative z-10', className)}>
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:h-20 sm:px-6">
        <Link
          to="/"
          className="rounded-sm text-xl font-bold tracking-tight text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stamp/70 focus-visible:ring-offset-2"
        >
          Samakan
        </Link>
        <Link
          to="/login"
          className="inline-flex h-10 items-center rounded-sm border border-stamp px-4 text-sm font-medium text-stamp transition-colors hover:bg-stamp/[0.06] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stamp/70 focus-visible:ring-offset-1"
        >
          Se connecter
        </Link>
      </div>
    </header>
  )
}
