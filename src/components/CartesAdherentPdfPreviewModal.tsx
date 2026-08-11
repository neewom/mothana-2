import Modal from './Modal'
import SectionHeader from './SectionHeader'

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
  if (!open) return null

  function handleDownload() {
    const link = document.createElement('a')
    link.href = pdfUrl
    link.download = filename
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      maxWidthClassName="max-w-3xl"
      labelledBy="cartes-pdf-preview-title"
      heightClassName="h-[85vh] min-h-[560px]"
    >
      <SectionHeader
        titleId="cartes-pdf-preview-title"
        reserveCloseButton
        title={`Aperçu — ${count} carte${count > 1 ? 's' : ''}`}
        actions={
          <>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
            >
              Fermer
            </button>
            <button
              type="button"
              onClick={handleDownload}
              className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
            >
              Télécharger le PDF
            </button>
          </>
        }
      />
      <div className="flex-1 overflow-hidden p-6">
        <iframe title="Aperçu des cartes adhérent" src={pdfUrl} className="h-full w-full rounded-lg border border-slate-200" />
      </div>
    </Modal>
  )
}
