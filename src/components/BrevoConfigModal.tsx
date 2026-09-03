import { useState, useEffect, type FormEvent } from 'react'
import { supabase } from '../lib/supabaseClient'
import { isValidEmail } from '../lib/textFormat'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { Label } from './ui/label'
import { cn } from '../lib/utils'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog'

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
    <Dialog open={open} onOpenChange={(next) => { if (!next) onClose() }}>
      <DialogContent className="max-w-lg" aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle>Configuration Brevo</DialogTitle>
          <p className="mt-1 text-sm text-ink-muted">Compte Brevo de votre organisation, utilisé pour l'envoi des campagnes.</p>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-1 flex-col overflow-hidden">
          <div className="flex-1 space-y-4 overflow-y-auto p-6">
            {error && <div className="rounded-sm border border-stamp/30 bg-stamp/[0.04] px-4 py-3 font-registre text-sm text-stamp">{error}</div>}

            <div className="space-y-1.5">
              <Label htmlFor="brevo-api-key">Clé API</Label>
              <Input
                id="brevo-api-key"
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="xkeysib-…"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="brevo-expediteur-nom">Nom de l'expéditeur</Label>
              <Input
                id="brevo-expediteur-nom"
                type="text"
                value={expediteurNom}
                onChange={(e) => setExpediteurNom(e.target.value)}
                placeholder="Association Démo"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="brevo-expediteur-email">Email de l'expéditeur</Label>
              <Input
                id="brevo-expediteur-email"
                type="email"
                value={expediteurEmail}
                onChange={(e) => setExpediteurEmail(e.target.value)}
                placeholder="contact@association.fr"
                aria-invalid={emailInvalid}
                className={cn(emailInvalid && 'border-stamp focus-visible:ring-stamp')}
              />
              {emailInvalid && <p className="mt-1 text-xs text-stamp">Format d'email invalide.</p>}
              <p className="mt-1 text-xs text-ink-faint">Doit correspondre à un expéditeur vérifié dans votre compte Brevo.</p>
            </div>
          </div>

          <div className="flex shrink-0 justify-end gap-3 border-t border-paper-border bg-white px-6 py-4">
            <Button type="button" variant="secondary" onClick={onClose}>
              Annuler
            </Button>
            {dirty && (
              <Button type="submit" disabled={saving}>
                {saving ? 'Enregistrement…' : 'Enregistrer'}
              </Button>
            )}
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
