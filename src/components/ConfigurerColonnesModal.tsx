import { COLONNES_DISPONIBLES, type ColonneAdherent } from '../lib/adherentsColonnes'
import { Button } from './ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog'

interface ConfigurerColonnesModalProps {
  open: boolean
  onClose: () => void
  colonnesVisibles: ColonneAdherent[]
  onToggle: (key: ColonneAdherent) => void
}

export default function ConfigurerColonnesModal({ open, onClose, colonnesVisibles, onToggle }: ConfigurerColonnesModalProps) {
  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next) onClose() }}>
      <DialogContent className="max-w-sm" aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle>Colonnes affichées</DialogTitle>
        </DialogHeader>
        <div className="p-6 pt-0">
          <p className="mb-3 font-registre text-sm text-ink-muted">Nom et Prénom sont toujours affichés.</p>
          <div className="space-y-2">
            {COLONNES_DISPONIBLES.map((c) => (
              <label key={c.key} className="flex items-center gap-2 font-registre text-sm text-ink-muted">
                <input
                  type="checkbox"
                  checked={colonnesVisibles.includes(c.key)}
                  onChange={() => onToggle(c.key)}
                  className="h-4 w-4 rounded-sm border-paper-border accent-stamp focus-visible:ring-2 focus-visible:ring-stamp/70"
                />
                {c.label}
              </label>
            ))}
          </div>
        </div>
        <div className="flex justify-end border-t border-paper-border px-6 py-4">
          <Button type="button" variant="secondary" onClick={onClose}>
            Fermer
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
