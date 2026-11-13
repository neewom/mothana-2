import { cn } from '../../lib/utils'

/** Coche des pages publiques d'inscription (étapes franchies, réassurance, succès). */
export default function IconeCoche({ className }: { className?: string }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" className={cn('h-5 w-5 flex-shrink-0', className)}>
      <path d="m5.5 12.5 4.25 4.25 8.75-9.5" />
    </svg>
  )
}
