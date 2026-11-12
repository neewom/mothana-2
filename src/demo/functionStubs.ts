// Spike démo PGlite — remplacement des Edge Functions dans le navigateur.
// verify-pin est réimplémenté (connexion bénévole) ; toutes les autres répondent
// par un message explicatif, sans aucun appel réseau.
import type { EdgeFunction } from 'tinbase'
import { DEMO_ADMIN, DEMO_PIN } from './seed'

const cors = { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' }

const NON_DISPONIBLE: EdgeFunction = () =>
  new Response(JSON.stringify({ error: 'Action indisponible dans la démo : elle nécessite un vrai espace Samakan.' }), { status: 501, headers: cors })

// Liste des Edge Functions du projet (supabase/functions), à tenir à jour.
const EDGE_FUNCTIONS = [
  'brevo-bounce-webhook', 'create-admin', 'creer-organisation', 'decider-portefeuille-paiement', 'delete-org-admins',
  'disable-admin', 'generate-campagne-courrier', 'generate-carte-adherent-template', 'generate-cartes-adherents',
  'generate-portefeuille-qr-pdf', 'generate-recu', 'generate-template-from-pdf', 'get-portefeuille',
  'lire-renouvellement-adhesion', 'register-brevo-webhook', 'renvoyer-acces-portefeuille', 'request-email-change',
  'request-password-reset', 'resend-bounce-webhook', 'send-mailing-brevo', 'send-recu-email', 'simuler-achat-evenement',
  'soumettre-demande-adhesion', 'soumettre-demande-inscription', 'soumettre-renouvellement-adhesion', 'traiter-lots-recus',
  'unsubscribe-mailing', 'update-pin', 'valider-demande-inscription', 'verifier-expediteur-brevo',
]

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
