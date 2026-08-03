import { useState, useEffect, type FormEvent } from 'react'
import { supabase } from '../lib/supabaseClient'
import type { Adherent, Adhesion, ModePaiement } from '../types'
import { MODE_PAIEMENT_OPTIONS } from '../lib/modePaiement'
import { generateUUID } from '../lib/uuid'
import { adherentFullName } from '../lib/adherentSearch'
import { computeDateFin } from '../lib/adhesion'
import Modal from './Modal'

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

  if (!open || !adherent) return null

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

  return (
    <Modal open={open} onClose={onClose} maxWidthClassName="max-w-md" labelledBy="adhesion-modal-title">
      <div className="border-b border-slate-200 px-6 py-4">
        <h2 id="adhesion-modal-title" className="text-lg font-semibold text-slate-900">
          Renouveler l'adhésion
        </h2>
        <p className="mt-0.5 text-xs text-slate-400">{adherentFullName(adherent)}</p>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-1 flex-col overflow-hidden">
        <div className="space-y-4 overflow-y-auto p-6">
          {error && <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              Date d'adhésion <span className="text-red-500">*</span>
            </label>
            <input
              type="date"
              required
              value={dateDebut}
              onChange={(e) => setDateDebut(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Cotisation</label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={montantCotisation}
                onChange={(e) => setMontantCotisation(e.target.value)}
                placeholder="Optionnel"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Mode de paiement</label>
              <select
                value={modePaiement}
                onChange={(e) => setModePaiement(e.target.value ? (Number(e.target.value) as ModePaiement) : '')}
                className="select-field w-full rounded-lg border border-slate-300 py-2 pl-3 pr-9 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="">Non renseigné</option>
                {MODE_PAIEMENT_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Date de paiement</label>
            <input
              type="date"
              value={datePaiementCotisation}
              onChange={(e) => setDatePaiementCotisation(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div className="flex gap-6">
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={droitVoteAg}
                onChange={(e) => setDroitVoteAg(e.target.checked)}
                className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
              />
              Droit de vote AG
            </label>
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={bulletinSigne}
                onChange={(e) => setBulletinSigne(e.target.checked)}
                className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
              />
              Bulletin signé
            </label>
          </div>
        </div>

        <div className="flex shrink-0 justify-end gap-3 rounded-b-2xl border-t border-slate-200 bg-white px-6 py-4 shadow-[0_-4px_6px_-4px_rgba(0,0,0,0.1)]">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
          >
            Annuler
          </button>
          <button
            type="submit"
            disabled={saving}
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-60"
          >
            {saving ? 'Enregistrement…' : 'Renouveler'}
          </button>
        </div>
      </form>
    </Modal>
  )
}
