import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.108.2'
import {
  scheduleBackgroundTask,
  type BackgroundTaskRuntime,
} from '../_shared/backgroundTask.ts'
import { hashClientIp } from '../_shared/rateLimit.ts'
import { sendViaResend } from '../_shared/resend.ts'
import { normaliseSiteUrl } from '../_shared/siteUrl.ts'

// Global fourni par le runtime Supabase. La déclaration locale évite d'importer
// tout le paquet de types functions-js uniquement pour cette primitive.
declare const EdgeRuntime: BackgroundTaskRuntime

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[A-Za-z]{2,24}$/
const GENERIC_BODY = {
  ok: true,
  message: 'Si un portefeuille existe pour cette adresse, un email a été envoyé.',
}

interface RequestBody {
  evenement_id?: unknown
  email?: unknown
  site_url?: unknown
}

interface RecoveryResult {
  ok?: boolean
  secret?: string | null
  envoi_id?: string | null
  evenement_nom?: string | null
  organisation_nom?: string | null
}

function genericResponse(): Response {
  return new Response(JSON.stringify(GENERIC_BODY), {
    status: 200,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
    },
  })
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;')
}

function recoveryEmailHtml(
  organisationName: string,
  eventName: string,
  walletUrl: string,
): string {
  return `<!doctype html><html lang="fr"><body style="font-family: ui-sans-serif, system-ui, sans-serif; background: #f7f4ee; padding: 32px; color: #241f19;">
  <div style="max-width: 520px; margin: 0 auto; background: #ffffff; border-radius: 8px; padding: 32px; border: 1px solid #e8e4dc;">
    <p style="color: #726860; font-size: 13px; margin: 0 0 8px;">${escapeHtml(organisationName)}</p>
    <h1 style="font-size: 22px; margin: 0 0 18px;">Retrouvez votre portefeuille</h1>
    <p style="font-size: 15px; line-height: 1.6;">Voici un nouveau lien d’accès à votre portefeuille pour ${escapeHtml(eventName)}.</p>
    <p style="margin: 24px 0;"><a href="${escapeHtml(walletUrl)}" style="display: inline-block; background: #7f1d1d; color: #ffffff; text-decoration: none; padding: 12px 18px; border-radius: 4px;">Ouvrir mon portefeuille</a></p>
    <p style="font-size: 13px; line-height: 1.5; color: #726860;">Vos liens précédents restent valables. Si vous n’avez pas demandé cet email, vous pouvez l’ignorer.</p>
  </div>
</body></html>`
}

async function sendRecoveryEmail(
  email: string,
  eventName: string,
  organisationName: string,
  walletUrl: string,
  sendId: string,
): Promise<void> {
  try {
    const reference = sendId.replaceAll('-', '').slice(0, 6)
    const emailResult = await sendViaResend(
      email,
      `Votre portefeuille — ${eventName} (réf. ${reference})`,
      recoveryEmailHtml(organisationName, eventName, walletUrl),
      { tags: [{ name: 'secret_id', value: sendId }] },
    )

    if (!emailResult.ok) {
      console.error('Wallet link recovery: Resend failed:', emailResult.detail)
    }
  } catch (error) {
    console.error(
      'Wallet link recovery: Resend threw:',
      error instanceof Error ? error.message : 'unknown',
    )
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return genericResponse()

  try {
    const raw = await req.text()
    if (raw.length > 2048) return genericResponse()

    const body = JSON.parse(raw) as RequestBody
    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : ''
    const siteUrl = normaliseSiteUrl(body.site_url)

    if (typeof body.evenement_id !== 'string'
      || !UUID_PATTERN.test(body.evenement_id)
      || !EMAIL_PATTERN.test(email)
      || email.length > 254
      || !siteUrl) {
      return genericResponse()
    }

    let ipHash: string
    try {
      ipHash = await hashClientIp(req)
    } catch (error) {
      console.error('Wallet link recovery: IP hashing failed:', error instanceof Error ? error.message : 'unknown')
      return genericResponse()
    }

    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      { auth: { persistSession: false } },
    )

    const { data, error } = await admin.rpc('demander_lien_portefeuille', {
      p_evenement_id: body.evenement_id,
      p_email: email,
      p_ip_hash: ipHash,
    })

    if (error) {
      console.error('Wallet link recovery: RPC failed:', error.code)
      return genericResponse()
    }

    const result = data as RecoveryResult | null
    if (typeof result?.secret !== 'string'
      || typeof result.envoi_id !== 'string'
      || typeof result.evenement_nom !== 'string'
      || typeof result.organisation_nom !== 'string') {
      return genericResponse()
    }

    const walletUrl = `${siteUrl}/p#${encodeURIComponent(result.secret)}`
    const eventName = result.evenement_nom
    const organisationName = result.organisation_nom
    const sendId = result.envoi_id
    scheduleBackgroundTask(
      EdgeRuntime,
      () => sendRecoveryEmail(
        email,
        eventName,
        organisationName,
        walletUrl,
        sendId,
      ),
    )
  } catch (error) {
    console.error('Wallet link recovery failed:', error instanceof Error ? error.message : 'unknown')
  }

  return genericResponse()
})
