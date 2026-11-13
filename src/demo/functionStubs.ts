// Remplacement des Edge Functions dans le navigateur. verify-pin est réimplémenté (connexion
// bénévole) ; toutes les autres répondent 501 avec un message que l'application affiche tel quel
// (ex. panneau d'un reçu), sans aucun appel réseau.
import type { EdgeFunction } from 'tinbase'
import { DEMO_ADMIN, DEMO_PIN } from './seed'
import { ACTION_INDISPONIBLE } from './messages'
import { EDGE_FUNCTIONS } from './edgeFunctions'

const cors = { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' }

const NON_DISPONIBLE: EdgeFunction = () =>
  new Response(JSON.stringify({ error: ACTION_INDISPONIBLE }), { status: 501, headers: cors })

const verifyPin: EdgeFunction = async (req, ctx) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  const { pin, role } = (await req.json().catch(() => ({}))) as { pin?: string; role?: string }
  if (role === 'vendeur') return NON_DISPONIBLE(req, ctx)
  if (pin !== DEMO_PIN) return new Response(JSON.stringify({ error: `Code PIN invalide (démo : ${DEMO_PIN})` }), { status: 401, headers: cors })
  // Une seule organisation dans la démo : son compte technique bénévole est déjà créé par le seed.
  const self = new URL(req.url).origin
  const orgRes = await fetch(`${self}/rest/v1/organisations?select=id&limit=1`, {
    headers: { apikey: ctx.env.SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${ctx.env.SUPABASE_SERVICE_ROLE_KEY}` },
  })
  const [org] = (await orgRes.json()) as { id: string }[]
  const tokenRes = await fetch(`${self}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { apikey: ctx.env.SUPABASE_ANON_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: `benevole-${org.id}@mothana.internal`, password: DEMO_ADMIN.password }),
  })
  const session = (await tokenRes.json()) as { access_token: string; refresh_token: string }
  return new Response(JSON.stringify({ access_token: session.access_token, refresh_token: session.refresh_token, organisation_id: org.id }), { headers: cors })
}

export function demoFunctions(): Map<string, EdgeFunction> {
  const m = new Map<string, EdgeFunction>(EDGE_FUNCTIONS.map((n) => [n, NON_DISPONIBLE]))
  m.set('verify-pin', verifyPin)
  return m
}
