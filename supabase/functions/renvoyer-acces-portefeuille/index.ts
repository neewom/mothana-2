import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.108.2'
import { sendViaResend } from '../_shared/resend.ts'
import { normaliseSiteUrl } from '../_shared/siteUrl.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[A-Za-z]{2,24}$/

interface RequestBody {
  portefeuille_id?: unknown
  nouvel_email?: unknown
  revoquer_anciens?: unknown
  envoyer_email?: unknown
  site_url?: unknown
}

interface RpcResult {
  secret?: string | null
  secret_id?: string | null
  email?: string | null
  evenement_nom?: string | null
  organisation_nom?: string | null
}

function json(body: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
    },
  })
}

function firstRow<T>(value: T | T[] | null): T | null {
  return Array.isArray(value) ? value[0] ?? null : value
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
  previousLinksRevoked: boolean,
): string {
  const accessNote = previousLinksRevoked
    ? 'Vos anciens liens ont été révoqués. Utilisez désormais uniquement ce nouvel accès.'
    : 'Vos liens précédents restent valables.'

  return `<!doctype html><html lang="fr"><body style="font-family: ui-sans-serif, system-ui, sans-serif; background: #f7f4ee; padding: 32px; color: #241f19;">
  <div style="max-width: 520px; margin: 0 auto; background: #ffffff; border-radius: 8px; padding: 32px; border: 1px solid #e8e4dc;">
    <p style="color: #726860; font-size: 13px; margin: 0 0 8px;">${escapeHtml(organisationName)}</p>
    <h1 style="font-size: 22px; margin: 0 0 18px;">Votre nouveau lien d’accès</h1>
    <p style="font-size: 15px; line-height: 1.6;">Un organisateur vous transmet un nouveau lien vers votre portefeuille pour ${escapeHtml(eventName)}.</p>
    <p style="margin: 24px 0;"><a href="${escapeHtml(walletUrl)}" style="display: inline-block; background: #7f1d1d; color: #ffffff; text-decoration: none; padding: 12px 18px; border-radius: 4px;">Ouvrir mon portefeuille</a></p>
    <p style="font-size: 13px; line-height: 1.5; color: #726860;">${escapeHtml(accessNote)} Conservez ce message en lieu sûr.</p>
  </div>
</body></html>`
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'METHODE_INVALIDE' }, 405)

  try {
    const authHeader = req.headers.get('authorization')
    if (!authHeader) return json({ error: 'NON_AUTORISE' }, 401)

    const raw = await req.text()
    if (raw.length > 4096) return json({ error: 'REQUETE_INVALIDE' }, 400)

    let body: RequestBody
    try {
      body = JSON.parse(raw) as RequestBody
    } catch {
      return json({ error: 'REQUETE_INVALIDE' }, 400)
    }

    const email = typeof body.nouvel_email === 'string'
      ? body.nouvel_email.trim().toLowerCase()
      : ''
    const siteUrl = normaliseSiteUrl(body.site_url)

    if (typeof body.portefeuille_id !== 'string'
      || !UUID_PATTERN.test(body.portefeuille_id)
      || !EMAIL_PATTERN.test(email)
      || email.length > 254
      || typeof body.revoquer_anciens !== 'boolean'
      || typeof body.envoyer_email !== 'boolean'
      || !siteUrl) {
      return json({ error: 'REQUETE_INVALIDE' }, 400)
    }

    const userClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      {
        global: { headers: { Authorization: authHeader } },
        auth: { persistSession: false },
      },
    )

    const { data: { user }, error: userError } = await userClient.auth.getUser()
    if (userError || !user) return json({ error: 'NON_AUTORISE' }, 401)

    const { data, error } = await userClient.rpc('renvoyer_acces_portefeuille', {
      p_portefeuille_id: body.portefeuille_id,
      p_nouvel_email: email,
      p_revoquer_anciens: body.revoquer_anciens,
    })

    if (error) {
      const knownError = ['EMAIL_DEJA_UTILISE', 'EMAIL_INVALIDE', 'PORTEFEUILLE_INTROUVABLE', 'PORTEFEUILLE_ANONYMISE']
        .find((code) => error.message.includes(code))
      if (knownError) return json({ ok: false, error: knownError })
      // Collision concurrente : deux corrections simultanées vers la même adresse passent
      // le contrôle préalable de la RPC, la contrainte unique (evenement, email) tranche.
      if (error.code === '23505') return json({ ok: false, error: 'EMAIL_DEJA_UTILISE' })
      if (error.code === '42501' || error.message.includes('ACCES_INTERDIT')) {
        return json({ error: 'ACCES_INTERDIT' }, 403)
      }
      console.error('Wallet access resend: RPC failed:', error.code)
      return json({ error: 'SERVICE_INDISPONIBLE' }, 503)
    }

    const result = firstRow<RpcResult>(data)
    if (!result?.secret || !result.secret_id || !result.email
      || !result.evenement_nom || !result.organisation_nom) {
      console.error('Wallet access resend: invalid RPC result')
      return json({ error: 'SERVICE_INDISPONIBLE' }, 503)
    }

    const walletUrl = `${siteUrl}/p#${encodeURIComponent(result.secret)}`
    if (body.envoyer_email) {
      const reference = result.secret_id.replaceAll('-', '').slice(0, 6)
      const emailResult = await sendViaResend(
        result.email,
        `Votre portefeuille — ${result.evenement_nom} (réf. ${reference})`,
        recoveryEmailHtml(
          result.organisation_nom,
          result.evenement_nom,
          walletUrl,
          body.revoquer_anciens,
        ),
        { tags: [{ name: 'secret_id', value: result.secret_id }] },
      )

      if (!emailResult.ok) {
        console.error('Wallet access resend: Resend failed:', emailResult.detail)
        return json({
          ok: false,
          error: 'EMAIL_NON_ENVOYE',
          portefeuille_url: walletUrl,
          email: result.email,
        })
      }
    }

    return json({
      ok: true,
      portefeuille_url: walletUrl,
      email: result.email,
      email_envoye: body.envoyer_email,
    })
  } catch (error) {
    console.error(
      'Wallet access resend failed:',
      error instanceof Error ? error.message : 'unknown',
    )
    return json({ error: 'SERVICE_INDISPONIBLE' }, 503)
  }
})
