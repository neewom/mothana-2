import { useState, useEffect, useMemo, type FormEvent } from 'react'
import { supabase } from '../lib/supabaseClient'
import type { Don, ProfilParticipant, Activite, ModePaiement } from '../types'
import ParticipantAutocomplete from './ParticipantAutocomplete'
import ParticipantModal from './ParticipantModal'
import Modal from './Modal'
import { MODE_PAIEMENT_OPTIONS } from '../lib/modePaiement'

interface DonModalProps {
  open: boolean
  onClose: () => void
  onSaved: () => void
  don?: Don
  participants: ProfilParticipant[]
  activites: Activite[]
  organisationId: string
  defaultParticipantId?: string
}

function todayISO(): string {
  return new Date().toISOString().split('T')[0]
}

export default function DonModal({
  open,
  onClose,
  onSaved,
  don,
  participants,
  activites,
  organisationId,
  defaultParticipantId,
}: DonModalProps) {
  const isEdit = !!don

  const [profilParticipantId, setProfilParticipantId] = useState('')
  const [activiteId, setActiviteId] = useState('')
  const [montant, setMontant] = useState('')
  const [date, setDate] = useState(todayISO())
  const [modePaiement, setModePaiement] = useState<ModePaiement>(3)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Participant created via the full ParticipantModal (opened from "+
  // Nouveau participant"), not yet present in the `participants` prop from
  // the parent list until its next refetch.
  const [fullModalOpen, setFullModalOpen] = useState(false)
  const [extraParticipants, setExtraParticipants] = useState<ProfilParticipant[]>([])

  const allParticipants = useMemo(
    () => (extraParticipants.length ? [...participants, ...extraParticipants] : participants),
    [participants, extraParticipants]
  )

  useEffect(() => {
    if (open) {
      if (don) {
        setProfilParticipantId(don.profil_participant_id)
        setActiviteId(don.activite_id ?? '')
        setMontant(String(don.montant))
        setDate(don.date)
        setModePaiement(don.mode_paiement)
      } else {
        setProfilParticipantId(defaultParticipantId ?? '')
        setActiviteId('')
        setMontant('')
        setDate(todayISO())
        setModePaiement(3)
      }
      setFullModalOpen(false)
      setExtraParticipants([])
      setError(null)
    }
  }, [open, don])

  if (!open) return null

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)

    if (!profilParticipantId) {
      setError('Veuillez sélectionner ou créer un participant.')
      return
    }

    setSaving(true)

    const payload = {
      profil_participant_id: profilParticipantId,
      activite_id: activiteId || null,
      montant: parseFloat(montant),
      date,
      mode_paiement: modePaiement,
    }

    let err: { message: string } | null = null

    if (isEdit && don) {
      const result = await supabase.from('dons').update(payload).eq('id', don.id)
      err = result.error
    } else {
      const result = await supabase.from('dons').insert({
        ...payload,
        organisation_id: organisationId,
        created_by_role: 'admin',
      })
      err = result.error
    }

    setSaving(false)

    if (err) {
      setError(err.message)
      return
    }

    onSaved()
    onClose()
  }

  return (
    <Modal open={open} onClose={onClose} labelledBy="don-modal-title">
        <div className="border-b border-slate-200 px-6 py-4">
          <h2 id="don-modal-title" className="text-lg font-semibold text-slate-900">
            {isEdit ? 'Modifier le don' : 'Ajouter un don'}
          </h2>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 p-6">
          {error && (
            <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}

          {/* Participant */}
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              Participant <span className="text-red-500">*</span>
            </label>

            <ParticipantAutocomplete
              participants={allParticipants}
              value={profilParticipantId}
              onChange={setProfilParticipantId}
              disabled={isEdit}
              placeholder="Rechercher par nom et prénom…"
            />

            {!isEdit && (
              <button
                type="button"
                onClick={() => setFullModalOpen(true)}
                className="mt-2 flex items-center gap-1 text-xs font-medium text-indigo-600 hover:text-indigo-800"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                </svg>
                Nouveau participant
              </button>
            )}
          </div>

          {/* Activité */}
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              Activité
            </label>
            <select
              value={activiteId}
              onChange={(e) => setActiviteId(e.target.value)}
              className="select-field w-full rounded-lg border border-slate-300 py-2 pl-3 pr-9 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="">Aucune activité</option>
              {activites.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.nom}
                </option>
              ))}
            </select>
          </div>

          {/* Montant */}
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              Montant (€) <span className="text-red-500">*</span>
            </label>
            <input
              type="number"
              step="0.01"
              min="0.01"
              required
              value={montant}
              onChange={(e) => setMontant(e.target.value)}
              placeholder="0.00"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          {/* Date */}
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              Date <span className="text-red-500">*</span>
            </label>
            <input
              type="date"
              required
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          {/* Mode de paiement */}
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              Mode de paiement <span className="text-red-500">*</span>
            </label>
            <select
              required
              value={modePaiement}
              onChange={(e) => setModePaiement(Number(e.target.value) as ModePaiement)}
              className="select-field w-full rounded-lg border border-slate-300 py-2 pl-3 pr-9 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              {MODE_PAIEMENT_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-2">
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
              {saving ? 'Enregistrement…' : 'Enregistrer'}
            </button>
          </div>
        </form>

      {/* Full participant form, opened from "+ Nouveau participant" */}
      <ParticipantModal
        open={fullModalOpen}
        onClose={() => setFullModalOpen(false)}
        onSaved={(created) => {
          setExtraParticipants((prev) => [...prev, created])
          setProfilParticipantId(created.id)
          setFullModalOpen(false)
        }}
        organisationId={organisationId}
      />
    </Modal>
  )
}
