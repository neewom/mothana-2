import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { hashClientIp } from '../_shared/rateLimit.ts'
import { sendViaResend } from '../_shared/resend.ts'
import { escapeHtml, motifIlikeExact, validerDemandeAdhesion } from './validation.ts'
import { lienPageDemandes } from './notificationAdmins.ts'
import { prevenirComptesOrganisation } from './prevenirComptes.ts'

// Tâches poursuivies après la réponse (runtime Supabase Edge) ; absent en local → attendues.
declare const EdgeRuntime: { waitUntil(promise: Promise<unknown>): void } | undefined

// Soumission du formulaire public d'adhésion (/adhesion/<slug>) — cadré 2026-10-17 (carte
// Trello « Sécurité : le formulaire d'adhésion en ligne et son email de confirmation peuvent
// être détournés »). Seul chemin d'écriture dans demandes_adhesion pour un visiteur : plus
// d'insert anonyme (policy retirée) ni de trigger pg_net vers send-demande-confirmation
// (supprimée, elle envoyait un email à n'importe quel `record` reçu).
//   1. limite de débit par IP (empreinte HMAC, même mécanisme que verify-pin) ;
//   2. champ piège rempli → succès apparent, rien n'est écrit ni envoyé ;
//   3. validation complète côté serveur, organisation résolue depuis son slug ;
//   4. insertion en service_role, puis email de confirmation (texte saisi échappé, tag
//      demande_id conservé pour resend-bounce-webhook).
// Réponses volontairement génériques : la cause d'un refus n'est jamais détaillée.

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Une famille peut remplir plusieurs demandes depuis le même téléphone ou la même box : 10 par
// heure et par IP laisse passer ce cas tout en bornant un envoi en masse (fenêtre en SQL).
const RETRY_AFTER_SECONDS = '3600'
// Confirmations envoyées à une même adresse sur 24 h au-delà desquelles la demande est
// enregistrée sans email (évite d'inonder une boîte en changeant d'IP).
const CONFIRMATIONS_PAR_ADRESSE_24H = 3

function jsonResponse(body: unknown, status = 200, extraHeaders: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json', 'Cache-Control': 'no-store', ...extraHeaders },
  })
}

const invalide = () => jsonResponse({ error: 'DEMANDE_INVALIDE' }, 400)
const indisponible = () => jsonResponse({ error: 'SERVICE_INDISPONIBLE' }, 503)

function confirmationEmailHtml(nomAffiche: string): string {
  return `<!doctype html><html><body style="font-family: ui-sans-serif, system-ui, sans-serif; background: #f8fafc; padding: 32px;">
  <div style="max-width: 480px; margin: 0 auto; background: #ffffff; border-radius: 16px; padding: 32px; border: 1px solid #e2e8f0;">
    <h1 style="color: #0f172a; font-size: 20px; margin: 0 0 16px;">Demande d'adhésion bien reçue</h1>
    <p style="color: #475569; font-size: 14px; line-height: 1.5;">Bonjour ${escapeHtml(nomAffiche)},</p>
    <p style="color: #475569; font-size: 14px; line-height: 1.5;">Votre demande d'adhésion a bien été reçue. Elle sera examinée prochainement par le conseil d'administration, qui reviendra vers vous.</p>
    <p style="color: #94a3b8; font-size: 12px;">Vous recevez cet email car cette adresse a été renseignée dans un formulaire d'adhésion.</p>
  </div>
</body></html>`
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return jsonResponse({ error: 'METHODE_NON_AUTORISEE' }, 405)

  const adminClient = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
    auth: { persistSession: false },
  })

  // 1. Limite de débit, avant toute lecture du corps.
  let ipHash: string
  try {
    ipHash = await hashClientIp(req)
  } catch {
    console.error('soumettre-demande-adhesion: rate limiter is not configured')
    return indisponible()
  }
  const { data: limite, error: limiteError } = await adminClient.rpc('verifier_limite_demande_adhesion', { p_ip_hash: ipHash })
  if (limiteError) {
    console.error('soumettre-demande-adhesion: rate limit failed', limiteError.code)
    return indisponible()
  }
  const resultatLimite = limite as { ok: boolean; reason?: string } | null
  if (!resultatLimite?.ok) {
    if (resultatLimite?.reason === 'RATE_LIMIT') {
      return jsonResponse({ error: 'TROP_DE_REQUETES' }, 429, { 'Retry-After': RETRY_AFTER_SECONDS })
    }
    return indisponible()
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return invalide()
  }

  // 2. Champ piège : succès apparent, rien d'écrit.
  const corps = body as Record<string, unknown> | null
  if (corps && typeof corps.site_web === 'string' && corps.site_web.trim() !== '') {
    return jsonResponse({ ok: true })
  }

  // 3. Organisation depuis le slug, puis validation complète.
  const slug = corps && typeof corps.slug === 'string' ? corps.slug.trim() : ''
  if (!slug || slug.length > 100) return invalide()
  const { data: organisation, error: orgError } = await adminClient
    .from('organisations')
    .select('id, statuts_url, notif_demandes_adhesion')
    .eq('slug', slug)
    .maybeSingle()
  if (orgError) {
    console.error('soumettre-demande-adhesion: organisation lookup failed', orgError.code)
    return indisponible()
  }
  if (!organisation) return invalide()

  const validation = validerDemandeAdhesion(body, Boolean(organisation.statuts_url))
  if (!validation.ok) return invalide()
  const { slug: _slug, ...demande } = validation.demande

  // Plafond de confirmations par adresse (casse ignorée), compté avant l'insertion de cette demande.
  let envoyerEmail = Boolean(demande.courriel)
  if (demande.courriel) {
    const { count, error: countError } = await adminClient
      .from('demandes_adhesion')
      .select('id', { count: 'exact', head: true })
      .ilike('courriel', motifIlikeExact(demande.courriel))
      .gt('created_at', new Date(Date.now() - 24 * 3600 * 1000).toISOString())
    if (countError || (count ?? 0) >= CONFIRMATIONS_PAR_ADRESSE_24H) envoyerEmail = false
  }

  // 4. Insertion, puis email best-effort.
  const { data: inseree, error: insertError } = await adminClient
    .from('demandes_adhesion')
    .insert({ ...demande, organisation_id: organisation.id, statut: 'en_attente' })
    .select('id')
    .single()
  if (insertError || !inseree) {
    console.error('soumettre-demande-adhesion: insert failed', insertError?.code)
    return invalide()
  }

  if (envoyerEmail && demande.courriel) {
    const nomAffiche = demande.prenom ? `${demande.prenom} ${demande.nom}` : demande.nom
    const emailResult = await sendViaResend(
      demande.courriel,
      'Votre demande d\'adhésion a bien été reçue',
      confirmationEmailHtml(nomAffiche),
      { tags: [{ name: 'demande_id', value: inseree.id }] },
    )
    if (!emailResult.ok) console.error('soumettre-demande-adhesion: Resend error', emailResult.detail)
  }

  // 5. Comptes de l'organisation prévenus, en tâche de fond : la réponse au demandeur n'attend
  // pas Resend et ne dépend pas de son succès.
  // Coupé pour l'organisation (Paramètres → Adhésions) : aucun email.
  if (organisation.notif_demandes_adhesion) {
    const notification = prevenirComptesOrganisation(adminClient, organisation.id, lienPageDemandes(corps?.site_url, Deno.env.get('SUPABASE_URL')), 'adhesion')
      .catch((err) => console.error('soumettre-demande-adhesion: notification des comptes impossible', String(err)))
    if (typeof EdgeRuntime !== 'undefined') EdgeRuntime.waitUntil(notification)
    else await notification
  }

  return jsonResponse({ ok: true })
})
