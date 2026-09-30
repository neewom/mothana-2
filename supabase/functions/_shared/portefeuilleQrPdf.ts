import * as QRCode from 'https://esm.sh/qrcode@1.5.4'
import type { PortefeuilleBuyerState } from './portefeuilleAccess.ts'

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;')
}

export async function generatePortefeuilleQrPdf(state: PortefeuilleBuyerState): Promise<ArrayBuffer> {
  const qrDataUrl = await QRCode.toDataURL(state.portefeuille.codePublic, {
    width: 900,
    margin: 2,
    errorCorrectionLevel: 'M',
    color: { dark: '#241f19', light: '#ffffff' },
  })

  const eventName = escapeHtml(state.evenement.nom)
  const organisationName = escapeHtml(state.evenement.organisationNom)
  const publicCode = escapeHtml(state.portefeuille.codePublic)
  const html = `<!doctype html>
<html lang="fr"><head><meta charset="utf-8"><style>
  @page { size: A4 portrait; margin: 18mm; }
  * { box-sizing: border-box; }
  body { margin: 0; color: #241f19; font-family: Inter, Arial, sans-serif; }
  main { min-height: 255mm; display: flex; flex-direction: column; align-items: center;
    justify-content: center; text-align: center; border: 1px solid #e8e4dc; padding: 24mm 18mm; }
  .brand { margin: 0 0 8px; color: #726860; font-size: 14px; }
  h1 { max-width: 18ch; margin: 0; font-size: 34px; line-height: 1.18; }
  img { width: 108mm; height: 108mm; margin: 24px 0; image-rendering: pixelated; }
  .instruction { margin: 0 0 10px; color: #5c5347; font-size: 17px; }
  .code { margin: 0; font-family: "IBM Plex Mono", ui-monospace, monospace;
    font-size: 24px; font-weight: 700; letter-spacing: 0.12em; }
  .note { max-width: 32em; margin: 24px 0 0; color: #726860; font-size: 12px; line-height: 1.5; }
</style></head><body><main>
  <p class="brand">${organisationName}</p>
  <h1>${eventName}</h1>
  <img src="${qrDataUrl}" alt="QR code du portefeuille">
  <p class="instruction">Présentez ce QR code au vendeur</p>
  <p class="code">${publicCode}</p>
  <p class="note">Le code ci-dessus permet une saisie manuelle si le QR code ne peut pas être scanné. Il ne permet pas d'accéder à votre solde.</p>
</main></body></html>`

  const form = new FormData()
  form.append('files', new Blob([html], { type: 'text/html' }), 'index.html')

  const gotenbergUrl = Deno.env.get('GOTENBERG_URL')
  if (!gotenbergUrl) throw new Error('GOTENBERG_URL_MISSING')

  const response = await fetch(`${gotenbergUrl}/forms/chromium/convert/html`, {
    method: 'POST',
    body: form,
    signal: AbortSignal.timeout(20_000),
  })
  if (!response.ok) {
    console.error('Gotenberg wallet QR error:', response.status)
    throw new Error('GOTENBERG_ERROR')
  }

  return response.arrayBuffer()
}
