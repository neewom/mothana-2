import { useState, useEffect, type FormEvent } from 'react'
import { supabase } from '../lib/supabaseClient'
import { isValidEmail } from '../lib/textFormat'
import Modal from './Modal'

export interface BrevoConfigValues {
  apiKey: string
  expediteurNom: string
  expediteurEmail: string
}

interface BrevoConfigModalProps {
  open: boolean
  onClose: () => void
  onSaved: (values: BrevoConfigValues) => void
  organisationId: string
  initial: BrevoConfigValues
}

// Config Brevo sortie de CampagneMailingPage.tsx vers une modale dédiée
// (cadré 2026-08-25) : le formulaire restait affiché en pleine taille même
// une fois configuré. "Enregistrer" ne s'affiche que si au moins un champ
// diffère des valeurs chargées (state "dirty") — pas de bouton visible sans
// modification, "Annuler" ne sauvegarde jamais partiellement.
export default function BrevoConfigModal({ open, onClose, onSaved, organisationId, initial }: BrevoConfigModalProps) {
  const [apiKey, setApiKey] = useState(initial.apiKey)
  const [expediteurNom, setExpediteurNom] = useState(initial.expediteurNom)
  const [expediteurEmail, setExpediteurEmail] = useState(initial.expediteurEmail)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (open) {
      setApiKey(initial.apiKey)
      setExpediteurNom(initial.expediteurNom)
      setExpediteurEmail(initial.expediteurEmail)
      setError(null)
    }
  }, [open, initial])

  if (!open) return null

  const dirty = apiKey !== initial.apiKey || expediteurNom !== initial.expediteurNom || expediteurEmail !== initial.expediteurEmail
  const emailInvalid = expediteurEmail.trim() !== '' && !isValidEmail(expediteurEmail)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)

    if (emailInvalid) {
      setError("Le format de l'adresse email est invalide.")
      return
    }

    setSaving(true)

    const { error: err } = await supabase
      .from('organisations')
      .update({
        brevo_api_key: apiKey.trim() || null,
        brevo_expediteur_nom: expediteurNom.trim() || null,
        brevo_expediteur_email: expediteurEmail.trim() || null,
      })
      .eq('id', organisationId)

    setSaving(false)

    if (err) {
      setError(err.message)
      return
    }

    onSaved({ apiKey, expediteurNom, expediteurEmail })
    onClose()
  }

  return (
    <Modal open={open} onClose={onClose} maxWidthClassName="max-w-lg" labelledBy="brevo-config-title">
      <div className="border-b border-slate-200 px-6 py-4">
        <h2 id="brevo-config-title" className="text-lg font-semibold text-slate-900">Configuration Brevo</h2>
        <p className="mt-1 text-sm text-slate-600">Compte Brevo de votre organisation, utilisé pour l'envoi des campagnes.</p>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-1 flex-col overflow-hidden">
        <div className="space-y-4 p-6">
          {error && <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Clé API</label>
            <input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="xkeysib-…"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Nom de l'expéditeur</label>
            <input
              type="text"
              value={expediteurNom}
              onChange={(e) => setExpediteurNom(e.target.value)}
              placeholder="Association Démo"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Email de l'expéditeur</label>
            <input
              type="email"
              value={expediteurEmail}
              onChange={(e) => setExpediteurEmail(e.target.value)}
              placeholder="contact@association.fr"
              aria-invalid={emailInvalid}
              className={`w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 ${
                emailInvalid
                  ? 'border-red-400 focus:ring-red-500'
                  : 'border-slate-300 focus:ring-indigo-500'
              }`}
            />
            {emailInvalid && <p className="mt-1 text-xs text-red-600">Format d'email invalide.</p>}
            <p className="mt-1 text-xs text-slate-500">Doit correspondre à un expéditeur vérifié dans votre compte Brevo.</p>
          </div>
        </div>

        <div className="flex shrink-0 justify-end gap-3 rounded-b-2xl border-t border-slate-200 bg-white px-6 py-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
          >
            Annuler
          </button>
          {dirty && (
            <button
              type="submit"
              disabled={saving}
              className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-60"
            >
              {saving ? 'Enregistrement…' : 'Enregistrer'}
            </button>
          )}
        </div>
      </form>
    </Modal>
  )
}
