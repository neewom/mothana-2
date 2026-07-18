import { renderCerfaPreviewHtml } from '../lib/cerfaPreview'
import Modal from './Modal'

interface TemplateRecuPreviewModalProps {
  open: boolean
  onClose: () => void
  nom: string
  htmlTemplate: string
  css: string
}

export default function TemplateRecuPreviewModal({
  open,
  onClose,
  nom,
  htmlTemplate,
  css,
}: TemplateRecuPreviewModalProps) {
  if (!open) return null

  return (
    <Modal open={open} onClose={onClose} maxWidthClassName="max-w-4xl" labelledBy="template-preview-title">
      <div className="border-b border-slate-200 px-6 py-4">
        <h2 id="template-preview-title" className="text-lg font-semibold text-slate-900">
          Aperçu — {nom}
        </h2>
        <p className="mt-0.5 text-xs text-slate-400">Rendu avec des données d'exemple, à titre indicatif.</p>
      </div>
      <div className="overflow-hidden p-6">
        <iframe
          title={`Aperçu du template ${nom}`}
          srcDoc={renderCerfaPreviewHtml(htmlTemplate, css)}
          className="h-[70vh] w-full rounded-lg border border-slate-200"
        />
      </div>
    </Modal>
  )
}
