import {
  portefeuilleCorsHeaders,
  portefeuilleJson,
  readPortefeuilleBuyerState,
} from '../_shared/portefeuilleAccess.ts'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: portefeuilleCorsHeaders })
  if (req.method !== 'POST') return portefeuilleJson({ error: 'METHODE_INVALIDE' }, 405)

  const result = await readPortefeuilleBuyerState(req, 'etat')
  if (!result.ok) return result.response

  return portefeuilleJson(result.state)
})
