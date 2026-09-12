import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabaseClient'
import ScrollShadowX from './ScrollShadowX'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from './ui/table'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog'

interface ListeRow {
  nom: string
  nombre_adherents: number
}

interface GererListesModalProps {
  open: boolean
  onClose: () => void
  onChanged: () => void
  organisationId: string
}

type ConfirmAction = { type: 'vider' | 'supprimer'; nom: string; nombreAdherents: number } | null

export default function GererListesModal({ open, onClose, onChanged, organisationId }: GererListesModalProps) {
  const [listes, setListes] = useState<ListeRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [renamingNom, setRenamingNom] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState('')
  const [renaming, setRenaming] = useState(false)
  const [confirmAction, setConfirmAction] = useState<ConfirmAction>(null)
  const [actionLoading, setActionLoading] = useState(false)

  const fetchListes = useCallback(async () => {
    if (!organisationId) return
    setLoading(true)
    const { data } = await supabase.rpc('list_listes_diffusion_avec_compte', { p_organisation_id: organisationId })
    setListes((data ?? []) as ListeRow[])
    setLoading(false)
  }, [organisationId])

  useEffect(() => {
    if (open) {
      setError(null)
      setRenamingNom(null)
      setConfirmAction(null)
      fetchListes()
    }
  }, [open, fetchListes])

  function startRename(nom: string) {
    setRenamingNom(nom)
    setRenameValue(nom)
    setError(null)
  }

  async function confirmRename(ancienNom: string) {
    if (renamingNom !== ancienNom) return
    const nouveauNom = renameValue.trim()
    if (!nouveauNom || nouveauNom === ancienNom) {
      setRenamingNom(null)
      return
    }
    setRenaming(true)
    setError(null)
    const { error: err } = await supabase.rpc('renommer_liste_diffusion', {
      p_organisation_id: organisationId,
      p_ancien_nom: ancienNom,
      p_nouveau_nom: nouveauNom,
    })
    setRenaming(false)
    setRenamingNom(null)
    if (err) {
      setError(err.code === '23505' ? 'Ce nom existe déjà.' : err.message)
      return
    }
    await fetchListes()
    onChanged()
  }

  async function handleConfirmAction() {
    if (!confirmAction) return
    setActionLoading(true)
    setError(null)
    const rpc = confirmAction.type === 'vider' ? 'vider_liste_diffusion' : 'supprimer_liste_diffusion'
    const { error: err } = await supabase.rpc(rpc, {
      p_organisation_id: organisationId,
      p_nom: confirmAction.nom,
    })
    setActionLoading(false)
    if (err) {
      setError(err.message)
      return
    }
    setConfirmAction(null)
    await fetchListes()
    onChanged()
  }

  return (
    <>
      <Dialog open={open} onOpenChange={(next) => { if (!next) onClose() }}>
        <DialogContent className="max-w-lg" aria-describedby={undefined}>
          <DialogHeader>
            <DialogTitle>Gérer les listes</DialogTitle>
          </DialogHeader>
          <div className="flex max-h-[70vh] flex-col overflow-hidden p-6 pt-0">
            {error && (
              <div className="mb-3 rounded-sm border border-stamp/30 bg-stamp/[0.04] px-4 py-3 font-registre text-sm text-stamp">
                {error}
              </div>
            )}
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <div className="h-6 w-6 animate-spin rounded-full border-4 border-stamp border-t-transparent" />
              </div>
            ) : listes.length === 0 ? (
              <p className="font-registre text-sm text-ink-faint">Aucune liste pour le moment.</p>
            ) : (
              <div className="flex-1 overflow-y-auto">
                <ScrollShadowX>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Nom</TableHead>
                        <TableHead>Adhérents</TableHead>
                        <TableHead />
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {listes.map((l) => (
                        <TableRow key={l.nom}>
                          <TableCell className="font-medium text-ink">
                            {renamingNom === l.nom ? (
                              <Input
                                autoFocus
                                value={renameValue}
                                onChange={(e) => setRenameValue(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') confirmRename(l.nom)
                                  if (e.key === 'Escape') setRenamingNom(null)
                                }}
                                onBlur={() => confirmRename(l.nom)}
                                disabled={renaming}
                                className="h-8"
                              />
                            ) : (
                              <button type="button" onClick={() => startRename(l.nom)} className="hover:underline">
                                {l.nom}
                              </button>
                            )}
                          </TableCell>
                          <TableCell className="text-ink-muted">{l.nombre_adherents}</TableCell>
                          <TableCell>
                            <div className="flex justify-end gap-2">
                              <Button
                                type="button"
                                variant="secondary"
                                onClick={() => setConfirmAction({ type: 'vider', nom: l.nom, nombreAdherents: l.nombre_adherents })}
                                disabled={l.nombre_adherents === 0}
                              >
                                Vider
                              </Button>
                              <Button
                                type="button"
                                variant="secondary"
                                onClick={() => setConfirmAction({ type: 'supprimer', nom: l.nom, nombreAdherents: l.nombre_adherents })}
                              >
                                Supprimer
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </ScrollShadowX>
              </div>
            )}
            <div className="mt-5 flex justify-end">
              <Button type="button" variant="secondary" onClick={onClose}>
                Fermer
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!confirmAction} onOpenChange={(next) => { if (!next && !actionLoading) setConfirmAction(null) }}>
        <DialogContent className="max-w-sm" aria-describedby={undefined}>
          <div className="p-6">
            <h2 className="font-registre text-lg font-semibold text-ink">
              {confirmAction?.type === 'vider' ? 'Vider la liste' : 'Supprimer la liste'}
            </h2>
            <p className="mt-2 font-registre text-sm text-ink-muted">
              <span className="font-medium text-ink">
                {confirmAction?.nombreAdherents ?? 0} adhérent{(confirmAction?.nombreAdherents ?? 0) > 1 ? 's' : ''}
              </span>{' '}
              seront retirés de la liste « {confirmAction?.nom} »{confirmAction?.type === 'supprimer' ? ', qui sera supprimée' : ''}.
            </p>
            <div className="mt-5 flex justify-end gap-3">
              <Button type="button" variant="secondary" onClick={() => setConfirmAction(null)} disabled={actionLoading}>
                Annuler
              </Button>
              <Button type="button" onClick={handleConfirmAction} disabled={actionLoading}>
                {actionLoading ? 'Traitement…' : 'Confirmer'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
