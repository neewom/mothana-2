import { useState, useEffect, type FormEvent } from 'react'
import { supabase } from '../lib/supabaseClient'
import type { Adherent, Adhesion, ModePaiement } from '../types'
import { MODE_PAIEMENT_OPTIONS } from '../lib/modePaiement'
import { generateUUID } from '../lib/uuid'
import { adherentFullName } from '../lib/adherentSearch'
import { computeDateFin } from '../lib/adhesion'
import { Button } from './ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog'
import { Input } from './ui/input'
import { Label } from './ui/label'
import { Select } from './ui/select'

interface AdhesionModalProps {
  open: boolean
  onClose: () => void
  onSaved: (adhesion: Adhesion) => void
  adherent?: Adherent
}

function today(): string {
  return new Date().toISOString().split('T')[0]
}

export default function AdhesionModal({ open, onClose, onSaved, adherent }: AdhesionModalProps) {
  const [dateDebut, setDateDebut] = useState(today())
  const [montantCotisation, setMontantCotisation] = useState('')
  const [modePaiement, setModePaiement] = useState<ModePaiement | ''>('')
  const [datePaiementCotisation, setDatePaiementCotisation] = useState('')
  const [droitVoteAg, setDroitVoteAg] = useState(true)
  const [bulletinSigne, setBulletinSigne] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (open) {
      setDateDebut(today())
      setMontantCotisation('')
      setModePaiement('')
      setDatePaiementCotisation('')
      setDroitVoteAg(true)
      setBulletinSigne(true)
      setError(null)
    }
  }, [open])

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!adherent) return
    setError(null)
    setSaving(true)

    const adhesionId = generateUUID()
    const dateFin = computeDateFin(dateDebut)

    const { error: err } = await supabase.from('adhesions').insert({
      id: adhesionId,
      adherent_id: adherent.id,
      date_debut: dateDebut,
      date_fin: dateFin,
      montant_cotisation: montantCotisation ? Number(montantCotisation) : null,
      date_paiement_cotisation: datePaiementCotisation || null,
      mode_paiement: modePaiement || null,
      renouvellement: true,
      droit_vote_ag: droitVoteAg,
      bulletin_signe: bulletinSigne,
    })

    if (err) {
      setError(err.message)
      setSaving(false)
      return
    }

    setSaving(false)
    onSaved({
      id: adhesionId,
      adherent_id: adherent.id,
      date_debut: dateDebut,
      date_fin: dateFin,
      montant_cotisation: montantCotisation ? Number(montantCotisation) : null,
      date_paiement_cotisation: datePaiementCotisation || null,
      mode_paiement: modePaiement || null,
      renouvellement: true,
      droit_vote_ag: droitVoteAg,
      bulletin_signe: bulletinSigne,
      created_at: new Date().toISOString(),
    })
    onClose()
  }

  const checkboxClass = 'h-4 w-4 rounded-sm border-paper-border accent-stamp focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stamp/70'

  return (
    <Dialog open={open && adherent !== undefined} onOpenChange={(next) => { if (!next && !saving) onClose() }}>
      <DialogContent className="max-w-md" aria-describedby={undefined}>
        <DialogHeader className="shrink-0 pr-12">
          <DialogTitle>Renouveler l'adhésion</DialogTitle>
          {adherent && <p className="mt-0.5 text-xs text-ink-faint">{adherentFullName(adherent)}</p>}
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
          <div className="flex-1 space-y-4 overflow-y-auto p-6">
            {error && (
              <div role="alert" className="rounded-sm border border-stamp/30 bg-stamp/[0.04] px-4 py-3 text-sm text-stamp">
                {error}
              </div>
            )}

            <div>
              <Label htmlFor="adhesion-date-debut">
                Date d'adhésion <span className="text-stamp">*</span>
              </Label>
              <Input
                id="adhesion-date-debut"
                type="date"
                required
                value={dateDebut}
                onChange={(e) => setDateDebut(e.target.value)}
                className="mt-1"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="adhesion-cotisation">Cotisation</Label>
                <Input
                  id="adhesion-cotisation"
                  type="number"
                  step="0.01"
                  min="0"
                  value={montantCotisation}
                  onChange={(e) => setMontantCotisation(e.target.value)}
                  placeholder="Optionnel"
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="adhesion-mode" className="block">Mode de paiement</Label>
                <Select
                  id="adhesion-mode"
                  value={modePaiement}
                  onChange={(e) => setModePaiement(e.target.value ? (Number(e.target.value) as ModePaiement) : '')}
                  className="mt-1 w-full"
                >
                  <option value="">Non renseigné</option>
                  {MODE_PAIEMENT_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </Select>
              </div>
            </div>

            <div>
              <Label htmlFor="adhesion-date-paiement">Date de paiement</Label>
              <Input
                id="adhesion-date-paiement"
                type="date"
                value={datePaiementCotisation}
                onChange={(e) => setDatePaiementCotisation(e.target.value)}
                className="mt-1"
              />
            </div>

            <div className="flex gap-6">
              <label className="flex items-center gap-2 text-sm text-ink">
                <input
                  type="checkbox"
                  checked={droitVoteAg}
                  onChange={(e) => setDroitVoteAg(e.target.checked)}
                  className={checkboxClass}
                />
                Droit de vote AG
              </label>
              <label className="flex items-center gap-2 text-sm text-ink">
                <input
                  type="checkbox"
                  checked={bulletinSigne}
                  onChange={(e) => setBulletinSigne(e.target.checked)}
                  className={checkboxClass}
                />
                Bulletin signé
              </label>
            </div>
          </div>

          <div className="flex shrink-0 justify-end gap-3 border-t border-paper-border bg-white px-6 py-4">
            <Button type="button" variant="secondary" onClick={onClose} disabled={saving}>
              Annuler
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? 'Enregistrement…' : 'Renouveler'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
