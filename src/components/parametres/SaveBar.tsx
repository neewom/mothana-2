import { cn } from '../../lib/utils'
import { Button } from '../ui/button'

interface SaveBarProps {
  dirty: boolean
  saving: boolean
  success: boolean
  error: string | null
  /** Rétablit les valeurs enregistrées. */
  onReset: () => void
  /** Le bouton est de type submit : la page l'enveloppe dans son <form>. */
  submitLabel?: string
}

/**
 * Pied de page de formulaire des Paramètres : un seul « Enregistrer les modifications » par page
 * (les actions immédiates — PIN, assets, modèles — restent dans leurs sections).
 */
export default function SaveBar({ dirty, saving, success, error, onReset, submitLabel = 'Enregistrer les modifications' }: SaveBarProps) {
  return (
    // Collée en bas seulement quand il y a quelque chose à enregistrer ou à signaler : au repos,
    // elle reste en fin de page pour ne pas masquer le formulaire (surtout sur mobile).
    <div
      className={cn(
        '-mx-6 flex flex-wrap items-center justify-end gap-3 border-t border-paper-border px-6 py-3',
        dirty || saving || error ? 'sticky bottom-0 z-10 bg-white/95 backdrop-blur-sm' : 'bg-transparent'
      )}
    >
      <p className="mr-auto text-sm" aria-live="polite">
        {error ? (
          <span className="text-stamp">{error}</span>
        ) : success ? (
          <span className="text-success">Modifications enregistrées</span>
        ) : dirty ? (
          <span className="text-ink-faint">Modifications non enregistrées</span>
        ) : null}
      </p>
      <Button type="button" variant="secondary" disabled={!dirty || saving} onClick={onReset}>
        Annuler
      </Button>
      <Button type="submit" disabled={!dirty || saving}>
        {saving ? 'Enregistrement…' : submitLabel}
      </Button>
    </div>
  )
}
