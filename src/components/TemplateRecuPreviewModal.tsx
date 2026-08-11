import { useEffect, useState } from 'react'
import { renderCerfaPreviewHtml, fetchOrganisationPreviewOverrides } from '../lib/cerfaPreview'
import { fetchOrganisationAssets, buildAssetPlaceholders } from '../lib/organisationAssets'
import Modal from './Modal'

interface TemplateRecuPreviewModalProps {
  open: boolean
  onClose: () => void
  nom: string
  htmlTemplate: string
  css: string
  organisationId: string
  typeCerfa: '11580' | '16216'
}

export default function TemplateRecuPreviewModal({
  open,
  onClose,
  nom,
  htmlTemplate,
  css,
  organisationId,
  typeCerfa,
}: TemplateRecuPreviewModalProps) {
  const [dynamicPlaceholders, setDynamicPlaceholders] = useState<Record<string, string>>({})

  useEffect(() => {
    if (!open) return
    fetchOrganisationAssets(organisationId)
      .then((assets) => setDynamicPlaceholders((prev) => ({ ...prev, ...buildAssetPlaceholders(assets) })))
      .catch(() => {})
    fetchOrganisationPreviewOverrides(organisationId, typeCerfa)
      .then((overrides) => setDynamicPlaceholders((prev) => ({ ...prev, ...overrides })))
      .catch(() => {})
  }, [open, organisationId, typeCerfa])

  if (!open) return null

  return (
    <Modal open={open} onClose={onClose} maxWidthClassName="max-w-4xl" labelledBy="template-preview-title">
      <div className="border-b border-slate-200 px-6 py-4 pr-12">
        <h2 id="template-preview-title" className="text-lg font-semibold text-slate-900">
          Aperçu — {nom}
        </h2>
        <p className="mt-0.5 text-xs text-slate-500">Rendu avec des données d'exemple, à titre indicatif.</p>
      </div>
      <div className="overflow-hidden p-6">
        <iframe
          title={`Aperçu du template ${nom}`}
          srcDoc={renderCerfaPreviewHtml(htmlTemplate, css, dynamicPlaceholders)}
          className="h-[70vh] w-full rounded-lg border border-slate-200"
        />
      </div>
    </Modal>
  )
}
