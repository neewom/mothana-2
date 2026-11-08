import { useState, useEffect, type FormEvent } from 'react'
import { supabase } from '../lib/supabaseClient'
import type { Adherent, DemandeAdhesion, ModePaiement } from '../types'
import { MODE_PAIEMENT_OPTIONS } from '../lib/modePaiement'
import { adherentFullName } from '../lib/adherentSearch'
import { libelleFinPrevue } from '../lib/adhesion'
import { useRegleAdhesion } from '../hooks/useRegleAdhesion'
import { CHAMPS_COORDONNEES, messageErreurValidation, type ChampCoordonnee } from '../lib/validationRenouvellement'
import { Button } from './ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog'
import { Input } from './ui/input'
import { Label } from './ui/label'
import { Select } from './ui/select'

export interface ResultatValidationRenouvellement {
  adherent_id: string
  adhesion_id: string
  date_fin: string | null
  reactive: boolean
}

interface ValidationRenouvellementModalProps {
  open: boolean
  onClose: () => void
  onValidated: (resultat: ResultatValidationRenouvellement) => void
  demande: DemandeAdhesion
  adherent: Adherent
  /** Coordonnées cochées dans le comparatif du détail de la demande. */
  champs: ChampCoordonnee[]
}

function today(): string {
  return new Date().toISOString().split('T')[0]
}

// Validation d'une demande de renouvellement : nouvelle adhésion sur la fiche existante (mêmes
// champs que AdhesionModal), coordonnées cochées appliquées, demande ratifiée — en une seule
// transaction (RPC valider_renouvellement). Date de fin posée par la base (#265).
export default function ValidationRenouvellementModal({ open, onClose, onValidated, demande, adherent, champs }: ValidationRenouvellementModalProps) {
  const [dateDebut, setDateDebut] = useState(today())
  const [montantCotisation, setMontantCotisation] = useState('')
  const [modePaiement, setModePaiement] = useState<ModePaiement | ''>('')
  const [datePaiementCotisation, setDatePaiementCotisation] = useState('')
  const [droitVoteAg, setDroitVoteAg] = useState(true)
  const [bulletinSigne, setBulletinSigne] = useState(true)
  const [reactiver, setReactiver] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const regleAdhesion = useRegleAdhesion(demande.organisation_id)
  const archive = adherent.statut === 'archive'

  useEffect(() => {
    if (open) {
      setDateDebut(today())
      setMontantCotisation('')
      setModePaiement('')
      setDatePaiementCotisation('')
      setDroitVoteAg(true)
      setBulletinSigne(true)
      setReactiver(false)
      setError(null)
    }
  }, [open])

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (archive && !reactiver) {
      setError("L'adhérent est archivé : confirmez sa réactivation pour valider.")
      return
    }
    setError(null)
    setSaving(true)

    const { data, error: err } = await supabase.rpc('valider_renouvellement', {
      p_demande_id: demande.id,
      p_date_debut: dateDebut,
      p_montant_cotisation: montantCotisation ? Number(montantCotisation) : null,
      p_mode_paiement: modePaiement || null,
      p_date_paiement_cotisation: datePaiementCotisation || null,
      p_droit_vote_ag: droitVoteAg,
      p_bulletin_signe: bulletinSigne,
      p_champs: champs,
      p_reactiver: archive && reactiver,
    })

    setSaving(false)
    if (err) {
      setError(messageErreurValidation(err.message))
      return
    }
    onValidated(data as ResultatValidationRenouvellement)
    onClose()
  }

  const checkboxClass = 'h-4 w-4 rounded-sm border-paper-border accent-stamp focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stamp/70'
  const libellesChamps = CHAMPS_COORDONNEES.filter((c) => champs.includes(c.champ)).map((c) => c.label)

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next && !saving) onClose() }}>
      <DialogContent className="max-w-md" aria-describedby={undefined}>
        <DialogHeader className="shrink-0 pr-12">
          <DialogTitle>Valider le renouvellement</DialogTitle>
          <p className="mt-0.5 text-xs text-ink-faint">{adherentFullName(adherent)}</p>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
          <div className="flex-1 space-y-4 overflow-y-auto p-6">
            {error && (
              <div role="alert" className="rounded-sm border border-stamp/30 bg-stamp/[0.04] px-4 py-3 text-sm text-stamp">
                {error}
              </div>
            )}

            <p className="text-sm text-ink-muted">
              Une nouvelle adhésion est enregistrée sur la fiche existante.{' '}
              {libellesChamps.length > 0
                ? <>Coordonnées mises à jour : <span className="font-medium text-ink">{libellesChamps.join(', ')}</span>.</>
                : 'Aucune coordonnée de la fiche ne sera modifiée.'}
            </p>

            {archive && (
              <label className="flex items-start gap-2 rounded-sm border border-warning-border bg-warning-tint px-3 py-2.5 text-sm text-warning">
                <input
                  type="checkbox"
                  checked={reactiver}
                  onChange={(e) => setReactiver(e.target.checked)}
                  className={`${checkboxClass} mt-0.5 shrink-0`}
                />
                <span>Cet adhérent est archivé : je confirme sa réactivation.</span>
              </label>
            )}

            <div>
              <Label htmlFor="renouvellement-date-debut">
                Date d'adhésion <span className="text-stamp">*</span>
              </Label>
              <Input
                id="renouvellement-date-debut"
                type="date"
                required
                value={dateDebut}
                onChange={(e) => setDateDebut(e.target.value)}
                className="mt-1"
              />
              <p className="mt-1 text-xs text-ink-faint">{libelleFinPrevue(dateDebut, regleAdhesion)}</p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="renouvellement-cotisation">Cotisation</Label>
                <Input
                  id="renouvellement-cotisation"
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
                <Label htmlFor="renouvellement-mode">Mode de paiement</Label>
                <Select
                  id="renouvellement-mode"
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
              <Label htmlFor="renouvellement-date-paiement">Date de paiement</Label>
              <Input
                id="renouvellement-date-paiement"
                type="date"
                value={datePaiementCotisation}
                onChange={(e) => setDatePaiementCotisation(e.target.value)}
                className="mt-1"
              />
            </div>

            <div className="flex gap-6">
              <label className="flex items-center gap-2 text-sm text-ink">
                <input type="checkbox" checked={droitVoteAg} onChange={(e) => setDroitVoteAg(e.target.checked)} className={checkboxClass} />
                Droit de vote AG
              </label>
              <label className="flex items-center gap-2 text-sm text-ink">
                <input type="checkbox" checked={bulletinSigne} onChange={(e) => setBulletinSigne(e.target.checked)} className={checkboxClass} />
                Bulletin signé
              </label>
            </div>
          </div>

          <div className="flex shrink-0 justify-end gap-3 border-t border-paper-border bg-white px-6 py-4">
            <Button type="button" variant="secondary" onClick={onClose} disabled={saving}>
              Annuler
            </Button>
            <Button type="submit" variant="success" className="border-none bg-success text-white hover:bg-success/90" disabled={saving || (archive && !reactiver)}>
              {saving ? 'Validation…' : 'Valider'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
