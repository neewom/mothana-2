import {
  portefeuilleCorsHeaders,
  portefeuilleJson,
  readPortefeuilleBuyerState,
} from '../_shared/portefeuilleAccess.ts'
import { generatePortefeuilleQrPdf } from '../_shared/portefeuilleQrPdf.ts'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: portefeuilleCorsHeaders })
  if (req.method !== 'POST') return portefeuilleJson({ error: 'METHODE_INVALIDE' }, 405)

  const result = await readPortefeuilleBuyerState(req, 'pdf')
  if (!result.ok) return result.response

  try {
    const pdf = await generatePortefeuilleQrPdf(result.state)
    return new Response(pdf, {
      status: 200,
      headers: {
        ...portefeuilleCorsHeaders,
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="portefeuille-${result.state.portefeuille.codePublic}.pdf"`,
        'Cache-Control': 'no-store',
      },
    })
  } catch {
    return portefeuilleJson({ error: 'GENERATION_PDF_IMPOSSIBLE' }, 502)
  }
})
