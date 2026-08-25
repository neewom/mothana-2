import { useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import Modal from './Modal'
import TagsInput from './TagsInput'

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

  if (!open) return null

  const tag = pendingTag[0]

  async function handleAssign() {
    if (!tag) return
    setSaving(true)
    setError(null)

    const { error: err } = await supabase.rpc('add_adherents_tag', {
      p_organisation_id: organisationId,
      p_adherent_ids: adherentIds,
      p_tag: tag,
    })

    setSaving(false)

    if (err) {
      setError(err.message)
      return
    }

    onAssigned(tag)
    setPendingTag([])
    onClose()
  }

  return (
    <Modal open={open} onClose={onClose} maxWidthClassName="max-w-md" labelledBy="assigner-liste-title">
      <div className="border-b border-slate-200 px-6 py-4">
        <h2 id="assigner-liste-title" className="text-lg font-semibold text-slate-900">
          Ajouter à une liste
        </h2>
      </div>

      <div className="space-y-4 p-6">
        {error && <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

        {adherentIds.length === 0 && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            Sélectionnez d'abord des adhérents (cases à cocher) avant d'ajouter une liste.
          </div>
        )}

        <p className="text-sm text-slate-600">
          {adherentIds.length} adhérent{adherentIds.length > 1 ? 's' : ''} sélectionné{adherentIds.length > 1 ? 's' : ''}. Choisissez une liste existante ou créez-en une nouvelle.
        </p>

        <TagsInput
          tags={pendingTag}
          onChange={(tags) => setPendingTag(tags.length > 0 ? [tags[tags.length - 1]] : [])}
          availableTags={availableTags}
          placeholder="Nom de la liste, puis Entrée…"
        />
      </div>

      <div className="flex shrink-0 justify-end gap-3 rounded-b-2xl border-t border-slate-200 bg-white px-6 py-4">
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
        >
          Annuler
        </button>
        <button
          type="button"
          onClick={handleAssign}
          disabled={!tag || saving || adherentIds.length === 0}
          className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-60"
        >
          {saving ? 'Ajout…' : 'Ajouter'}
        </button>
      </div>
    </Modal>
  )
}
