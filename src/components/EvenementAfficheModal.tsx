import { useEffect, useState } from 'react'
import QRCode from 'qrcode'
import type { Evenement } from '../types/evenement'
import { Button } from './ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog'

interface EvenementAfficheModalProps {
  open: boolean
  onClose: () => void
  evenement: Evenement | null
  organisationSlug: string
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(new Date(`${value}T12:00:00`))
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;')
}

export default function EvenementAfficheModal({
  open,
  onClose,
  evenement,
  organisationSlug,
}: EvenementAfficheModalProps) {
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const publicUrl = evenement
    ? `${window.location.origin}/e/${organisationSlug}/${evenement.slug}`
    : ''

  useEffect(() => {
    if (!open || !publicUrl) return
    setQrDataUrl(null)
    setError(null)
    QRCode.toDataURL(publicUrl, {
      width: 720,
      margin: 2,
      errorCorrectionLevel: 'M',
      color: { dark: '#241f19', light: '#ffffff' },
    })
      .then(setQrDataUrl)
      .catch(() => setError('Le QR code n’a pas pu être généré.'))
  }, [open, publicUrl])

  function handlePrint() {
    if (!evenement || !qrDataUrl) return
    const printWindow = window.open('', '_blank', 'width=900,height=700')
    if (!printWindow) {
      setError('Autorisez les fenêtres contextuelles pour imprimer l’affiche.')
      return
    }
    printWindow.opener = null
    printWindow.document.write(`<!doctype html>
      <html lang="fr"><head><meta charset="utf-8"><title>${escapeHtml(evenement.nom)}</title>
      <style>
        @page { size: A4 portrait; margin: 16mm; }
        * { box-sizing: border-box; }
        body { margin: 0; color: #241f19; font-family: Inter, Arial, sans-serif; }
        main { min-height: 260mm; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; border: 1px solid #e8e4dc; padding: 24mm 18mm; }
        h1 { max-width: 16ch; margin: 0; font-size: 38px; line-height: 1.15; }
        .date { margin: 14px 0 32px; color: #5c5347; font-size: 18px; }
        img { width: 112mm; height: 112mm; image-rendering: pixelated; }
        .instruction { margin: 28px 0 8px; font-size: 22px; font-weight: 600; }
        .url { max-width: 150mm; overflow-wrap: anywhere; color: #726860; font-family: ui-monospace, monospace; font-size: 11px; }
      </style></head><body><main>
        <h1>${escapeHtml(evenement.nom)}</h1>
        <p class="date">${escapeHtml(formatDate(evenement.date_evenement))}</p>
        <img src="${qrDataUrl}" alt="QR code vers la page de l'événement">
        <p class="instruction">Scannez pour acheter ou recharger votre crédit</p>
        <p class="url">${escapeHtml(publicUrl)}</p>
      </main><script>window.addEventListener('load', () => { window.print(); });</script></body></html>`)
    printWindow.document.close()
  }

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next) onClose() }}>
      <DialogContent className="max-w-xl" aria-describedby={undefined}>
        <DialogHeader className="pr-12">
          <DialogTitle>Affiche de l’événement</DialogTitle>
        </DialogHeader>
        <div className="flex-1 overflow-y-auto px-6 py-5">
          {evenement && (
            <div className="mx-auto flex max-w-md flex-col items-center rounded-sm border border-paper-border bg-white px-6 py-8 text-center">
              <h3 className="max-w-sm text-balance text-2xl font-bold text-ink">{evenement.nom}</h3>
              <p className="mt-2 text-sm text-ink-muted">{formatDate(evenement.date_evenement)}</p>
              <div className="mt-6 flex h-64 w-64 items-center justify-center rounded-sm border border-paper-border bg-white p-2">
                {qrDataUrl ? (
                  <img src={qrDataUrl} alt={`QR code vers ${evenement.nom}`} className="h-full w-full" />
                ) : (
                  <span className="text-sm text-ink-faint">Génération du QR code…</span>
                )}
              </div>
              <p className="mt-5 font-medium text-ink">Scannez pour acheter ou recharger votre crédit</p>
              <p className="mt-2 break-all font-registre-mono text-[11px] text-ink-faint">{publicUrl}</p>
            </div>
          )}
          {error && <p role="alert" className="mt-4 text-sm text-stamp">{error}</p>}
          <p className="mt-4 rounded-sm border border-warning-border bg-warning-tint px-3 py-2 text-sm text-warning">
            Le QR est prêt à imprimer. La page publique associée sera livrée avec la carte Coupon 4 ; elle affiche encore une page introuvable pour le moment.
          </p>
        </div>
        <div className="flex justify-end gap-3 border-t border-paper-border bg-white px-6 py-4">
          <Button type="button" variant="secondary" onClick={onClose}>Fermer</Button>
          <Button type="button" onClick={handlePrint} disabled={!qrDataUrl}>Imprimer l’affiche</Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
