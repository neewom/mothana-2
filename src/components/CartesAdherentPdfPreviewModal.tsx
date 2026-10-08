import { Button } from './ui/button'
import { Dialog, DialogContent, DialogTitle } from './ui/dialog'

interface CartesAdherentPdfPreviewModalProps {
  open: boolean
  onClose: () => void
  pdfUrl: string
  filename: string
  count: number
}

export default function CartesAdherentPdfPreviewModal({
  open,
  onClose,
  pdfUrl,
  filename,
  count,
}: CartesAdherentPdfPreviewModalProps) {
  function handleDownload() {
    const link = document.createElement('a')
    link.href = pdfUrl
    link.download = filename
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next) onClose() }}>
      <DialogContent className="h-[85vh] min-h-[560px] max-w-3xl" aria-describedby={undefined}>
        {/* Titre à gauche, actions à droite ; empilés sous sm. pr-12 réserve le bouton Fermer. */}
        <div className="flex shrink-0 flex-col gap-3 border-b border-paper-border px-6 py-4 pr-12 sm:flex-row sm:items-center sm:justify-between">
          <DialogTitle>{`Aperçu — ${count} carte${count > 1 ? 's' : ''}`}</DialogTitle>
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            <Button type="button" variant="secondary" onClick={onClose}>
              Fermer
            </Button>
            <Button type="button" onClick={handleDownload}>
              Télécharger le PDF
            </Button>
          </div>
        </div>
        <div className="flex-1 overflow-hidden p-6">
          <iframe title="Aperçu des cartes adhérent" src={pdfUrl} className="h-full w-full rounded-sm border border-paper-border" />
        </div>
      </DialogContent>
    </Dialog>
  )
}
