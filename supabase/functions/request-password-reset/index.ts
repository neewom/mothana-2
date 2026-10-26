import { createClient, type SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { hashClientIp, hashValeur } from '../_shared/rateLimit.ts'
import { sendViaResend } from '../_shared/resend.ts'
import { normaliseSiteUrl } from '../_shared/siteUrl.ts'

declare const EdgeRuntime: { waitUntil(promise: Promise<unknown>): void }

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function resetPasswordEmailHtml(actionLink: string): string {
  return `<!doctype html><html><body style="font-family: ui-sans-serif, system-ui, sans-serif; background: #f8fafc; padding: 32px;">
  <div style="max-width: 480px; margin: 0 auto; background: #ffffff; border-radius: 16px; padding: 32px; border: 1px solid #e2e8f0;">
    <h1 style="color: #0f172a; font-size: 20px; margin: 0 0 16px;">Réinitialisation de mot de passe</h1>
    <p style="color: #475569; font-size: 14px; line-height: 1.5;">Une demande de réinitialisation de mot de passe a été effectuée pour votre compte Samakan. Cliquez sur le bouton ci-dessous pour choisir un nouveau mot de passe.</p>
    <p style="margin: 24px 0;">
      <a href="${actionLink}" style="background: #4f46e5; color: #ffffff; padding: 10px 20px; border-radius: 8px; text-decoration: none; font-size: 14px; font-weight: 600;">Réinitialiser mon mot de passe</a>
    </p>
    <p style="color: #94a3b8; font-size: 12px;">Si vous n'êtes pas à l'origine de cette demande, vous pouvez ignorer cet email — votre mot de passe actuel reste inchangé.</p>
  </div>
</body></html>`
}

async function envoyerLienReinitialisation(
  adminClient: SupabaseClient,
  email: string,
  siteUrl: string,
): Promise<void> {
  try {
    const { data: linkData, error: linkError } = await adminClient.auth.admin.generateLink({
      type: 'recovery',
      email,
      options: { redirectTo: `${siteUrl}/mot-de-passe/nouveau` },
    })

    if (linkError || !linkData?.properties?.action_link) {
      // Compte inexistant ou autre erreur : rien n'est révélé au client
      console.error('generateLink (recovery) error:', linkError?.message)
      return
    }

    const emailResult = await sendViaResend(email, 'Réinitialisation de votre mot de passe Samakan', resetPasswordEmailHtml(linkData.properties.action_link))
    if (!emailResult.ok) {
      console.error('Resend error:', emailResult.detail)
    }
  } catch (err) {
    console.error('request-password-reset background error:', err)
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  // Réponse générique dans tous les cas — évite de révéler si un email est associé à un compte
  const genericResponse = () =>
    new Response(
      JSON.stringify({ message: "Si un compte existe pour cette adresse, un email de réinitialisation a été envoyé." }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )

  const jsonResponse = (body: unknown, status: number, extraHeaders: Record<string, string> = {}) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json', ...extraHeaders },
    })

  try {
    const { email, site_url } = await req.json()
    const siteUrl = normaliseSiteUrl(site_url)

    if (typeof email !== 'string' || !email.trim() || email.length > 320 || !siteUrl) {
      return jsonResponse({ error: 'Paramètres manquants : email, site_url requis' }, 400)
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false },
    })

    // Audit sécurité 2026-10-24 : limite par IP (429) et par adresse (envoi ignoré en
    // silence). Le compte n'est cherché qu'après, en tâche de fond : la réponse et son
    // délai ne dépendent pas de l'existence du compte.
    const emailNormalise = email.trim().toLowerCase()
    let ipHash: string
    let emailHash: string
    try {
      ipHash = await hashClientIp(req)
      emailHash = await hashValeur(`email:${emailNormalise}`)
    } catch {
      console.error('request-password-reset rate limiter is not configured')
      return jsonResponse({ error: 'Service temporairement indisponible' }, 503)
    }

    const { data: limite, error: limiteError } = await adminClient.rpc('verifier_limite_reset_mdp', {
      p_ip_hash: ipHash,
      p_email_hash: emailHash,
    })
    if (limiteError || !limite?.ok) {
      if (limite?.reason === 'RATE_LIMIT') {
        return jsonResponse(
          { error: 'Trop de demandes. Réessayez dans 15 minutes.', code: 'TROP_DE_REQUETES' },
          429,
          { 'Retry-After': '900' },
        )
      }
      console.error('request-password-reset rate limit failed:', limiteError?.code)
      return jsonResponse({ error: 'Service temporairement indisponible' }, 503)
    }

    if (limite.envoyer) {
      EdgeRuntime.waitUntil(envoyerLienReinitialisation(adminClient, emailNormalise, siteUrl))
    }

    return genericResponse()
  } catch (err) {
    console.error('request-password-reset error:', err)
    return genericResponse()
  }
})
