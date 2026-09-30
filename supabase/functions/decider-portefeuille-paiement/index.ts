import {
  isPortefeuilleSecretHash,
  portefeuilleAdminClient,
  portefeuilleCorsHeaders,
  portefeuilleJson,
} from '../_shared/portefeuilleAccess.ts'

interface DecisionBody {
  secret_hash?: unknown
  demande_id?: unknown
  valider?: unknown
}

interface ResolvedWallet {
  portefeuille_id: string
}

interface DecisionResult {
  ok: boolean
  raison: string | null
  statut: string | null
  solde_apres_centimes: number | null
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function firstRow<T>(value: unknown): T | null {
  return (Array.isArray(value) ? value[0] : value) as T | null
}

async function broadcastSellerWakeup(requestId: string): Promise<void> {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  try {
    const response = await fetch(`${supabaseUrl}/realtime/v1/api/broadcast`, {
      method: 'POST',
      signal: AbortSignal.timeout(1500),
      headers: {
        apikey: serviceRoleKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messages: [{
          topic: `coupon-payment:${requestId}`,
          event: 'changed',
          payload: {},
          private: false,
        }],
      }),
    })
    if (!response.ok) console.warn('Coupon payment decision: seller broadcast unavailable')
  } catch {
    console.warn('Coupon payment decision: seller broadcast unavailable')
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: portefeuilleCorsHeaders })
  if (req.method !== 'POST') return portefeuilleJson({ error: 'METHODE_INVALIDE' }, 405)

  try {
    const raw = await req.text()
    if (raw.length > 1024) return portefeuilleJson({ error: 'REQUETE_INVALIDE' }, 400)

    const body = JSON.parse(raw) as DecisionBody
    if (!isPortefeuilleSecretHash(body.secret_hash)
      || typeof body.demande_id !== 'string'
      || !UUID_PATTERN.test(body.demande_id)
      || typeof body.valider !== 'boolean') {
      return portefeuilleJson({ error: 'REQUETE_INVALIDE' }, 400)
    }

    const admin = portefeuilleAdminClient()
    const { data: resolvedData, error: resolveError } = await admin.rpc(
      'resoudre_hash_secret_portefeuille',
      { p_secret_hash: body.secret_hash },
    )
    if (resolveError) {
      console.error('Coupon payment decision: wallet resolution failed:', resolveError.code)
      return portefeuilleJson({ error: 'SERVICE_INDISPONIBLE' }, 503)
    }

    const resolved = firstRow<ResolvedWallet>(resolvedData)
    if (!resolved?.portefeuille_id) {
      return portefeuilleJson({ error: 'LIEN_INVALIDE' }, 404)
    }

    const { data, error } = await admin.rpc('decider_demande_paiement', {
      p_portefeuille_id: resolved.portefeuille_id,
      p_demande_id: body.demande_id,
      p_valider: body.valider,
    })
    if (error) {
      console.error('Coupon payment decision failed:', error.code)
      return portefeuilleJson({ error: 'SERVICE_INDISPONIBLE' }, 503)
    }

    const result = firstRow<DecisionResult>(data)
    if (!result) {
      console.error('Coupon payment decision returned an invalid shape')
      return portefeuilleJson({ error: 'SERVICE_INDISPONIBLE' }, 503)
    }

    await broadcastSellerWakeup(body.demande_id)
    return portefeuilleJson(result)
  } catch {
    return portefeuilleJson({ error: 'REQUETE_INVALIDE' }, 400)
  }
})
