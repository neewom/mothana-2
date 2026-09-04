import { useEffect, useState } from 'react'
import { renderCerfaPreviewHtml, fetchOrganisationPreviewOverrides } from '../lib/cerfaPreview'
import { fetchOrganisationAssets, buildAssetPlaceholders } from '../lib/organisationAssets'
import { Dialog, DialogContent } from './ui/dialog'

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

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next) onClose() }}>
      <DialogContent className="max-w-4xl" aria-describedby={undefined}>
        <div className="shrink-0 border-b border-paper-border px-6 py-4 pr-12">
          <h2 className="font-registre text-lg font-semibold text-ink">Aperçu — {nom}</h2>
          <p className="mt-0.5 text-xs text-ink-faint">Rendu avec des données d'exemple, à titre indicatif.</p>
        </div>
        <div className="flex-1 overflow-y-auto p-6">
          <iframe
            title={`Aperçu du template ${nom}`}
            srcDoc={renderCerfaPreviewHtml(htmlTemplate, css, dynamicPlaceholders)}
            className="h-[70dvh] w-full rounded-sm border border-paper-border"
          />
        </div>
      </DialogContent>
    </Dialog>
  )
}
