import { createClient, type SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.108.2'
import { hashClientIp } from './rateLimit.ts'

export const portefeuilleCorsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

export interface PortefeuilleMovement {
  type: 'credit_initial' | 'credit_recharge' | 'debit'
  montantCentimes: number
  soldeApresCentimes: number
  createdAt: string
}

export interface PortefeuilleBuyerState {
  portefeuille: {
    codePublic: string
    soldeCentimes: number
    gele: boolean
  }
  evenement: {
    nom: string
    dateDebut: string
    dateFin: string
    statut: 'brouillon' | 'ouvert' | 'clos'
    organisationNom: string
  }
  mouvements: PortefeuilleMovement[]
  demandeEnAttente: {
    id: string
    montantCentimes: number
    expireLe: string
    createdAt: string
  } | null
}

interface WalletRpcResult extends Partial<PortefeuilleBuyerState> {
  ok: boolean
  reason?: 'ACCES_INVALIDE' | 'RATE_LIMIT'
}

export function portefeuilleJson(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...portefeuilleCorsHeaders,
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
    },
  })
}

async function parseSecretHash(req: Request): Promise<string | null> {
  const raw = await req.text()
  if (raw.length > 512) return null

  try {
    const body = JSON.parse(raw) as { secret_hash?: unknown }
    return typeof body.secret_hash === 'string' && /^[0-9a-f]{64}$/.test(body.secret_hash)
      ? body.secret_hash
      : null
  } catch {
    return null
  }
}

function adminClient(): SupabaseClient {
  return createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { auth: { persistSession: false } },
  )
}

export async function readPortefeuilleBuyerState(
  req: Request,
  scope: 'etat' | 'pdf',
): Promise<
  | { ok: true; state: PortefeuilleBuyerState }
  | { ok: false; response: Response }
> {
  const secretHash = await parseSecretHash(req)
  if (!secretHash) {
    return { ok: false, response: portefeuilleJson({ error: 'LIEN_INVALIDE' }, 404) }
  }

  let ipHash: string
  try {
    ipHash = await hashClientIp(req)
  } catch {
    console.error('Portefeuille rate limiter is not configured')
    return { ok: false, response: portefeuilleJson({ error: 'SERVICE_INDISPONIBLE' }, 503) }
  }

  const { data, error } = await adminClient().rpc('lire_portefeuille_par_secret_hash', {
    p_secret_hash: secretHash,
    p_ip_hash: ipHash,
    p_scope: scope,
  })

  if (error) {
    console.error('Portefeuille read failed:', error.code)
    return { ok: false, response: portefeuilleJson({ error: 'SERVICE_INDISPONIBLE' }, 503) }
  }

  const result = data as WalletRpcResult | null
  if (!result?.ok) {
    if (result?.reason === 'RATE_LIMIT') {
      return {
        ok: false,
        response: new Response(JSON.stringify({ error: 'TROP_DE_REQUETES' }), {
          status: 429,
          headers: {
            ...portefeuilleCorsHeaders,
            'Content-Type': 'application/json',
            'Cache-Control': 'no-store',
            'Retry-After': scope === 'pdf' ? '300' : '60',
          },
        }),
      }
    }
    return { ok: false, response: portefeuilleJson({ error: 'LIEN_INVALIDE' }, 404) }
  }

  const { portefeuille, evenement, mouvements, demandeEnAttente } = result
  if (!portefeuille || !evenement || !Array.isArray(mouvements)) {
    console.error('Portefeuille read returned an invalid shape')
    return { ok: false, response: portefeuilleJson({ error: 'SERVICE_INDISPONIBLE' }, 503) }
  }

  return {
    ok: true,
    state: { portefeuille, evenement, mouvements, demandeEnAttente: demandeEnAttente ?? null },
  }
}
