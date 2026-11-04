// deno test --no-lock supabase/functions/send-recu-email/envoi.test.ts
// Chemin Brevo testé avec un fetch simulé (aucun appel réseau) ; Resend remplacé par un double.
import { type ConfigBrevoOrganisation, type DependancesEnvoi, type EmailRecu, envoyerEmailRecu } from './envoi.ts'

function vrai(condition: boolean, message: string) {
  if (!condition) throw new Error(message)
}

const PROFIL = '0b6d1a52-2f39-4c7e-9a51-0b8cbb2d8f10'
const EMAIL: EmailRecu = {
  destinataire: { email: 'donateur@example.org', nom: 'Léa Martin' },
  objet: 'Votre reçu fiscal 2025 — Asso',
  html: '<p>Bonjour</p>',
  pieceJointe: { nom: 'recu-fiscal-2025.pdf', contenuBase64: 'JVBERi0=' },
  profilParticipantId: PROFIL,
}
const BREVO: ConfigBrevoOrganisation = { apiKey: 'cle', expediteurNom: 'Asso', expediteurEmail: 'contact@asso.fr' }

interface Appels {
  brevo: { url: string; body: Record<string, unknown> | null }[]
  resend: { to: string; subject: string; attachments: unknown }[]
}

function dependances(options: { senders?: { status: number; senders: unknown }; envoi?: number }): { deps: DependancesEnvoi; appels: Appels } {
  const appels: Appels = { brevo: [], resend: [] }
  const fetchFn = ((input: string | URL | Request, init?: RequestInit) => {
    const url = String(input)
    appels.brevo.push({ url, body: init?.body ? JSON.parse(String(init.body)) : null })
    if (url.endsWith('/v3/senders')) {
      const s = options.senders ?? { status: 200, senders: [{ email: 'contact@asso.fr', active: true }] }
      return Promise.resolve(new Response(JSON.stringify({ senders: s.senders }), { status: s.status }))
    }
    const status = options.envoi ?? 201
    return Promise.resolve(new Response(status < 300 ? JSON.stringify({ messageId: '<m@brevo>' }) : 'refus', { status }))
  }) as typeof fetch
  const envoyerResend: DependancesEnvoi['envoyerResend'] = (to, subject, _html, opts) => {
    appels.resend.push({ to, subject, attachments: opts.attachments })
    return Promise.resolve({ ok: true, id: 'r1' })
  }
  return { deps: { fetchFn, envoyerResend }, appels }
}

Deno.test('Brevo configuré et expéditeur validé : envoi Brevo avec PDF joint et tags du donateur', async () => {
  const { deps, appels } = dependances({})
  const res = await envoyerEmailRecu(EMAIL, BREVO, deps)
  vrai(res.ok && res.canal === 'brevo', JSON.stringify(res))
  vrai(appels.resend.length === 0, 'Resend appelé')
  const envoi = appels.brevo.find((a) => a.url.endsWith('/v3/smtp/email'))
  vrai(Boolean(envoi), 'pas d\'appel /v3/smtp/email')
  const body = envoi!.body as Record<string, unknown>
  vrai(JSON.stringify(body.sender) === JSON.stringify({ name: 'Asso', email: 'contact@asso.fr' }), 'expéditeur')
  vrai(JSON.stringify(body.to) === JSON.stringify([{ email: 'donateur@example.org', name: 'Léa Martin' }]), 'destinataire')
  vrai(JSON.stringify(body.attachment) === JSON.stringify([{ name: 'recu-fiscal-2025.pdf', content: 'JVBERi0=' }]), 'pièce jointe')
  vrai(JSON.stringify(body.tags) === JSON.stringify(['recu-fiscal', `profil:${PROFIL}`]), 'tags')
  vrai(body.subject === EMAIL.objet && body.htmlContent === EMAIL.html, 'contenu')
})

Deno.test('sans Brevo : Resend, sans appel Brevo', async () => {
  const { deps, appels } = dependances({})
  const res = await envoyerEmailRecu(EMAIL, { apiKey: null, expediteurNom: 'Asso', expediteurEmail: 'contact@asso.fr' }, deps)
  vrai(res.ok && res.canal === 'resend' && res.motifSecours === 'brevo_non_configure', JSON.stringify(res))
  vrai(appels.brevo.length === 0, 'Brevo appelé')
  vrai(appels.resend.length === 1 && JSON.stringify(appels.resend[0].attachments) === JSON.stringify([{ filename: 'recu-fiscal-2025.pdf', content: 'JVBERi0=' }]), 'pièce jointe Resend')
})

Deno.test('expéditeur non validé chez Brevo : Resend, aucun envoi Brevo', async () => {
  const { deps, appels } = dependances({ senders: { status: 200, senders: [{ email: 'autre@asso.fr', active: true }] } })
  const res = await envoyerEmailRecu(EMAIL, BREVO, deps)
  vrai(res.ok && res.canal === 'resend' && res.motifSecours === 'expediteur_non_valide', JSON.stringify(res))
  vrai(!appels.brevo.some((a) => a.url.endsWith('/v3/smtp/email')), 'envoi Brevo tenté')
})

Deno.test('vérification impossible : Brevo tenté quand même', async () => {
  const { deps } = dependances({ senders: { status: 403, senders: [] } })
  const res = await envoyerEmailRecu(EMAIL, BREVO, deps)
  vrai(res.ok && res.canal === 'brevo', JSON.stringify(res))
})

Deno.test('refus de Brevo à l\'envoi : secours Resend', async () => {
  const { deps, appels } = dependances({ envoi: 400 })
  const res = await envoyerEmailRecu(EMAIL, BREVO, deps)
  vrai(res.ok && res.canal === 'resend' && res.motifSecours === 'erreur_brevo', JSON.stringify(res))
  vrai(appels.resend.length === 1, 'Resend non appelé')
})

Deno.test('échec Resend : erreur remontée', async () => {
  const { deps } = dependances({})
  deps.envoyerResend = () => Promise.resolve({ ok: false, detail: 'quota' })
  const res = await envoyerEmailRecu(EMAIL, { apiKey: null, expediteurNom: null, expediteurEmail: null }, deps)
  vrai(!res.ok && res.detail === 'quota', JSON.stringify(res))
})
