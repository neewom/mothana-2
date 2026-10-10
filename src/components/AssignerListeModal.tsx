import { useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import TagsInput from './TagsInput'
import { Button } from './ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog'

interface AssignerListeModalProps {
  open: boolean
  onClose: () => void
  onAssigned: (tag: string) => void
  organisationId: string
  adherentIds: string[]
  availableTags: string[]
}

// Affectation en masse d'une liste de diffusion (adherents.tags) aux adhérents
// sélectionnés dans AdherentsPage — une seule requête batch (RPC
// add_adherents_tag), pas de boucle par adhérent.
export default function AssignerListeModal({
  open,
  onClose,
  onAssigned,
  organisationId,
  adherentIds,
  availableTags,
}: AssignerListeModalProps) {
  const [pendingTag, setPendingTag] = useState<string[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const tag = pendingTag[0]
  const creatingEmpty = adherentIds.length === 0

  async function handleAssign() {
    if (!tag) return
    setSaving(true)
    setError(null)

    // La liste peut être créée sans adhérent (registre listes_diffusion, alimenté
    // aussi automatiquement par trigger dès qu'un tag est utilisé — cet insert
    // explicite couvre le cas d'une liste créée vide, sans passer par un adhérent).
    const { error: listeErr } = await supabase
      .from('listes_diffusion')
      .upsert({ organisation_id: organisationId, nom: tag }, { onConflict: 'organisation_id,nom', ignoreDuplicates: true })

    if (listeErr) {
      setError(listeErr.message)
      setSaving(false)
      return
    }

    if (adherentIds.length > 0) {
      const { error: err } = await supabase.rpc('add_adherents_tag', {
        p_organisation_id: organisationId,
        p_adherent_ids: adherentIds,
        p_tag: tag,
      })

      if (err) {
        setError(err.message)
        setSaving(false)
        return
      }
    }

    setSaving(false)
    onAssigned(tag)
    setPendingTag([])
    onClose()
  }

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next && !saving) onClose() }}>
      <DialogContent className="max-w-md" aria-describedby={undefined}>
        <DialogHeader className="shrink-0 pr-12">
          <DialogTitle>{creatingEmpty ? 'Créer une liste' : 'Ajouter à une liste'}</DialogTitle>
        </DialogHeader>

        <div className="flex-1 space-y-4 overflow-y-auto p-6">
          {error && (
            <div role="alert" className="rounded-sm border border-stamp/30 bg-stamp/[0.04] px-4 py-3 text-sm text-stamp">
              {error}
            </div>
          )}

          <p className="text-sm text-ink-muted">
            {creatingEmpty
              ? "Aucun adhérent sélectionné : la liste sera créée vide, vous pourrez lui affecter des adhérents plus tard."
              : `${adherentIds.length} adhérent${adherentIds.length > 1 ? 's' : ''} sélectionné${adherentIds.length > 1 ? 's' : ''}. Choisissez une liste existante ou créez-en une nouvelle.`}
          </p>

          <TagsInput
            tags={pendingTag}
            onChange={(tags) => setPendingTag(tags.length > 0 ? [tags[tags.length - 1]] : [])}
            availableTags={availableTags}
            placeholder="Nom de la liste, puis Entrée…"
          />
        </div>

        <div className="flex shrink-0 justify-end gap-3 border-t border-paper-border bg-white px-6 py-4">
          <Button type="button" variant="secondary" onClick={onClose} disabled={saving}>
            Annuler
          </Button>
          <Button type="button" onClick={handleAssign} disabled={!tag || saving}>
            {saving ? 'Enregistrement…' : creatingEmpty ? 'Créer' : 'Ajouter'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
