// deno test --no-lock supabase/functions/_shared/envoiRecuEmail.test.ts
// Chemin Brevo testé avec un fetch simulé (aucun appel réseau) ; Resend remplacé par un double.
import { type ConfigBrevoOrganisation, type DependancesEnvoi, type EmailRecu, envoyerEmailRecu, MESSAGE_ENVOI_BREVO_INCERTAIN, MESSAGE_ENVOI_INCERTAIN } from './envoiRecuEmail.ts'

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

// envoi : statut HTTP de /v3/smtp/email, 'exception' (réseau) ou 'bloque' (aucune réponse : seul
// le signal de délai y met fin).
function dependances(options: { senders?: { status: number; senders: unknown }; envoi?: number | 'exception' | 'bloque' }): { deps: DependancesEnvoi; appels: Appels } {
  const appels: Appels = { brevo: [], resend: [] }
  const fetchFn = ((input: string | URL | Request, init?: RequestInit) => {
    const url = String(input)
    appels.brevo.push({ url, body: init?.body ? JSON.parse(String(init.body)) : null })
    if (url.endsWith('/v3/senders')) {
      const s = options.senders ?? { status: 200, senders: [{ email: 'contact@asso.fr', active: true }] }
      return Promise.resolve(new Response(JSON.stringify({ senders: s.senders }), { status: s.status }))
    }
    if (options.envoi === 'exception') return Promise.reject(new TypeError('error sending request: connection reset'))
    if (options.envoi === 'bloque') {
      return new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => reject(init.signal!.reason))
      })
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

const SANS_BREVO: ConfigBrevoOrganisation = { apiKey: null, expediteurNom: null, expediteurEmail: null }

Deno.test('refus Resend 4xx : erreur ordinaire (pas incertain)', async () => {
  const { deps } = dependances({})
  deps.envoyerResend = () => Promise.resolve({ ok: false, status: 422, detail: 'adresse refusée' })
  const res = await envoyerEmailRecu(EMAIL, SANS_BREVO, deps)
  vrai(!res.ok && !res.incertain && res.detail === 'adresse refusée', JSON.stringify(res))
})

Deno.test('Resend ≥ 500 : envoi incertain', async () => {
  const { deps } = dependances({})
  deps.envoyerResend = () => Promise.resolve({ ok: false, status: 503, detail: 'indisponible' })
  const res = await envoyerEmailRecu(EMAIL, SANS_BREVO, deps)
  vrai(!res.ok && res.incertain && res.detail === MESSAGE_ENVOI_INCERTAIN, JSON.stringify(res))
})

Deno.test('exception réseau Resend : envoi incertain', async () => {
  const { deps } = dependances({})
  deps.envoyerResend = () => Promise.reject(new TypeError('connection reset'))
  const res = await envoyerEmailRecu(EMAIL, SANS_BREVO, deps)
  vrai(!res.ok && res.incertain && res.detail === MESSAGE_ENVOI_INCERTAIN, JSON.stringify(res))
})

Deno.test('secours Resend après refus Brevo, puis Resend 500 : incertain', async () => {
  const { deps } = dependances({ envoi: 400 })
  deps.envoyerResend = () => Promise.resolve({ ok: false, status: 500, detail: 'erreur' })
  const res = await envoyerEmailRecu(EMAIL, BREVO, deps)
  vrai(!res.ok && res.incertain, JSON.stringify(res))
})

function envoiIncertain(res: Awaited<ReturnType<typeof envoyerEmailRecu>>, appels: Appels) {
  vrai(!res.ok && res.incertain && res.detail === MESSAGE_ENVOI_BREVO_INCERTAIN, JSON.stringify(res))
  vrai(appels.resend.length === 0, 'Resend appelé après un échec Brevo ambigu')
  vrai(appels.brevo.some((a) => a.url.endsWith('/v3/smtp/email')), 'envoi Brevo non tenté')
}

Deno.test('exception réseau à l\'envoi Brevo : incertain, pas de secours Resend', async () => {
  const { deps, appels } = dependances({ envoi: 'exception' })
  envoiIncertain(await envoyerEmailRecu(EMAIL, BREVO, deps), appels)
})

Deno.test('503 de Brevo à l\'envoi : incertain, pas de secours Resend', async () => {
  const { deps, appels } = dependances({ envoi: 503 })
  envoiIncertain(await envoyerEmailRecu(EMAIL, BREVO, deps), appels)
})

Deno.test('délai dépassé à l\'envoi Brevo : incertain, pas de secours Resend', async () => {
  const { deps, appels } = dependances({ envoi: 'bloque' })
  deps.delaiEnvoiBrevoMs = 20
  envoiIncertain(await envoyerEmailRecu(EMAIL, BREVO, deps), appels)
})
