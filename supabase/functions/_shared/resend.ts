// Helper Resend partagé — cadré 2026-09-06 pendant la détection de bounces
// (carte Trello "Détection d'emails adhérents invalides"), pour ne pas
// dupliquer une 3e fois le sendViaResend() déjà copié-collé dans create-admin
// et request-password-reset.

export interface SendResult {
  ok: boolean
  detail?: string
  id?: string
}

export async function sendViaResend(
  to: string,
  subject: string,
  html: string,
  options?: { tags?: { name: string; value: string }[] },
): Promise<SendResult> {
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
      ...(options?.tags ? { tags: options.tags } : {}),
    }),
  })

  if (!res.ok) {
    return { ok: false, detail: await res.text() }
  }

  const data = await res.json().catch(() => ({} as { id?: string }))
  return { ok: true, id: data?.id }
}
