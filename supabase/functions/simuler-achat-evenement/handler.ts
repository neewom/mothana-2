// Logique de simuler-achat-evenement, séparée de Deno.serve pour être testée avec des
// dépendances factices (handler.test.ts) : base, PDF et email sont injectés.
import type { PortefeuilleBuyerState } from '../_shared/portefeuilleAccess.ts'
import type { sendViaResend } from '../_shared/resend.ts'
import { normaliseSiteUrl } from '../_shared/siteUrl.ts'

export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

// PostgreSQL accepte les UUID canoniques sans imposer les bits de version RFC ;
// les fixtures historiques du projet utilisent notamment une version à zéro.
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[A-Za-z]{2,24}$/

export interface RpcResult {
  data: unknown
  error: { code?: string; message: string } | null
}

export interface SimulationDeps {
  /** Kill-switch SIMULATION_PAIEMENT_ACTIVE. */
  simulationActive: () => boolean
  /** Empreintes HMAC de l'IP cliente et de l'adresse normalisée (_shared/rateLimit.ts). */
  hashIp: (req: Request) => Promise<string>
  hashEmail: (email: string) => Promise<string>
  /** Appel RPC avec la clé service_role. */
  rpc: (fn: string, args: Record<string, unknown>) => Promise<RpcResult>
  genererPdf: (state: PortefeuilleBuyerState) => Promise<ArrayBuffer>
  envoyerEmail: typeof sendViaResend
}

interface PurchaseBody {
  evenement_id?: unknown
  email?: unknown
  montant_centimes?: unknown
  cle_idempotence?: unknown
  site_url?: unknown
}

interface OrderResult {
  id: string
}

interface ActivationResult {
  ok: boolean
  raison: string | null
  portefeuille_id: string | null
  code_public: string | null
  secret: string | null
}

interface WalletStateResult extends Partial<PortefeuilleBuyerState> {
  ok: boolean
  reason?: string
}

interface LimiteResult {
  ok?: boolean
  reason?: string
}

function json(body: unknown, status = 200, extraHeaders: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
      ...extraHeaders,
    },
  })
}

function firstRow<T>(value: unknown): T | null {
  return (Array.isArray(value) ? value[0] : value) as T | null
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;')
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = ''
  const chunkSize = 0x8000
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + chunkSize))
  }
  return btoa(binary)
}

async function sha256(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('')
}

function purchaseEmailHtml(
  organisationName: string,
  eventName: string,
  amountCentimes: number,
  walletUrl: string,
): string {
  const amount = new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
  }).format(amountCentimes / 100)
  return `<!doctype html><html lang="fr"><body style="font-family: ui-sans-serif, system-ui, sans-serif; background: #f7f4ee; padding: 32px; color: #241f19;">
  <div style="max-width: 520px; margin: 0 auto; background: #ffffff; border-radius: 8px; padding: 32px; border: 1px solid #e8e4dc;">
    <p style="color: #726860; font-size: 13px; margin: 0 0 8px;">${escapeHtml(organisationName)}</p>
    <h1 style="font-size: 22px; margin: 0 0 18px;">Votre portefeuille est prêt</h1>
    <p style="font-size: 15px; line-height: 1.6;">Votre crédit de <strong>${escapeHtml(amount)}</strong> pour ${escapeHtml(eventName)} est disponible.</p>
    <p style="margin: 24px 0;"><a href="${escapeHtml(walletUrl)}" style="display: inline-block; background: #7f1d1d; color: #ffffff; text-decoration: none; padding: 12px 18px; border-radius: 4px;">Ouvrir mon portefeuille</a></p>
    <p style="font-size: 13px; line-height: 1.5; color: #726860;">Le PDF joint contient aussi votre QR code à présenter au vendeur.</p>
    <p style="font-size: 12px; line-height: 1.5; color: #9a9189; margin-top: 24px;">Mode démonstration : aucun paiement réel n'a été effectué.</p>
  </div>
</body></html>`
}

export async function traiterDemande(
  req: Request,
  deps: SimulationDeps,
): Promise<Response> {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'METHODE_INVALIDE' }, 405)

  // Kill-switch volontairement strict : absent, vide, "1" ou toute autre valeur
  // laissent le crédit simulé désactivé.
  if (!deps.simulationActive()) {
    return json({ error: 'SIMULATION_DESACTIVEE' }, 503)
  }

  try {
    const raw = await req.text()
    if (raw.length > 2048) return json({ error: 'REQUETE_INVALIDE' }, 400)
    const body = JSON.parse(raw) as PurchaseBody
    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : ''
    const siteUrl = normaliseSiteUrl(body.site_url)

    if (typeof body.evenement_id !== 'string'
      || !UUID_PATTERN.test(body.evenement_id)
      || !EMAIL_PATTERN.test(email)
      || email.length > 254
      || !Number.isInteger(body.montant_centimes)
      || (body.montant_centimes as number) <= 0
      || typeof body.cle_idempotence !== 'string'
      || !UUID_PATTERN.test(body.cle_idempotence)
      || !siteUrl) {
      return json({ error: 'REQUETE_INVALIDE' }, 400)
    }

    // Audit sécurité 2026-10-24 : limite par IP (5 / heure) et par adresse (3 / jour),
    // avant toute écriture, génération de PDF ou envoi d'email. Toute erreur du
    // limiteur refuse la demande.
    let ipHash: string
    let emailHash: string
    try {
      ipHash = await deps.hashIp(req)
      emailHash = await deps.hashEmail(email)
    } catch {
      console.error('Simulated purchase: rate limiter is not configured')
      return json({ error: 'SERVICE_INDISPONIBLE' }, 503)
    }
    const { data: limiteData, error: limiteError } = await deps.rpc('verifier_limite_simulation_achat', {
      p_ip_hash: ipHash,
      p_email_hash: emailHash,
    })
    const limite = limiteData as LimiteResult | null
    if (limiteError || limite?.ok !== true) {
      if (!limiteError && limite?.reason === 'RATE_LIMIT') {
        return json({ error: 'TROP_DE_REQUETES' }, 429, { 'Retry-After': '3600' })
      }
      console.error('Simulated purchase: rate limit failed:', limiteError?.code ?? limite?.reason)
      return json({ error: 'SERVICE_INDISPONIBLE' }, 503)
    }

    const { data: orderData, error: orderError } = await deps.rpc('creer_commande_en_attente', {
      p_evenement_id: body.evenement_id,
      p_email: email,
      p_montant_centimes: body.montant_centimes,
      p_cle_idempotence: body.cle_idempotence,
      p_portefeuille_id: null,
    })
    if (orderError) {
      const knownReason = ['EVENEMENT_INTROUVABLE', 'EVENEMENT_CLOS', 'EVENEMENT_NON_OUVERT', 'MODULE_DESACTIVE', 'EMAIL_INVALIDE', 'MONTANT_INVALIDE']
        .find((reason) => orderError.message.includes(reason))
      if (knownReason) return json({ error: knownReason }, 422)
      console.error('Simulated purchase: order creation failed:', orderError.code)
      return json({ error: 'SERVICE_INDISPONIBLE' }, 503)
    }

    const order = firstRow<OrderResult>(orderData)
    if (!order?.id) {
      console.error('Simulated purchase: invalid order result')
      return json({ error: 'SERVICE_INDISPONIBLE' }, 503)
    }

    const paymentReference = `simulation:${order.id}:${crypto.randomUUID()}`
    const { data: activationData, error: activationError } = await deps.rpc('activer_commande', {
      p_commande_id: order.id,
      p_reference_paiement: paymentReference,
    })
    if (activationError) {
      console.error('Simulated purchase: activation failed:', activationError.code)
      return json({ error: 'SERVICE_INDISPONIBLE' }, 503)
    }

    const activation = firstRow<ActivationResult>(activationData)
    if (!activation?.ok || !activation.portefeuille_id || !activation.code_public) {
      return json({ error: activation?.raison ?? 'ACTIVATION_IMPOSSIBLE' }, 422)
    }
    if (!activation.secret) {
      // La même clé a déjà été traitée : ne jamais recréditer ni fabriquer un
      // nouveau secret en dehors de la RPC. L'appel initial a pu perdre sa
      // réponse avant ou après l'envoi de l'email : rester factuel.
      return json({ error: 'COMMANDE_DEJA_TRAITEE' }, 409)
    }

    // Le crédit est déjà appliqué à ce stade (activation.secret prouve que la
    // RPC a bien débité la commande). Le lien reste valable même si le PDF ou
    // l'email échouent ensuite : ne jamais faire dépendre la réponse de leur
    // succès, pour ne pas créer un portefeuille crédité mais inaccessible.
    const walletUrl = `${siteUrl}/p#${encodeURIComponent(activation.secret)}`
    let emailEnvoye = false

    try {
      const secretHash = await sha256(activation.secret)
      const { data: stateData, error: stateError } = await deps.rpc('lire_portefeuille_par_secret_hash', {
        p_secret_hash: secretHash,
        p_ip_hash: await sha256(`simulated-purchase:${order.id}`),
        p_scope: 'pdf',
      })
      const stateResult = stateData as WalletStateResult | null
      if (stateError || !stateResult?.ok || !stateResult.portefeuille || !stateResult.evenement
        || !Array.isArray(stateResult.mouvements) || typeof stateResult.revision !== 'number') {
        throw new Error(`wallet state unavailable: ${stateError?.code ?? stateResult?.reason}`)
      }

      const state: PortefeuilleBuyerState = {
        revision: stateResult.revision,
        portefeuille: stateResult.portefeuille,
        evenement: stateResult.evenement,
        mouvements: stateResult.mouvements,
        demandeEnAttente: stateResult.demandeEnAttente ?? null,
      }
      const pdf = await deps.genererPdf(state)
      const emailResult = await deps.envoyerEmail(
        email,
        `Votre portefeuille — ${state.evenement.nom} (réf. ${order.id.replaceAll('-', '').slice(0, 6)})`,
        purchaseEmailHtml(
          state.evenement.organisationNom,
          state.evenement.nom,
          body.montant_centimes as number,
          walletUrl,
        ),
        {
          tags: [{ name: 'commande_id', value: order.id }],
          attachments: [{
            filename: `portefeuille-${activation.code_public}.pdf`,
            content: bytesToBase64(new Uint8Array(pdf)),
          }],
        },
      )
      if (!emailResult.ok) throw new Error(`Resend failed: ${emailResult.detail}`)
      emailEnvoye = true
    } catch (notificationError) {
      // Best-effort : le crédit reste acquis, seule la notification échoue.
      console.error('Simulated purchase: notification failed:', notificationError instanceof Error ? notificationError.message : notificationError)
    }

    return json({
      ok: true,
      portefeuille_url: walletUrl,
      code_public: activation.code_public,
      montant_centimes: body.montant_centimes,
      email_envoye: emailEnvoye,
    })
  } catch (error) {
    console.error('Simulated purchase error:', error instanceof Error ? error.message : 'unknown')
    return json({ error: 'REQUETE_INVALIDE' }, 400)
  }
}
