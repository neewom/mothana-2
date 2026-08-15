import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function resetPasswordEmailHtml(actionLink: string): string {
  return `<!doctype html><html><body style="font-family: ui-sans-serif, system-ui, sans-serif; background: #f8fafc; padding: 32px;">
  <div style="max-width: 480px; margin: 0 auto; background: #ffffff; border-radius: 16px; padding: 32px; border: 1px solid #e2e8f0;">
    <h1 style="color: #0f172a; font-size: 20px; margin: 0 0 16px;">Réinitialisation de mot de passe</h1>
    <p style="color: #475569; font-size: 14px; line-height: 1.5;">Une demande de réinitialisation de mot de passe a été effectuée pour votre compte Mothana. Cliquez sur le bouton ci-dessous pour choisir un nouveau mot de passe.</p>
    <p style="margin: 24px 0;">
      <a href="${actionLink}" style="background: #4f46e5; color: #ffffff; padding: 10px 20px; border-radius: 8px; text-decoration: none; font-size: 14px; font-weight: 600;">Réinitialiser mon mot de passe</a>
    </p>
    <p style="color: #94a3b8; font-size: 12px;">Si vous n'êtes pas à l'origine de cette demande, vous pouvez ignorer cet email — votre mot de passe actuel reste inchangé.</p>
  </div>
</body></html>`
}

async function sendViaResend(to: string, subject: string, html: string): Promise<{ ok: boolean; detail?: string }> {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${Deno.env.get('RESEND_API_KEY')}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: 'Mothana <noreply@samakan.fr>',
      to: [to],
      subject,
      html,
    }),
  })
  if (!res.ok) {
    return { ok: false, detail: await res.text() }
  }
  return { ok: true }
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

  try {
    const { email, site_url } = await req.json()

    if (!email || !site_url) {
      return new Response(
        JSON.stringify({ error: 'Paramètres manquants : email, site_url requis' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false },
    })

    const { data: linkData, error: linkError } = await adminClient.auth.admin.generateLink({
      type: 'recovery',
      email,
      options: { redirectTo: `${site_url}/mot-de-passe/nouveau` },
    })

    if (linkError || !linkData?.properties?.action_link) {
      // Compte inexistant ou autre erreur : ne pas le révéler au client
      console.error('generateLink (recovery) error:', linkError?.message)
      return genericResponse()
    }

    const emailResult = await sendViaResend(email, 'Réinitialisation de votre mot de passe Mothana', resetPasswordEmailHtml(linkData.properties.action_link))

    if (!emailResult.ok) {
      console.error('Resend error:', emailResult.detail)
    }

    return genericResponse()
  } catch (err) {
    console.error('request-password-reset error:', err)
    return genericResponse()
  }
})
