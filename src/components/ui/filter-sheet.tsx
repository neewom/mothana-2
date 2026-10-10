import * as React from 'react'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from './dialog'
import { Button } from './button'

// Tiroir de filtres d'une page de liste (gabarit, DESIGN.md › Page de liste) : panneau à droite
// en desktop, plein écran en mobile. Les champs travaillent sur un brouillon tenu par la page ;
// « Appliquer » le valide et ferme, « Réinitialiser » vide le brouillon.
interface FilterSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title?: string
  description?: string
  onApply: () => void
  onReset: () => void
  children: React.ReactNode
}

export function FilterSheet({ open, onOpenChange, title = 'Filtres', description, onApply, onReset, children }: FilterSheetProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="left-auto right-0 top-0 h-dvh max-h-dvh w-full max-w-none translate-x-0 translate-y-0 rounded-none border-y-0 border-r-0 sm:max-w-sm data-[state=closed]:zoom-out-100 data-[state=open]:zoom-in-100">
        <DialogHeader className="shrink-0 pr-12">
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription className="mt-0.5">{description}</DialogDescription>}
        </DialogHeader>
        <form
          className="flex min-h-0 flex-1 flex-col"
          onSubmit={(e) => {
            e.preventDefault()
            onApply()
          }}
        >
          <div className="flex-1 space-y-4 overflow-y-auto px-6 py-5">{children}</div>
          <div className="flex shrink-0 gap-2 border-t border-paper-border bg-white px-6 py-4">
            <Button type="button" variant="secondary" className="flex-1" onClick={onReset}>
              Réinitialiser
            </Button>
            <Button type="submit" className="flex-1">
              Appliquer
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
