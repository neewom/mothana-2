import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

// Pastille de statut. `neutral` pour un état de classement sans urgence (ex. actif/archivé,
// une simple catégorie de filtre) ; `success`/`warning` réservés à un vrai signal opérationnel
// (ex. adhésion expirée) — même logique de réserve que les tokens sémantiques du rollout.
const badgeVariants = cva(
  'inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-0.5 font-registre-mono text-[11px] font-medium',
  {
    variants: {
      variant: {
        neutral: 'bg-paper-border/40 text-ink-faint',
        success: 'bg-success-tint text-success',
        warning: 'bg-warning-tint text-warning',
        stamp: 'bg-stamp/10 text-stamp',
      },
    },
    defaultVariants: {
      variant: 'neutral',
    },
  }
)

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement>, VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant, className }))} {...props} />
}

// eslint-disable-next-line react-refresh/only-export-components -- pattern shadcn standard (variants co-exportés avec le composant)
export { Badge, badgeVariants }
