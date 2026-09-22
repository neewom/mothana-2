import { useEffect, useState, type FormEvent } from 'react'
import { supabase } from '../lib/supabaseClient'
import type { Evenement } from '../types/evenement'
import { Button } from './ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog'
import { Input } from './ui/input'
import { Label } from './ui/label'

interface CreditManuelResult {
  ok: boolean
  raison: string | null
  portefeuille_id: string | null
  code_public: string | null
  secret: string | null
}

interface CreditManuelModalProps {
  open: boolean
  onClose: () => void
  evenement: Evenement | null
  onCredited: (message: string) => void
}

const REASON_MESSAGES: Record<string, string> = {
  ACCES_INTERDIT: 'Votre compte n’est pas autorisé à créditer ce portefeuille.',
  AUTRE_EVENEMENT: 'Ce portefeuille appartient à un autre événement.',
  EMAIL_INVALIDE: 'Saisissez une adresse email valide.',
  EVENEMENT_CLOS: 'Cet événement est clos et ne peut plus recevoir de crédit.',
  EVENEMENT_NON_OUVERT: 'Ouvrez l’événement avant d’enregistrer une vente au guichet.',
  MONTANT_INVALIDE: 'Le montant doit être supérieur à 0.',
  PORTEFEUILLE_GELE: 'Ce portefeuille est gelé et ne peut pas être crédité.',
  PORTEFEUILLE_INTROUVABLE: 'Le portefeuille demandé est introuvable.',
}

function eurosToCentimes(value: string): number | null {
  const normalized = value.trim().replace(',', '.')
  if (!/^\d+(?:\.\d{1,2})?$/.test(normalized)) return null
  const centimes = Math.round(Number(normalized) * 100)
  return Number.isSafeInteger(centimes) && centimes > 0 ? centimes : null
}

export default function CreditManuelModal({
  open,
  onClose,
  evenement,
  onCredited,
}: CreditManuelModalProps) {
  const [email, setEmail] = useState('')
  const [montant, setMontant] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<CreditManuelResult | null>(null)

  useEffect(() => {
    if (!open) return
    setEmail('')
    setMontant('')
    setSaving(false)
    setError(null)
    setResult(null)
  }, [open, evenement])

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    if (!evenement) return

    const montantCentimes = eurosToCentimes(montant)
    if (!montantCentimes) {
      setError('Saisissez un montant supérieur à 0, avec deux décimales maximum.')
      return
    }

    setSaving(true)
    setError(null)
    const { data, error: rpcError } = await supabase.rpc('creer_credit_manuel', {
      p_evenement_id: evenement.id,
      p_email: email,
      p_montant_centimes: montantCentimes,
      p_portefeuille_id: null,
    })

    if (rpcError) {
      setError(rpcError.message.includes('ACCES_INTERDIT') ? REASON_MESSAGES.ACCES_INTERDIT : rpcError.message)
      setSaving(false)
      return
    }

    const response = (Array.isArray(data) ? data[0] : data) as CreditManuelResult | null
    if (!response?.ok) {
      setError(REASON_MESSAGES[response?.raison ?? ''] ?? 'Le crédit n’a pas pu être enregistré.')
      setSaving(false)
      return
    }

    setResult(response)
    setSaving(false)
    onCredited('Crédit manuel enregistré.')
  }

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next) onClose() }}>
      <DialogContent className="max-w-md" aria-describedby={undefined}>
        <DialogHeader className="pr-12">
          <DialogTitle>Créditer un portefeuille</DialogTitle>
          {evenement && <p className="mt-1 text-sm text-ink-faint">{evenement.nom}</p>}
        </DialogHeader>

        {result ? (
          <div className="space-y-5 px-6 py-5">
            <div className="rounded-sm border border-success-border bg-success-tint px-4 py-3">
              <p className="font-medium text-success">Crédit enregistré</p>
              <p className="mt-1 text-sm text-ink-muted">
                Le portefeuille a été créé ou rechargé pour cette adresse email.
              </p>
            </div>
            <div className="space-y-1.5">
              <p className="text-sm font-medium text-ink-muted">Code public du portefeuille</p>
              <p className="break-all rounded-sm border border-paper-border bg-white px-3 py-2 font-registre-mono text-base font-semibold tracking-wide text-ink">
                {result.code_public}
              </p>
            </div>
            <p className="text-sm text-ink-faint">
              Le lien complet vers la page acheteur sera disponible avec la prochaine étape du module. Conservez ce code pour identifier le portefeuille d’ici là.
            </p>
            <div className="flex justify-end border-t border-paper-border pt-4">
              <Button type="button" onClick={onClose}>Terminer</Button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
            <div className="space-y-5 px-6 py-5">
              {error && (
                <p role="alert" className="rounded-sm border border-stamp/25 bg-stamp/[0.04] px-3 py-2 text-sm text-stamp">
                  {error}
                </p>
              )}
              <div className="space-y-1.5">
                <Label htmlFor="credit-email">Email de l’acheteur</Label>
                <Input
                  id="credit-email"
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="acheteur@exemple.fr"
                  autoComplete="email"
                  required
                />
                <p className="font-registre-mono text-[11px] text-ink-faint">
                  Un nouvel achat avec le même email recharge le portefeuille existant de cet événement.
                </p>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="credit-montant">Montant encaissé</Label>
                <div className="relative">
                  <Input
                    id="credit-montant"
                    type="number"
                    inputMode="decimal"
                    min="0.01"
                    step="0.01"
                    value={montant}
                    onChange={(event) => setMontant(event.target.value)}
                    className="pr-9 font-registre-mono"
                    placeholder="10.00"
                    required
                  />
                  <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-ink-faint">€</span>
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-3 border-t border-paper-border bg-white px-6 py-4">
              <Button type="button" variant="secondary" onClick={onClose}>Annuler</Button>
              <Button type="submit" disabled={saving}>
                {saving ? 'Crédit en cours…' : 'Enregistrer le crédit'}
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  )
}
