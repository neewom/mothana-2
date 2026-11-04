import { Dialog, DialogContent } from './ui/dialog'
import { Button } from './ui/button'
import { estimerDureeLot, formatDureeApprox } from '../lib/recusLot'

export interface DonateurExclu {
  id: string
  nom: string
  raison: string
}

interface RecusLotRecapitulatifDialogProps {
  open: boolean
  onClose: () => void
  onConfirm: () => void
  annee: number
  /** Reçus que le lot va générer (même règle que recus_manquants_lot). */
  nbAGenerer: number
  exclus: DonateurExclu[]
  lancement: boolean
  error: string | null
}

/** Récapitulatif avant lancement d'un lot de génération : nombre de reçus, donateurs exclus et raison. */
export default function RecusLotRecapitulatifDialog({
  open, onClose, onConfirm, annee, nbAGenerer, exclus, lancement, error,
}: RecusLotRecapitulatifDialogProps) {
  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next && !lancement) onClose() }}>
      <DialogContent className="max-w-lg" aria-describedby={undefined}>
        <div className="shrink-0 border-b border-paper-border px-6 py-4 pr-12">
          <h2 className="font-registre text-lg font-semibold text-ink">Générer les reçus manquants {annee}</h2>
        </div>
        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-6 py-4 font-registre text-sm text-ink-muted">
          <p>
            <span className="font-semibold text-ink">
              {nbAGenerer} reçu{nbAGenerer > 1 ? 's vont' : ' va'} être généré{nbAGenerer > 1 ? 's' : ''}
            </span>
            {exclus.length > 0 && (
              <>
                , {exclus.length} donateur{exclus.length > 1 ? 's' : ''} exclu{exclus.length > 1 ? 's' : ''} car
                {exclus.length > 1 ? ' leur fiche est incomplète' : ' sa fiche est incomplète'}
              </>
            )}
            .
          </p>
          <p>
            Les numéros sont attribués dans l'ordre alphabétique des donateurs. La génération se fait sur le serveur,
            par paquets ({formatDureeApprox(estimerDureeLot(nbAGenerer))}) : vous pouvez fermer cette page et revenir suivre l'avancement.
          </p>
          {exclus.length > 0 && (
            <div>
              <p className="font-registre-mono text-[11px] font-medium uppercase tracking-wide text-ink-faint">
                Donateurs exclus
              </p>
              <ul className="mt-2 max-h-64 divide-y divide-paper-border overflow-y-auto rounded-sm border border-paper-border bg-white">
                {exclus.map((e) => (
                  <li key={e.id} className="px-3 py-2">
                    <p className="font-medium text-ink">{e.nom}</p>
                    <p className="mt-0.5 text-xs text-warning">{e.raison}</p>
                  </li>
                ))}
              </ul>
              <p className="mt-2 text-xs">
                Complétez leur fiche depuis la liste (clic sur le donateur), puis relancez la génération.
              </p>
            </div>
          )}
          {error && (
            <p className="rounded-sm border border-stamp/30 bg-stamp/[0.04] px-3 py-2 text-stamp" role="alert">{error}</p>
          )}
        </div>
        <div className="flex shrink-0 justify-end gap-3 border-t border-paper-border px-6 py-4">
          <Button type="button" variant="secondary" onClick={onClose} disabled={lancement}>
            Annuler
          </Button>
          <Button type="button" onClick={onConfirm} disabled={lancement || nbAGenerer === 0}>
            {lancement ? 'Lancement…' : 'Lancer la génération'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
