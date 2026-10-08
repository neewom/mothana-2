import { useEffect, useState } from 'react'
import { copyTextToClipboard } from '../lib/clipboard'
import { getCanonicalSiteUrl } from '../lib/environment'
import { supabase } from '../lib/supabaseClient'
import { isValidEmail } from '../lib/textFormat'
import {
  walletAccessResendErrorCode,
  walletAccessResendErrorMessage,
  type WalletAccessResendResponse,
} from '../lib/walletAccessResend'
import type { PortefeuilleEvenement } from '../types/evenementDashboard'
import { Button } from './ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog'
import { Input } from './ui/input'
import { Label } from './ui/label'
import { StatusNotice } from './ui/status-notice'

interface RenvoyerAccesPortefeuilleModalProps {
  portefeuille: PortefeuilleEvenement | null
  onClose: () => void
  /** Email envoyé : la modale se ferme, la page affiche le toast et recharge ses données. */
  onSent: (email: string) => void
  /** Un lien a été créé (copie manuelle ou repli après échec d'envoi) : la page recharge ses données. */
  onLinkCreated: () => void
  onCopyResult: (message: string) => void
}

type Action = 'email' | 'link'

export default function RenvoyerAccesPortefeuilleModal({
  portefeuille,
  onClose,
  onSent,
  onLinkCreated,
  onCopyResult,
}: RenvoyerAccesPortefeuilleModalProps) {
  const [editingEmail, setEditingEmail] = useState(false)
  const [email, setEmail] = useState('')
  const [revokeOld, setRevokeOld] = useState(false)
  const [confirmingLink, setConfirmingLink] = useState(false)
  const [submitting, setSubmitting] = useState<Action | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [link, setLink] = useState<string | null>(null)

  useEffect(() => {
    if (!portefeuille) return
    setEditingEmail(false)
    setEmail(portefeuille.email)
    setRevokeOld(false)
    setConfirmingLink(false)
    setSubmitting(null)
    setError(null)
    setLink(null)
  }, [portefeuille])

  const normalizedEmail = email.trim().toLowerCase()
  const emailInvalid = editingEmail && email.length > 0 && !isValidEmail(email.trim())
  const canSubmit = isValidEmail(normalizedEmail) && submitting === null
  // L'avertissement n'apparaît qu'au moment où il sert : correction d'adresse, ou lien à
  // transmettre à la main (il permet de dépenser le solde).
  const showIdentityWarning = editingEmail || confirmingLink

  function close() {
    if (submitting) return
    onClose()
  }

  async function submit(action: Action) {
    if (!portefeuille || submitting) return
    if (!isValidEmail(normalizedEmail)) {
      setError('Renseignez une adresse email valide.')
      return
    }

    setSubmitting(action)
    setError(null)

    const { data: response, error: invocationError } = await supabase.functions.invoke<WalletAccessResendResponse>(
      'renvoyer-acces-portefeuille',
      {
        body: {
          portefeuille_id: portefeuille.id,
          nouvel_email: normalizedEmail,
          revoquer_anciens: revokeOld,
          envoyer_email: action === 'email',
          site_url: getCanonicalSiteUrl(),
        },
      },
    )

    if (invocationError || !response) {
      setError(walletAccessResendErrorMessage(await walletAccessResendErrorCode(invocationError)))
      setSubmitting(null)
      return
    }

    if (!response.ok) {
      setError(walletAccessResendErrorMessage(response.error ?? null))
      if (response.error === 'EMAIL_NON_ENVOYE' && response.portefeuille_url) {
        setLink(response.portefeuille_url)
        onLinkCreated()
      }
      setSubmitting(null)
      return
    }

    setSubmitting(null)
    if (action === 'email') {
      onSent(response.email ?? normalizedEmail)
      return
    }
    if (response.portefeuille_url) setLink(response.portefeuille_url)
    onLinkCreated()
  }

  function requestLink() {
    // Sans correction d'adresse en cours, l'avertissement n'est pas encore affiché :
    // premier clic = l'afficher, second clic = générer.
    if (!showIdentityWarning) {
      setConfirmingLink(true)
      return
    }
    void submit('link')
  }

  const locked = link !== null

  return (
    <Dialog
      open={portefeuille !== null}
      onOpenChange={(next) => {
        if (!next) close()
      }}
    >
      <DialogContent className="max-w-xl" aria-describedby={undefined}>
        {portefeuille && (
          <>
            <DialogHeader className="shrink-0 pr-12">
              <DialogTitle>Renvoyer l’accès au portefeuille</DialogTitle>
            </DialogHeader>

            <div className="flex-1 space-y-5 overflow-y-auto px-6 py-5">
              <div>
                {editingEmail ? (
                  <>
                    <Label htmlFor="resend-wallet-email">Adresse email</Label>
                    <Input
                      id="resend-wallet-email"
                      type="email"
                      inputMode="email"
                      autoComplete="email"
                      value={email}
                      disabled={locked}
                      onChange={(event) => {
                        setEmail(event.target.value)
                        setError(null)
                      }}
                      aria-invalid={emailInvalid}
                      aria-describedby="resend-wallet-email-help"
                      className="mt-1"
                    />
                    <p id="resend-wallet-email-help" className={`mt-1.5 text-xs ${emailInvalid ? 'text-stamp' : 'text-ink-faint'}`}>
                      {emailInvalid
                        ? 'Adresse email invalide.'
                        : 'La correction met à jour le portefeuille, pas l’historique de la commande.'}
                    </p>
                  </>
                ) : (
                  <>
                    <p className="font-registre-mono text-[11px] uppercase tracking-wide text-ink-faint">Adresse email</p>
                    <div className="mt-1 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                      <p className="break-all font-medium text-ink">{portefeuille.email}</p>
                      {!locked && (
                        <button
                          type="button"
                          onClick={() => {
                            setEditingEmail(true)
                            setError(null)
                          }}
                          className="rounded-sm text-sm font-medium text-stamp underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stamp/70"
                        >
                          Corriger l’adresse
                        </button>
                      )}
                    </div>
                  </>
                )}
              </div>

              {showIdentityWarning && !locked && (
                <StatusNotice tone="warning" heading="Vérification indispensable">
                  Vérifiez l’identité de la personne avant de modifier l’adresse ou de transmettre le lien : il permet de dépenser le solde du portefeuille.
                </StatusNotice>
              )}

              <label className="flex items-start gap-3 rounded-sm border border-paper-border bg-white p-3 text-sm text-ink-muted">
                <input
                  type="checkbox"
                  checked={revokeOld}
                  disabled={locked}
                  onChange={(event) => setRevokeOld(event.target.checked)}
                  className="mt-0.5 h-4 w-4 rounded-sm border-paper-border accent-stamp focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stamp/70"
                />
                <span>
                  <span className="block font-medium text-ink">Invalider aussi les anciens liens (téléphone perdu ou volé)</span>
                  <span className="mt-0.5 block text-xs leading-5 text-ink-faint">
                    Les anciens accès cesseront immédiatement de fonctionner.
                  </span>
                </span>
              </label>

              {error && (
                <StatusNotice tone="danger" role="alert">
                  {error}
                </StatusNotice>
              )}

              {link && (
                <div>
                  <Label htmlFor="resend-wallet-link">Nouveau lien — affiché une seule fois</Label>
                  <div className="mt-1 flex gap-2">
                    <Input
                      id="resend-wallet-link"
                      value={link}
                      readOnly
                      className="min-w-0 font-registre-mono text-xs"
                      onFocus={(event) => event.currentTarget.select()}
                    />
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={async () => {
                        const copied = await copyTextToClipboard(link)
                        onCopyResult(copied ? 'Lien copié' : 'Copie impossible : sélectionnez le lien manuellement.')
                      }}
                    >
                      Copier
                    </Button>
                  </div>
                  <p className="mt-1.5 text-xs text-ink-faint">
                    Fermer cette fenêtre effacera le lien de l’écran.
                  </p>
                </div>
              )}
            </div>

            <div className="flex shrink-0 flex-wrap justify-end gap-3 border-t border-paper-border bg-white px-6 py-4">
              {locked ? (
                <Button type="button" variant="secondary" onClick={close}>
                  Fermer
                </Button>
              ) : (
                <>
                  <Button type="button" variant="secondary" disabled={submitting !== null} onClick={close}>
                    Annuler
                  </Button>
                  <Button type="button" variant="secondary" disabled={!canSubmit} onClick={requestLink}>
                    {submitting === 'link' ? 'Génération…' : confirmingLink && !editingEmail ? 'Confirmer et générer' : 'Générer un lien à copier'}
                  </Button>
                  <Button type="button" disabled={!canSubmit} onClick={() => void submit('email')}>
                    {submitting === 'email' ? 'Envoi…' : 'Envoyer un nouveau lien'}
                  </Button>
                </>
              )}
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
