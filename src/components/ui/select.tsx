import * as React from 'react'
import { cn } from '@/lib/utils'

// Select natif (pas de popover custom façon Radix) : le picker natif reste plus adapté
// à l'audience du projet (bénévoles pas toujours technophiles, usage mobile terrain) —
// même choix que l'ancien `.select-field`, juste réhabillé avec nos tokens.
const Select = React.forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement>>(
  ({ className, children, ...props }, ref) => {
    return (
      <div className="relative inline-block">
        <select
          ref={ref}
          className={cn(
            'appearance-none rounded-sm border border-paper-border bg-white py-2 pl-3 pr-8 font-registre text-sm text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stamp/70 disabled:cursor-not-allowed disabled:opacity-50',
            className
          )}
          {...props}
        >
          {children}
        </select>
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 20 20"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.5}
          className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-faint"
          aria-hidden
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 8l4 4 4-4" />
        </svg>
      </div>
    )
  }
)
Select.displayName = 'Select'

export { Select }
