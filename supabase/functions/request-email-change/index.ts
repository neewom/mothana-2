import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { sendViaResend } from '../_shared/resend.ts'

// Self-service uniquement : tout compte connecté (admin ou contributeur)
// peut changer sa propre adresse email, pas de check de rôle. Ce projet
// n'utilise pas l'envoi automatique Supabase pour les emails d'auth (voir
// create-admin/request-password-reset) — même pattern ici : generateLink +
// Resend. On envoie un lien de confirmation à l'ancienne ET à la nouvelle
// adresse (email_change_current / email_change_new) pour fonctionner que le
// réglage "Secure email change" du projet Supabase soit activé ou non.

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function emailChangeHtml(title: string, body: string, actionLink: string): string {
  return `<!doctype html><html><body style="font-family: ui-sans-serif, system-ui, sans-serif; background: #f8fafc; padding: 32px;">
  <div style="max-width: 480px; margin: 0 auto; background: #ffffff; border-radius: 16px; padding: 32px; border: 1px solid #e2e8f0;">
    <h1 style="color: #0f172a; font-size: 20px; margin: 0 0 16px;">${title}</h1>
    <p style="color: #475569; font-size: 14px; line-height: 1.5;">${body}</p>
    <p style="margin: 24px 0;">
      <a href="${actionLink}" style="background: #4f46e5; color: #ffffff; padding: 10px 20px; border-radius: 8px; text-decoration: none; font-size: 14px; font-weight: 600;">Confirmer</a>
    </p>
    <p style="color: #94a3b8; font-size: 12px;">Si vous n'êtes pas à l'origine de cette demande, vous pouvez ignorer cet email.</p>
  </div>
</body></html>`
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const authHeader = req.headers.get('Authorization') ?? ''
    const token = authHeader.replace('Bearer ', '')

    if (!token) {
      return new Response(
        JSON.stringify({ error: 'Authorization header manquant' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    // Decode JWT payload (base64url) without verifying the signature
    const payload = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')))
    const currentEmail = payload?.email as string | undefined

    if (!currentEmail) {
      return new Response(
        JSON.stringify({ error: 'Session invalide' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    const { new_email, site_url } = await req.json()

    if (!new_email || !site_url) {
      return new Response(
        JSON.stringify({ error: 'Paramètres manquants : new_email, site_url requis' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    if (new_email === currentEmail) {
      return new Response(
        JSON.stringify({ error: 'Cette adresse est déjà la vôtre' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false },
    })

    const redirectTo = `${site_url}/admin/parametres/compte?email_change=confirme`

    const [currentLink, newLink] = await Promise.all([
      adminClient.auth.admin.generateLink({
        type: 'email_change_current',
        email: currentEmail,
        newEmail: new_email,
        options: { redirectTo },
      }),
      adminClient.auth.admin.generateLink({
        type: 'email_change_new',
        email: currentEmail,
        newEmail: new_email,
        options: { redirectTo },
      }),
    ])

    if (currentLink.error || newLink.error || !currentLink.data?.properties?.action_link || !newLink.data?.properties?.action_link) {
      console.error('generateLink (email_change) error:', currentLink.error?.message, newLink.error?.message)
      return new Response(
        JSON.stringify({ error: currentLink.error?.message ?? newLink.error?.message ?? 'Erreur lors de la demande de changement d\'email' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    const [currentEmailResult, newEmailResult] = await Promise.all([
      sendViaResend(
        currentEmail,
        'Confirmez le changement d\'adresse email de votre compte Samakan',
        emailChangeHtml(
          'Changement d\'adresse email',
          `Une demande de changement d'adresse email a été effectuée pour votre compte Samakan, vers <strong>${new_email}</strong>. Cliquez sur le bouton ci-dessous pour confirmer depuis votre adresse actuelle.`,
          currentLink.data.properties.action_link,
        ),
      ),
      sendViaResend(
        new_email,
        'Confirmez votre nouvelle adresse email Samakan',
        emailChangeHtml(
          'Confirmez votre nouvelle adresse',
          `Vous avez demandé à utiliser cette adresse pour votre compte Samakan. Cliquez sur le bouton ci-dessous pour la confirmer.`,
          newLink.data.properties.action_link,
        ),
      ),
    ])

    if (!currentEmailResult.ok || !newEmailResult.ok) {
      console.error('Resend error:', currentEmailResult.detail, newEmailResult.detail)
    }

    return new Response(
      JSON.stringify({ message: 'Vérifiez votre boîte mail (ancienne et nouvelle adresse) pour confirmer le changement.' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  } catch (err) {
    console.error('request-email-change error:', err)
    return new Response(
      JSON.stringify({ error: 'Erreur serveur', detail: String(err) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  }
})
