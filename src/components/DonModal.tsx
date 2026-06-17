import { useState, useEffect, type FormEvent } from 'react'
import { supabase } from '../lib/supabaseClient'
import type { Don, ProfilParticipant, Activite } from '../types'

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
  const [modePaiement, setModePaiement] = useState<'virement' | 'cheque' | 'especes'>('virement')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

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
        setModePaiement('virement')
      }
      setError(null)
    }
  }, [open, don])

  if (!open) return null

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40"
        onClick={onClose}
      />

      {/* Modal card */}
      <div className="relative z-10 w-full max-w-md rounded-2xl bg-white shadow-xl">
        <div className="border-b border-slate-200 px-6 py-4">
          <h2 className="text-lg font-semibold text-slate-900">
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
            <select
              required
              value={profilParticipantId}
              onChange={(e) => setProfilParticipantId(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="">Sélectionner un participant</option>
              {participants.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.personnes.prenom ? `${p.personnes.prenom} ${p.personnes.nom}` : p.personnes.nom}
                </option>
              ))}
            </select>
          </div>

          {/* Activité */}
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              Activité
            </label>
            <select
              value={activiteId}
              onChange={(e) => setActiviteId(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
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
              onChange={(e) => setModePaiement(e.target.value as 'virement' | 'cheque' | 'especes')}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="virement">Virement</option>
              <option value="cheque">Chèque</option>
              <option value="especes">Espèces</option>
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
      </div>
    </div>
  )
}
