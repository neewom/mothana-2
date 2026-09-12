import { useState, useEffect, useMemo } from 'react'
import { supabase } from '../lib/supabaseClient'
import { Button } from './ui/button'
import { Select } from './ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog'

interface RetirerListeModalProps {
  open: boolean
  onClose: () => void
  onRemoved: (tag: string, count: number) => void
  organisationId: string
  selectedAdherents: { id: string; tags: string[] }[]
}

export default function RetirerListeModal({ open, onClose, onRemoved, organisationId, selectedAdherents }: RetirerListeModalProps) {
  const [selectedTag, setSelectedTag] = useState('')
  const [removing, setRemoving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const tagCounts = useMemo(() => {
    const counts = new Map<string, number>()
    for (const a of selectedAdherents) {
      for (const t of a.tags ?? []) {
        counts.set(t, (counts.get(t) ?? 0) + 1)
      }
    }
    return Array.from(counts.entries()).sort((a, b) => a[0].localeCompare(b[0]))
  }, [selectedAdherents])

  useEffect(() => {
    if (open) {
      setSelectedTag('')
      setError(null)
    }
  }, [open])

  async function handleRemove() {
    if (!selectedTag) return
    setRemoving(true)
    setError(null)
    const ids = selectedAdherents.filter((a) => (a.tags ?? []).includes(selectedTag)).map((a) => a.id)
    const { error: err } = await supabase.rpc('remove_adherents_tag', {
      p_organisation_id: organisationId,
      p_adherent_ids: ids,
      p_tag: selectedTag,
    })
    setRemoving(false)
    if (err) {
      setError(err.message)
      return
    }
    onRemoved(selectedTag, ids.length)
    onClose()
  }

  const count = tagCounts.find(([tag]) => tag === selectedTag)?.[1] ?? 0

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next && !removing) onClose() }}>
      <DialogContent className="max-w-sm" aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle>Retirer d'une liste</DialogTitle>
        </DialogHeader>
        <div className="p-6 pt-0">
          {error && (
            <div className="mb-3 rounded-sm border border-stamp/30 bg-stamp/[0.04] px-4 py-3 font-registre text-sm text-stamp">
              {error}
            </div>
          )}
          {tagCounts.length === 0 ? (
            <p className="font-registre text-sm text-ink-faint">Aucun adhérent sélectionné n'appartient à une liste.</p>
          ) : (
            <>
              <p className="mb-3 font-registre text-sm text-ink-muted">
                Choisissez la liste à retirer des {selectedAdherents.length} adhérent{selectedAdherents.length > 1 ? 's' : ''} sélectionné{selectedAdherents.length > 1 ? 's' : ''}.
              </p>
              <Select value={selectedTag} onChange={(e) => setSelectedTag(e.target.value)} className="w-full">
                <option value="">Sélectionner une liste…</option>
                {tagCounts.map(([tag, n]) => (
                  <option key={tag} value={tag}>
                    {tag} ({n})
                  </option>
                ))}
              </Select>
              {selectedTag && (
                <p className="mt-3 font-registre text-sm text-ink-muted">
                  <span className="font-medium text-ink">
                    {count} adhérent{count > 1 ? 's' : ''}
                  </span>{' '}
                  seront retirés de la liste « {selectedTag} ».
                </p>
              )}
            </>
          )}
        </div>
        <div className="flex justify-end gap-3 border-t border-paper-border px-6 py-4">
          <Button type="button" variant="secondary" onClick={onClose} disabled={removing}>
            Annuler
          </Button>
          {tagCounts.length > 0 && (
            <Button type="button" onClick={handleRemove} disabled={!selectedTag || removing}>
              {removing ? 'Retrait…' : 'Retirer'}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
