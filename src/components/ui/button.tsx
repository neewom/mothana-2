import * as React from 'react'
import { Slot } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

// Boutons du chantier de reconstruction (direction "carnet tamponné x registre").
// Convention volontaire : le contour (outline) porte l'action de marque, le remplissage
// plein porte le danger — les deux partagent la même encre (stamp) sans ambiguïté grâce
// au poids visuel, pas besoin d'une deuxième couleur rouge.
const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-sm font-registre text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stamp/70 focus-visible:ring-offset-1 disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        default: 'border border-stamp text-stamp bg-transparent hover:bg-stamp/[0.06]',
        secondary: 'border border-paper-border text-ink-muted bg-white hover:bg-paper',
        ghost: 'text-ink-muted hover:bg-paper-border/40',
        destructive: 'bg-stamp text-white hover:bg-stamp/90',
        // Action positive (ex. ratifier une demande) — même logique outline que `default`,
        // encre `success` réservée à la signalisation d'état plutôt qu'à la marque.
        success: 'border border-success text-success bg-transparent hover:bg-success/[0.06]',
      },
      size: {
        default: 'h-9 px-3.5',
        sm: 'h-8 px-3 text-xs',
        icon: 'h-9 w-9',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button'
    return (
      <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />
    )
  }
)
Button.displayName = 'Button'

// eslint-disable-next-line react-refresh/only-export-components -- pattern shadcn standard (variants co-exportés avec le composant)
export { Button, buttonVariants }
