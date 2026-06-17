import { useState, useEffect, type FormEvent } from 'react'
import { supabase } from '../lib/supabaseClient'
import type { ProfilParticipant } from '../types'

interface ParticipantModalProps {
  open: boolean
  onClose: () => void
  onSaved: () => void
  participant?: ProfilParticipant
  organisationId: string
}

export default function ParticipantModal({
  open,
  onClose,
  onSaved,
  participant,
  organisationId,
}: ParticipantModalProps) {
  const isEdit = !!participant

  const [nom, setNom] = useState('')
  const [prenom, setPrenom] = useState('')
  const [email, setEmail] = useState('')
  const [telephone, setTelephone] = useState('')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (open) {
      if (participant) {
        setNom(participant.personnes.nom)
        setPrenom(participant.personnes.prenom ?? '')
        setEmail(participant.personnes.email ?? '')
        setTelephone(participant.personnes.telephone ?? '')
        setNotes(participant.notes ?? '')
      } else {
        setNom('')
        setPrenom('')
        setEmail('')
        setTelephone('')
        setNotes('')
      }
      setError(null)
    }
  }, [open, participant])

  if (!open) return null

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setSaving(true)

    if (isEdit && participant) {
      // Update personne
      const { error: personneErr } = await supabase
        .from('personnes')
        .update({
          nom,
          prenom: prenom || null,
          email: email || null,
          telephone: telephone || null,
        })
        .eq('id', participant.personne_id)

      if (personneErr) {
        setError(personneErr.message)
        setSaving(false)
        return
      }

      // Update notes on profil
      const { error: profilErr } = await supabase
        .from('profils_participant')
        .update({ notes: notes || null })
        .eq('id', participant.id)

      if (profilErr) {
        setError(profilErr.message)
        setSaving(false)
        return
      }
    } else {
      // Generate UUID client-side to avoid triggering the SELECT policy via RETURNING
      const bytes = crypto.getRandomValues(new Uint8Array(16))
      bytes[6] = (bytes[6] & 0x0f) | 0x40 // version 4
      bytes[8] = (bytes[8] & 0x3f) | 0x80 // variant RFC 4122
      const hex = Array.from(bytes).map((b) => b.toString(16).padStart(2, '0'))
      const personneId = `${hex.slice(0,4).join('')}-${hex.slice(4,6).join('')}-${hex.slice(6,8).join('')}-${hex.slice(8,10).join('')}-${hex.slice(10).join('')}`

      // Insert personne
      const { error: personneErr } = await supabase
        .from('personnes')
        .insert({
          id: personneId,
          nom,
          prenom: prenom || null,
          email: email || null,
          telephone: telephone || null,
        })

      if (personneErr) {
        setError(personneErr.message)
        setSaving(false)
        return
      }

      // Insert profil_participant
      const { error: profilErr } = await supabase
        .from('profils_participant')
        .insert({
          personne_id: personneId,
          organisation_id: organisationId,
          notes: notes || null,
        })

      if (profilErr) {
        setError(profilErr.message)
        setSaving(false)
        return
      }
    }

    setSaving(false)
    onSaved()
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />

      {/* Modal card */}
      <div className="relative z-10 w-full max-w-md rounded-2xl bg-white shadow-xl">
        <div className="border-b border-slate-200 px-6 py-4">
          <h2 className="text-lg font-semibold text-slate-900">
            {isEdit ? 'Modifier le participant' : 'Ajouter un participant'}
          </h2>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 p-6">
          {error && (
            <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}

          {/* Nom */}
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              Nom <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              required
              value={nom}
              onChange={(e) => setNom(e.target.value)}
              placeholder="Dupont"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          {/* Prénom */}
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              Prénom
            </label>
            <input
              type="text"
              value={prenom}
              onChange={(e) => setPrenom(e.target.value)}
              placeholder="Jean"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          {/* Email */}
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="jean.dupont@exemple.fr"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          {/* Téléphone */}
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              Téléphone
            </label>
            <input
              type="text"
              value={telephone}
              onChange={(e) => setTelephone(e.target.value)}
              placeholder="06 00 00 00 00"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          {/* Notes */}
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              Notes
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              placeholder="Notes libres…"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
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
