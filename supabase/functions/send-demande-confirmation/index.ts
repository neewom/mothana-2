import { sendViaResend } from '../_shared/resend.ts'

// Déclenchée par un trigger DB (net.http_post, cf. migration
// demande_adhesion_confirmation_webhook.sql) juste après l'insertion d'une
// demande d'adhésion (formulaire public) — pas d'appel client direct.
// Volet 1 de la détection de bounces (carte Trello "Détection d'emails
// adhérents invalides") : un email de confirmation de réception, utile en
// soi ("votre demande a bien été reçue"), sert aussi de test d'adresse —
// son bounce éventuel est capté par resend-bounce-webhook via le tag
// demande_id posé ici.

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface DemandeRecord {
  id: string
  nom: string
  prenom: string | null
  courriel: string | null
}

function confirmationEmailHtml(nom: string): string {
  return `<!doctype html><html><body style="font-family: ui-sans-serif, system-ui, sans-serif; background: #f8fafc; padding: 32px;">
  <div style="max-width: 480px; margin: 0 auto; background: #ffffff; border-radius: 16px; padding: 32px; border: 1px solid #e2e8f0;">
    <h1 style="color: #0f172a; font-size: 20px; margin: 0 0 16px;">Demande d'adhésion bien reçue</h1>
    <p style="color: #475569; font-size: 14px; line-height: 1.5;">Bonjour ${nom},</p>
    <p style="color: #475569; font-size: 14px; line-height: 1.5;">Votre demande d'adhésion a bien été reçue. Elle sera examinée prochainement par le conseil d'administration, qui reviendra vers vous.</p>
    <p style="color: #94a3b8; font-size: 12px;">Vous recevez cet email car cette adresse a été renseignée dans un formulaire d'adhésion.</p>
  </div>
</body></html>`
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { record } = (await req.json()) as { record?: DemandeRecord }

    if (!record?.courriel) {
      return new Response(JSON.stringify({ skipped: true, reason: 'Pas de courriel sur la demande' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const emailResult = await sendViaResend(
      record.courriel,
      'Votre demande d\'adhésion a bien été reçue',
      confirmationEmailHtml(record.prenom ? `${record.prenom} ${record.nom}` : record.nom),
      { tags: [{ name: 'demande_id', value: record.id }] },
    )

    if (!emailResult.ok) {
      console.error('Resend error:', emailResult.detail)
    }

    return new Response(JSON.stringify({ email_envoye: emailResult.ok }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    console.error('send-demande-confirmation error:', err)
    return new Response(JSON.stringify({ error: 'Erreur serveur', detail: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
