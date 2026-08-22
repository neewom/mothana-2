import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = ''
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i])
  return btoa(binary)
}

function recuEmailHtml(donateurNom: string, organisationNom: string, annee: number): string {
  return `<!doctype html><html><body style="font-family: ui-sans-serif, system-ui, sans-serif; background: #f8fafc; padding: 32px;">
  <div style="max-width: 480px; margin: 0 auto; background: #ffffff; border-radius: 16px; padding: 32px; border: 1px solid #e2e8f0;">
    <h1 style="color: #0f172a; font-size: 20px; margin: 0 0 16px;">Votre reçu fiscal ${annee}</h1>
    <p style="color: #475569; font-size: 14px; line-height: 1.5;">Bonjour ${donateurNom},</p>
    <p style="color: #475569; font-size: 14px; line-height: 1.5;">Veuillez trouver ci-joint votre reçu fiscal ${annee} pour vos dons à ${organisationNom}, à conserver pour votre déclaration de revenus.</p>
    <p style="color: #94a3b8; font-size: 12px;">Cet email vous a été envoyé par ${organisationNom} via Samakan.</p>
  </div>
</body></html>`
}

async function sendViaResend(
  to: string,
  subject: string,
  html: string,
  attachment: { filename: string; content: string },
): Promise<{ ok: boolean; detail?: string }> {
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
      attachments: [attachment],
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
    const authHeader = req.headers.get('authorization')
    if (!authHeader) {
      return jsonResponse({ error: 'Non autorisé' }, 401)
    }

    const { profil_participant_id, annee } = await req.json()
    const anneeNum = Number(annee)
    if (!profil_participant_id || !annee || Number.isNaN(anneeNum)) {
      return jsonResponse({ error: 'Paramètres manquants' }, 400)
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!

    // Verify caller's identity
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false },
    })

    const { data: { user }, error: userError } = await userClient.auth.getUser()
    if (userError || !user) {
      return jsonResponse({ error: 'Non autorisé' }, 401)
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false },
    })

    // Caller must be admin for an organisation
    const { data: profilOrg } = await adminClient
      .from('profils_organisation')
      .select('organisation_id, role')
      .eq('utilisateur_id', user.id)
      .eq('role', 'admin')
      .single()

    if (!profilOrg) {
      return jsonResponse({ error: 'Accès refusé' }, 403)
    }

    const organisationId = profilOrg.organisation_id

    const { data: org } = await adminClient
      .from('organisations')
      .select('nom')
      .eq('id', organisationId)
      .single()

    if (!org) {
      return jsonResponse({ error: 'Organisation introuvable' }, 404)
    }

    const { data: participant } = await adminClient
      .from('profils_participant')
      .select('id, organisation_id, personnes(nom, prenom, email)')
      .eq('id', profil_participant_id)
      .eq('organisation_id', organisationId)
      .single()

    if (!participant) {
      return jsonResponse({ error: 'Participant introuvable' }, 404)
    }

    const personne = (participant as unknown as { personnes: { nom: string; prenom: string | null; email: string | null } }).personnes
    if (!personne.email) {
      return jsonResponse({ error: 'Aucune adresse email pour ce participant' }, 422)
    }

    const { data: recu } = await adminClient
      .from('recus_fiscaux')
      .select('fichier_url')
      .eq('profil_participant_id', profil_participant_id)
      .eq('organisation_id', organisationId)
      .eq('annee', anneeNum)
      .single()

    if (!recu || !recu.fichier_url) {
      return jsonResponse({ error: 'Aucun reçu généré pour ce participant et cette année' }, 404)
    }

    const { data: pdfFile, error: downloadError } = await adminClient.storage
      .from('recus-fiscaux')
      .download(recu.fichier_url)

    if (downloadError || !pdfFile) {
      console.error('Storage download error:', downloadError)
      return jsonResponse({ error: 'Erreur lors de la récupération du PDF' }, 500)
    }

    const pdfBytes = new Uint8Array(await pdfFile.arrayBuffer())
    const donateurNom = personne.prenom ? `${personne.prenom} ${personne.nom}` : personne.nom

    const emailResult = await sendViaResend(
      personne.email,
      `Votre reçu fiscal ${anneeNum} — ${org.nom}`,
      recuEmailHtml(donateurNom, org.nom, anneeNum),
      { filename: `recu-fiscal-${anneeNum}.pdf`, content: bytesToBase64(pdfBytes) },
    )

    if (!emailResult.ok) {
      console.error('Resend error:', emailResult.detail)
      return jsonResponse({ error: "Erreur lors de l'envoi de l'email" }, 500)
    }

    const { error: updateError } = await adminClient
      .from('recus_fiscaux')
      .update({ email_envoye_at: new Date().toISOString() })
      .eq('profil_participant_id', profil_participant_id)
      .eq('organisation_id', organisationId)
      .eq('annee', anneeNum)

    if (updateError) {
      console.error('Update email_envoye_at error:', updateError)
      // Non-blocking: email was sent, return success anyway
    }

    return jsonResponse({ ok: true })
  } catch (err) {
    console.error('send-recu-email error:', err)
    return jsonResponse({ error: 'Erreur inconnue' }, 500)
  }
})
