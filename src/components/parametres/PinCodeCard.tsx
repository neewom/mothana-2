import { useState } from 'react'
import { supabase } from '../../lib/supabaseClient'
import ParametresSection from '../ParametresSection'
import { Button } from '../ui/button'
import { Label } from '../ui/label'

interface PinCodeCardProps {
  organisationId: string
  /** `benevole` : PIN partagé des bénévoles ; `vendeur` : PIN du compte vendeur événement. */
  role: 'benevole' | 'vendeur'
  title: string
  description: string
  initialPin: string | null
  successMessage: string
}

function EyeIcon({ open }: { open: boolean }) {
  return open ? (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
    </svg>
  ) : (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
    </svg>
  )
}

/** Code PIN affichable et régénérable (Edge Function update-pin) — action immédiate, sans Enregistrer. */
export default function PinCodeCard({ organisationId, role, title, description, initialPin, successMessage }: PinCodeCardProps) {
  const [pin, setPin] = useState(initialPin ?? '')
  const [visible, setVisible] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  async function regenerate() {
    setLoading(true)
    setError(null)
    setSuccess(false)

    const { data: { session } } = await supabase.auth.getSession()
    if (!session) {
      setError('Session expirée')
      setLoading(false)
      return
    }

    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string
    const res = await fetch(`${supabaseUrl}/functions/v1/update-pin`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`,
        'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY as string,
      },
      body: JSON.stringify(role === 'vendeur' ? { organisation_id: organisationId, role: 'vendeur' } : { organisation_id: organisationId }),
    })

    const json = await res.json()
    if (!res.ok) {
      setError(json.error ?? 'Erreur inconnue')
      setLoading(false)
      return
    }

    setPin(json.new_pin)
    setVisible(true)
    setSuccess(true)
    setTimeout(() => setSuccess(false), 4000)
    setLoading(false)
  }

  const label = role === 'vendeur' ? 'PIN vendeur' : 'PIN bénévole'

  return (
    <ParametresSection title={title} description={description}>
      <div className="max-w-md space-y-4">
        <div>
          <Label>{role === 'vendeur' ? 'Code PIN vendeur' : 'Code PIN actuel'}</Label>
          <div className="mt-1 flex items-center gap-2">
            <div className="flex-1 rounded-sm border border-paper-border bg-paper px-3 py-2 font-registre-mono text-sm tracking-widest text-ink">
              {pin ? (visible ? pin : '••••••') : 'Non généré'}
            </div>
            <Button
              type="button"
              variant="secondary"
              size="icon"
              onClick={() => setVisible((value) => !value)}
              disabled={!pin}
              aria-label={visible ? `Masquer le ${label}` : `Afficher le ${label}`}
            >
              <EyeIcon open={visible} />
            </Button>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Button type="button" variant="secondary" onClick={() => void regenerate()} disabled={loading}>
            {loading ? (
              <svg className="h-4 w-4 animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" aria-hidden>
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
              </svg>
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden>
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
              </svg>
            )}
            {pin ? `Régénérer le ${label}` : `Générer le ${label}`}
          </Button>
          {success && <span className="text-sm text-success">{successMessage}</span>}
          {error && <span className="text-sm text-stamp">{error}</span>}
        </div>
      </div>
    </ParametresSection>
  )
}
