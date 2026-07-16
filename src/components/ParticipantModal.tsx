import { useState, useEffect, type FormEvent } from 'react'
import { supabase } from '../lib/supabaseClient'
import type { Civilite, ProfilParticipant } from '../types'
import { CIVILITE_OPTIONS } from '../lib/civilite'
import Modal from './Modal'

function generateUUID(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16))
  bytes[6] = (bytes[6] & 0x0f) | 0x40 // version 4
  bytes[8] = (bytes[8] & 0x3f) | 0x80 // variant RFC 4122
  const hex = Array.from(bytes).map((b) => b.toString(16).padStart(2, '0'))
  return `${hex.slice(0, 4).join('')}-${hex.slice(4, 6).join('')}-${hex.slice(6, 8).join('')}-${hex.slice(8, 10).join('')}-${hex.slice(10).join('')}`
}

interface ParticipantModalProps {
  open: boolean
  onClose: () => void
  onSaved: (participant: ProfilParticipant) => void
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
  const [civilite, setCivilite] = useState<Civilite | ''>('')
  const [nom2, setNom2] = useState('')
  const [prenom2, setPrenom2] = useState('')
  const [adresse, setAdresse] = useState('')
  const [codePostal, setCodePostal] = useState('')
  const [ville, setVille] = useState('')
  const [pays, setPays] = useState('')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const isFoyer = civilite === 4
  const hasNoPrenom = civilite === 5 || civilite === 6

  useEffect(() => {
    if (open) {
      if (participant) {
        setNom(participant.personnes.nom)
        setPrenom(participant.personnes.prenom ?? '')
        setEmail(participant.personnes.email ?? '')
        setTelephone(participant.personnes.telephone ?? '')
        setCivilite(participant.personnes.civilite ?? '')
        setNom2(participant.personnes.nom2 ?? '')
        setPrenom2(participant.personnes.prenom2 ?? '')
        setAdresse(participant.personnes.adresse ?? '')
        setCodePostal(participant.personnes.code_postal ?? '')
        setVille(participant.personnes.ville ?? '')
        setPays(participant.personnes.pays ?? '')
        setNotes(participant.notes ?? '')
      } else {
        setNom('')
        setPrenom('')
        setEmail('')
        setTelephone('')
        setCivilite('')
        setNom2('')
        setPrenom2('')
        setAdresse('')
        setCodePostal('')
        setVille('')
        setPays('')
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
          prenom: hasNoPrenom ? null : prenom || null,
          email: email || null,
          telephone: telephone || null,
          civilite: civilite || null,
          nom2: isFoyer ? nom2 || null : null,
          prenom2: isFoyer ? prenom2 || null : null,
          adresse: adresse || null,
          code_postal: codePostal || null,
          ville: ville || null,
          pays: pays || null,
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

      setSaving(false)
      onSaved({
        ...participant,
        notes: notes || null,
        personnes: {
          ...participant.personnes,
          nom,
          prenom: hasNoPrenom ? null : prenom || null,
          email: email || null,
          telephone: telephone || null,
          civilite: civilite || null,
          nom2: isFoyer ? nom2 || null : null,
          prenom2: isFoyer ? prenom2 || null : null,
          adresse: adresse || null,
          code_postal: codePostal || null,
          ville: ville || null,
          pays: pays || null,
        },
      })
      onClose()
      return
    } else {
      // Generate UUIDs client-side to avoid triggering the SELECT policy via RETURNING
      const personneId = generateUUID()
      const profilId = generateUUID()

      // Insert personne
      const { error: personneErr } = await supabase
        .from('personnes')
        .insert({
          id: personneId,
          nom,
          prenom: hasNoPrenom ? null : prenom || null,
          email: email || null,
          telephone: telephone || null,
          civilite: civilite || null,
          nom2: isFoyer ? nom2 || null : null,
          prenom2: isFoyer ? prenom2 || null : null,
          adresse: adresse || null,
          code_postal: codePostal || null,
          ville: ville || null,
          pays: pays || null,
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
          id: profilId,
          personne_id: personneId,
          organisation_id: organisationId,
          notes: notes || null,
        })

      if (profilErr) {
        setError(profilErr.message)
        setSaving(false)
        return
      }

      setSaving(false)
      onSaved({
        id: profilId,
        personne_id: personneId,
        organisation_id: organisationId,
        notes: notes || null,
        id_externe: null,
        created_at: new Date().toISOString(),
        personnes: {
          id: personneId,
          nom,
          prenom: hasNoPrenom ? null : prenom || null,
          email: email || null,
          telephone: telephone || null,
          civilite: civilite || null,
          nom2: isFoyer ? nom2 || null : null,
          prenom2: isFoyer ? prenom2 || null : null,
          adresse: adresse || null,
          code_postal: codePostal || null,
          ville: ville || null,
          pays: pays || null,
        },
      })
      onClose()
      return
    }
  }

  return (
    <Modal open={open} onClose={onClose} labelledBy="participant-modal-title">
        <div className="border-b border-slate-200 px-6 py-4">
          <h2 id="participant-modal-title" className="text-lg font-semibold text-slate-900">
            {isEdit ? 'Modifier le participant' : 'Ajouter un participant'}
          </h2>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 overflow-y-auto p-6">
          {error && (
            <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}

          {/* Civilité */}
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              Civilité
            </label>
            <select
              value={civilite}
              onChange={(e) => {
                const value = e.target.value ? (Number(e.target.value) as Civilite) : ''
                setCivilite(value)
                if (value === 5 || value === 6) setPrenom('')
              }}
              className="select-field w-full rounded-lg border border-slate-300 py-2 pl-3 pr-9 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="">Non renseigné</option>
              {CIVILITE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>

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
          {!hasNoPrenom && (
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
          )}

          {/* Co-signataire (foyer) */}
          {isFoyer && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">
                  Nom 2
                </label>
                <input
                  type="text"
                  value={nom2}
                  onChange={(e) => setNom2(e.target.value)}
                  placeholder="Dupont"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">
                  Prénom 2
                </label>
                <input
                  type="text"
                  value={prenom2}
                  onChange={(e) => setPrenom2(e.target.value)}
                  placeholder="Marie"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>
          )}

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

          {/* Adresse */}
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              Adresse
            </label>
            <input
              type="text"
              value={adresse}
              onChange={(e) => setAdresse(e.target.value)}
              placeholder="12 rue des Lilas"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          {/* Code postal / Ville */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">
                Code postal
              </label>
              <input
                type="text"
                value={codePostal}
                onChange={(e) => setCodePostal(e.target.value)}
                placeholder="75000"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">
                Ville
              </label>
              <input
                type="text"
                value={ville}
                onChange={(e) => setVille(e.target.value)}
                placeholder="Paris"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>

          {/* Pays */}
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              Pays
            </label>
            <input
              type="text"
              value={pays}
              onChange={(e) => setPays(e.target.value)}
              placeholder="France"
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
    </Modal>
  )
}
