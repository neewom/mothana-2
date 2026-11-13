// Bandeau permanent de la démo, en tête de chaque écran (à la place du bandeau « Environnement de
// test », cf. RecetteBanner). Ligne sombre comme le bandeau du mode Consulter ; « Créer mon espace »
// est le seul élément au cachet. Cibles tactiles de 44 px sous 640 px (32 px au-delà, comme le
// bandeau du mode Consulter).
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { INSCRIPTION_URL } from './messages'
import { resetDemo } from './storage'

export function DemoBanner() {
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [resetting, setResetting] = useState(false)

  async function handleReset() {
    setResetting(true)
    await resetDemo()
  }

  return (
    <div role="region" aria-label="Démo" className="flex flex-wrap items-center gap-x-3 gap-y-1.5 bg-ink px-4 py-2 text-xs text-paper">
      <p className="min-w-0 flex-1 basis-64 leading-snug">
        <span className="font-semibold">Démo :</span> tes saisies restent dans ce navigateur, rien n'est envoyé. Remettre à zéro efface tout.
      </p>
      <div className="flex shrink-0 items-center gap-2">
        <button
          type="button"
          onClick={() => setConfirmOpen(true)}
          className="-ml-2.5 min-h-11 rounded-sm px-2.5 font-medium text-paper/80 underline underline-offset-2 hover:text-paper focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-paper/70 sm:min-h-8"
        >
          Remettre à zéro
        </button>
        <a
          href={INSCRIPTION_URL}
          className="inline-flex min-h-11 items-center rounded-sm bg-stamp px-3 font-medium text-white hover:bg-stamp/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-paper/70 sm:min-h-8"
        >
          Créer mon espace
        </a>
      </div>

      <Dialog open={confirmOpen} onOpenChange={(open) => !resetting && setConfirmOpen(open)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remettre la démo à zéro ?</DialogTitle>
          </DialogHeader>
          <div className="px-6 py-4">
            <DialogDescription>
              Tes saisies sont effacées de ce navigateur et l'association fictive revient à son état de départ.
            </DialogDescription>
          </div>
          <div className="flex justify-end gap-2 border-t border-paper-border px-6 py-4">
            <Button variant="secondary" onClick={() => setConfirmOpen(false)} disabled={resetting}>
              Annuler
            </Button>
            <Button variant="destructive" onClick={handleReset} disabled={resetting}>
              {resetting ? 'Remise à zéro…' : 'Remettre à zéro'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
