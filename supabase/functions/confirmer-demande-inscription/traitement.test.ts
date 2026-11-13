// deno test --no-lock supabase/functions/confirmer-demande-inscription/traitement.test.ts
import { traiterConfirmation, type DependancesConfirmation, type ResultatRpcConfirmation } from './traitement.ts'
import type { EmailInscription } from '../_shared/inscriptionEmails.ts'

function vrai(condition: boolean, message: string) {
  if (!condition) throw new Error(message)
}

const H = 'a'.repeat(64)
const JETON = 'Jeton_secret-0123456789abcdefghijklmnopqrstu'
const DEMANDE = {
  nom_association: 'Les Amis <b>du</b> Quartier',
  ville: 'Lyon',
  rna: null,
  siren: null,
  prenom: 'Camille',
  nom: 'Martin',
  email: 'camille@exemple.fr',
  message: null,
}

function deps(resultat: ResultatRpcConfirmation | null, options: { notif?: string | null; hashKo?: boolean } = {}) {
  const appels: { ip: string; jetonHash: string }[] = []
  const empreintes: string[] = []
  const envois: { a: string; email: EmailInscription }[] = []
  const taches: Promise<unknown>[] = []
  const d: DependancesConfirmation = {
    hashIp: () => (options.hashKo ? Promise.reject(new Error('RATE_LIMIT_KEY_MISSING')) : Promise.resolve(H)),
    empreinte: (jeton) => {
      empreintes.push(jeton)
      return Promise.resolve('e'.repeat(64))
    },
    confirmer: (ip, jetonHash) => {
      appels.push({ ip, jetonHash })
      return Promise.resolve(resultat)
    },
    envoyer: (a, email) => {
      envois.push({ a, email })
      return Promise.resolve()
    },
    emailNotification: options.notif === undefined ? 'notif@exemple.fr' : options.notif,
    arrierePlan: (t) => { taches.push(t) },
  }
  return { d, appels, empreintes, envois, attendre: () => Promise.all(taches) }
}

const corps = (extra: Record<string, unknown> = {}) => JSON.stringify({ jeton: JETON, site_url: 'https://test.samakan.fr', ...extra })

Deno.test('confirmée : cas renvoyé, empreinte transmise (jamais le jeton), notification du super-admin', async () => {
  const t = deps({ ok: true, cas: 'confirmee', demande: DEMANDE })
  const r = await traiterConfirmation(corps(), t.d)
  await t.attendre()
  vrai(r.status === 200 && r.body.cas === 'confirmee' && r.body.ok === true, 'confirmee')
  vrai(t.empreintes[0] === JETON && t.appels[0].jetonHash === 'e'.repeat(64) && t.appels[0].ip === H, 'empreinte')
  vrai(!JSON.stringify(t.appels).includes(JETON), 'jeton absent de la RPC')
  vrai(!JSON.stringify(r.body).includes('camille'), 'aucune donnée de la demande dans la réponse')
  vrai(t.envois.length === 1 && t.envois[0].a === 'notif@exemple.fr', 'notification')
  vrai(t.envois[0].email.sujet.startsWith('Nouvelle demande d’inscription'), 'sujet notification')
  vrai(t.envois[0].email.html.includes('&lt;b&gt;du&lt;/b&gt;') && t.envois[0].email.html.includes('https://test.samakan.fr/super-admin'), 'contenu notification')
})

Deno.test('déjà confirmée, expirée, invalide : cas renvoyé, aucune notification', async () => {
  for (const cas of ['deja_confirmee', 'expiree', 'invalide'] as const) {
    const t = deps({ ok: true, cas })
    const r = await traiterConfirmation(corps(), t.d)
    await t.attendre()
    vrai(r.status === 200 && r.body.cas === cas, `cas ${cas}`)
    vrai(t.envois.length === 0, `aucun envoi (${cas})`)
  }
})

Deno.test('notification non configurée : confirmée sans envoi', async () => {
  const t = deps({ ok: true, cas: 'confirmee', demande: DEMANDE }, { notif: null })
  const r = await traiterConfirmation(corps(), t.d)
  await t.attendre()
  vrai(r.status === 200 && r.body.cas === 'confirmee' && t.envois.length === 0, 'sans notification')
})

Deno.test('débit dépassé : 429 ; erreur RPC ou cas inconnu : 503', async () => {
  const limite = deps({ ok: false, reason: 'RATE_LIMIT' })
  const r = await traiterConfirmation(corps(), limite.d)
  vrai(r.status === 429 && r.headers?.['Retry-After'] === '3600', '429')
  vrai((await traiterConfirmation(corps(), deps(null).d)).status === 503, '503 erreur RPC')
  vrai((await traiterConfirmation(corps(), deps({ ok: false, reason: 'ACCES_INVALIDE' }).d)).status === 503, '503 refus')
  vrai((await traiterConfirmation(corps(), deps({ ok: true, cas: 'autre' as 'invalide' }).d)).status === 503, '503 cas inconnu')
  vrai((await traiterConfirmation(corps(), deps({ ok: true, cas: 'invalide' }, { hashKo: true }).d)).status === 503, '503 clé absente')
})

Deno.test('jeton absent ou trop long, site non autorisé, JSON cassé : 400 sans RPC', async () => {
  for (const raw of [
    corps({ jeton: '' }),
    corps({ jeton: 42 }),
    corps({ jeton: 'x'.repeat(201) }),
    corps({ site_url: 'https://evil.example' }),
    JSON.stringify({ jeton: JETON }),
    '{',
    '[]',
  ]) {
    const t = deps({ ok: true, cas: 'confirmee', demande: DEMANDE })
    const r = await traiterConfirmation(raw, t.d)
    vrai(r.status === 400 && t.appels.length === 0, `400 pour ${raw.slice(0, 40)}`)
  }
})
