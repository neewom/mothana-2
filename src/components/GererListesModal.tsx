import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabaseClient'
import { useToast } from '../hooks/useToast'
import Toast from './Toast'
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

type ConfirmAction = { type: 'vider' | 'supprimer'; nom: string } | null

interface ConfirmAdherent {
  id: string
  nom: string
  prenom: string | null
}

export default function GererListesModal({ open, onClose, onChanged, organisationId }: GererListesModalProps) {
  const { toast, showToast, dismissToast } = useToast()
  const [listes, setListes] = useState<ListeRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [renamingNom, setRenamingNom] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState('')
  const [renaming, setRenaming] = useState(false)
  const [confirmAction, setConfirmAction] = useState<ConfirmAction>(null)
  const [confirmAdherents, setConfirmAdherents] = useState<ConfirmAdherent[]>([])
  const [confirmLoading, setConfirmLoading] = useState(false)
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
    showToast(`Liste renommée en « ${nouveauNom} »`)
    await fetchListes()
    onChanged()
  }

  async function openConfirm(type: 'vider' | 'supprimer', nom: string) {
    setConfirmAction({ type, nom })
    setConfirmAdherents([])
    setConfirmLoading(true)
    const { data } = await supabase
      .from('adherents')
      .select('id, nom, prenom')
      .eq('organisation_id', organisationId)
      .contains('tags', [nom])
      .order('nom')
    setConfirmAdherents((data ?? []) as ConfirmAdherent[])
    setConfirmLoading(false)
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
    const count = confirmAdherents.length
    showToast(
      confirmAction.type === 'vider'
        ? `${count} adhérent${count > 1 ? 's' : ''} retiré${count > 1 ? 's' : ''} de la liste « ${confirmAction.nom} »`
        : `Liste « ${confirmAction.nom} » supprimée`,
    )
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
                        <TableHead>Liste</TableHead>
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
                            <p className="mt-0.5 font-registre text-xs text-ink-faint">
                              {l.nombre_adherents} adhérent{l.nombre_adherents > 1 ? 's' : ''}
                            </p>
                          </TableCell>
                          <TableCell>
                            <div className="flex justify-end gap-1.5">
                              <Button
                                type="button"
                                variant="secondary"
                                size="icon"
                                title="Vider la liste"
                                aria-label={`Vider la liste ${l.nom}`}
                                onClick={() => openConfirm('vider', l.nom)}
                                disabled={l.nombre_adherents === 0}
                              >
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 12H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                              </Button>
                              <Button
                                type="button"
                                variant="danger"
                                size="icon"
                                title="Supprimer la liste"
                                aria-label={`Supprimer la liste ${l.nom}`}
                                onClick={() => openConfirm('supprimer', l.nom)}
                              >
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                                </svg>
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
              {confirmLoading || confirmAdherents.length > 0 ? (
                <>
                  Les adhérents suivants seront retirés de la liste « {confirmAction?.nom} »
                  {confirmAction?.type === 'supprimer' ? ', qui sera supprimée' : ''} :
                </>
              ) : (
                <>
                  Aucun adhérent n'appartient à la liste « {confirmAction?.nom} »
                  {confirmAction?.type === 'supprimer' ? ' — elle sera supprimée.' : '.'}
                </>
              )}
            </p>
            {confirmLoading ? (
              <div className="mt-3 flex justify-center py-4">
                <div className="h-5 w-5 animate-spin rounded-full border-4 border-stamp border-t-transparent" />
              </div>
            ) : confirmAdherents.length > 0 && (
              <ul className="mt-3 max-h-48 space-y-1 overflow-y-auto border-t border-paper-border pt-3 font-registre text-sm text-ink-muted">
                {confirmAdherents.map((a) => (
                  <li key={a.id}>{a.prenom ? `${a.prenom} ${a.nom}` : a.nom}</li>
                ))}
              </ul>
            )}
            <div className="mt-5 flex justify-end gap-3">
              <Button type="button" variant="secondary" onClick={() => setConfirmAction(null)} disabled={actionLoading}>
                Annuler
              </Button>
              <Button type="button" onClick={handleConfirmAction} disabled={actionLoading || confirmLoading}>
                {actionLoading ? 'Traitement…' : 'Confirmer'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {toast && <Toast key={toast.id} message={toast.message} onDismiss={dismissToast} />}
    </>
  )
}
