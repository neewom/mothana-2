import * as React from 'react'
import * as DialogPrimitive from '@radix-ui/react-dialog'
import { cn } from '@/lib/utils'

const Dialog = DialogPrimitive.Root
const DialogTrigger = DialogPrimitive.Trigger
const DialogPortal = DialogPrimitive.Portal
const DialogClose = DialogPrimitive.Close

const DialogOverlay = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Overlay
    ref={ref}
    className={cn(
      'fixed inset-0 z-50 bg-ink/40 ease-out data-[state=open]:duration-200 data-[state=closed]:duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0',
      className
    )}
    {...props}
  />
))
DialogOverlay.displayName = DialogPrimitive.Overlay.displayName

interface DialogContentProps extends React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content> {
  /** Occupe tout l'écran (pas de centrage/max-w/radius) — pour un contenu qui a besoin de
   * toute la largeur disponible (ex. éditeur de template avec panneau code + aperçu), avec
   * un toggle utilisateur pour y entrer/sortir plutôt qu'un choix fixe à l'ouverture. */
  fullScreen?: boolean
  /** `right` : tiroir pleine hauteur contre le bord droit (tiroir de filtres), qui glisse au
   * lieu d'apparaître sur place. Ignoré en `fullScreen`. */
  placement?: 'center' | 'right'
}

// DESIGN.md › Mouvement. Les keyframes de tailwindcss-animate posent leur propre `transform`
// (translate3d + scale), qui remplace celui de la modale pendant l'animation : sans les
// variables à -50 %, la modale centrée part de son coin haut-gauche placé au centre de l'écran
// et glisse en diagonale. Durée et variables sous les mêmes variantes `data-[state]` que
// `animate-in`/`animate-out`, qui les remettent à leur valeur par défaut (150 ms, 0).
// Avec « réduire les animations », fondu seul.
const MOTION = 'ease-out data-[state=open]:duration-200 data-[state=closed]:duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out'
const FADE = 'data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0'
const CONTENT_CLASSES = {
  fullScreen: `fixed inset-0 h-dvh w-screen ${MOTION} ${FADE}`,
  center: `fixed left-1/2 top-1/2 max-h-[90dvh] w-full max-w-sm -translate-x-1/2 -translate-y-1/2 rounded-sm border border-paper-border shadow-lg ${MOTION} ${FADE} data-[state=open]:[--tw-enter-translate-x:-50%] data-[state=open]:[--tw-enter-translate-y:-50%] data-[state=closed]:[--tw-exit-translate-x:-50%] data-[state=closed]:[--tw-exit-translate-y:-50%] data-[state=closed]:motion-safe:zoom-out-95 data-[state=open]:motion-safe:zoom-in-95`,
  right: `fixed inset-y-0 right-0 h-dvh w-full border-l border-paper-border shadow-lg sm:max-w-sm ${MOTION} data-[state=closed]:motion-safe:slide-out-to-right data-[state=open]:motion-safe:slide-in-from-right data-[state=closed]:motion-reduce:fade-out-0 data-[state=open]:motion-reduce:fade-in-0`,
}

const DialogContent = React.forwardRef<React.ElementRef<typeof DialogPrimitive.Content>, DialogContentProps>(
  ({ className, children, onOpenAutoFocus, fullScreen = false, placement = 'center', ...props }, ref) => {
  const closeRef = React.useRef<HTMLButtonElement>(null)
  return (
    <DialogPortal>
      <DialogOverlay />
      <DialogPrimitive.Content
        ref={ref}
        // Focus par défaut de Radix sur le premier élément focusable (souvent un champ de
        // formulaire) — déplacé vers le bouton Fermer, moins intrusif à l'ouverture qu'un
        // input déjà en édition (demande explicite utilisateur, généralisée à toutes les
        // modales via cette primitive partagée).
        onOpenAutoFocus={(e) => {
          e.preventDefault()
          closeRef.current?.focus()
          onOpenAutoFocus?.(e)
        }}
        className={cn(
          // flex-col + overflow-hidden (pas de scroll sur la coquille elle-même) : le contenu
          // compose son propre header/body/footer (shrink-0 / flex-1 overflow-y-auto / shrink-0)
          // — nécessaire pour un formulaire long comme AdherentModal (header et pied de page
          // fixes, seul le corps scrolle), et ça marche aussi bien pour un contenu court qui
          // ne remplit jamais max-h.
          'z-50 flex flex-col gap-0 overflow-hidden bg-paper font-registre',
          CONTENT_CLASSES[fullScreen ? 'fullScreen' : placement],
          className
        )}
        {...props}
      >
        {children}
        <DialogPrimitive.Close
          ref={closeRef}
          className="absolute right-4 top-4 text-ink-faint transition-colors hover:text-stamp focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stamp/70 rounded-sm"
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="h-5 w-5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
          <span className="sr-only">Fermer</span>
        </DialogPrimitive.Close>
      </DialogPrimitive.Content>
    </DialogPortal>
  )
})
DialogContent.displayName = DialogPrimitive.Content.displayName

function DialogHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn('border-b border-paper-border px-6 py-4', className)} {...props} />
  )
}

const DialogTitle = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Title
    ref={ref}
    className={cn('text-lg font-semibold text-ink', className)}
    {...props}
  />
))
DialogTitle.displayName = DialogPrimitive.Title.displayName

const DialogDescription = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Description
    ref={ref}
    className={cn('text-sm text-ink-muted', className)}
    {...props}
  />
))
DialogDescription.displayName = DialogPrimitive.Description.displayName

export {
  Dialog,
  DialogTrigger,
  DialogPortal,
  DialogClose,
  DialogOverlay,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
}
