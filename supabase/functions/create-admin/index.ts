import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function inviteAdminEmailHtml(nom: string, organisationNom: string, actionLink: string): string {
  return `<!doctype html><html><body style="font-family: ui-sans-serif, system-ui, sans-serif; background: #f8fafc; padding: 32px;">
  <div style="max-width: 480px; margin: 0 auto; background: #ffffff; border-radius: 16px; padding: 32px; border: 1px solid #e2e8f0;">
    <h1 style="color: #0f172a; font-size: 20px; margin: 0 0 16px;">Bienvenue sur Samakan</h1>
    <p style="color: #475569; font-size: 14px; line-height: 1.5;">Bonjour ${nom},</p>
    <p style="color: #475569; font-size: 14px; line-height: 1.5;">Un compte administrateur vient d'être créé pour vous, pour l'organisation <strong>${organisationNom}</strong>. Cliquez sur le bouton ci-dessous pour définir votre mot de passe et accéder à votre espace.</p>
    <p style="margin: 24px 0;">
      <a href="${actionLink}" style="background: #4f46e5; color: #ffffff; padding: 10px 20px; border-radius: 8px; text-decoration: none; font-size: 14px; font-weight: 600;">Définir mon mot de passe</a>
    </p>
    <p style="color: #94a3b8; font-size: 12px;">Si vous n'êtes pas à l'origine de cette invitation, vous pouvez ignorer cet email.</p>
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
      from: 'Samakan <noreply@samakan.fr>',
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

  try {
    // Verify caller is super-admin by decoding the JWT payload
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
    const isSuperAdmin = payload?.app_metadata?.is_super_admin === true

    if (!isSuperAdmin) {
      return new Response(
        JSON.stringify({ error: 'Accès refusé — réservé aux super-admins' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    const { nom, email, organisation_id, site_url } = await req.json()

    if (!nom || !email || !organisation_id || !site_url) {
      return new Response(
        JSON.stringify({ error: 'Paramètres manquants : nom, email, organisation_id, site_url requis' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false },
    })

    const { data: orgData, error: orgError } = await adminClient
      .from('organisations')
      .select('nom')
      .eq('id', organisation_id)
      .single()

    if (orgError || !orgData) {
      return new Response(
        JSON.stringify({ error: 'Organisation introuvable' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    // Create the Auth account and get an invite action link in one call
    const { data: linkData, error: linkError } = await adminClient.auth.admin.generateLink({
      type: 'invite',
      email,
      options: { redirectTo: `${site_url}/mot-de-passe/nouveau` },
    })

    if (linkError || !linkData?.user) {
      console.error('generateLink error:', linkError?.message)
      return new Response(
        JSON.stringify({ error: linkError?.message ?? 'Erreur lors de la création du compte' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    const utilisateur_id = linkData.user.id
    const actionLink = linkData.properties.action_link

    // Insert the admin profile linked to the organisation
    const { data: profil, error: profilError } = await adminClient
      .from('profils_organisation')
      .insert({
        utilisateur_id,
        organisation_id,
        nom_affiche: nom,
        role: 'admin',
      })
      .select('id, utilisateur_id, nom_affiche, organisation_id')
      .single()

    if (profilError || !profil) {
      console.error('profils_organisation insert error:', profilError?.message)
      // Roll back the Auth account to keep data consistent
      await adminClient.auth.admin.deleteUser(utilisateur_id)
      return new Response(
        JSON.stringify({ error: profilError?.message ?? 'Erreur lors de la création du profil' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    const emailResult = await sendViaResend(email, 'Votre accès administrateur Samakan', inviteAdminEmailHtml(nom, orgData.nom, actionLink))

    if (!emailResult.ok) {
      console.error('Resend error:', emailResult.detail)
      // Non-bloquant : le compte est créé, seul l'email échoue
    }

    return new Response(
      JSON.stringify({
        id: profil.id,
        utilisateur_id: profil.utilisateur_id,
        nom_affiche: profil.nom_affiche,
        email,
        organisation_id: profil.organisation_id,
        email_envoye: emailResult.ok,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  } catch (err) {
    console.error('create-admin error:', err)
    return new Response(
      JSON.stringify({ error: 'Erreur serveur', detail: String(err) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  }
})
