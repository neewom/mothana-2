// deno test --no-lock supabase/functions/soumettre-demande-inscription/traitement.test.ts
import { REPONSE_OK, traiterSoumission, type DependancesSoumission, type ResultatRpc } from './traitement.ts'
import type { EmailInscription } from '../_shared/inscriptionEmails.ts'

function vrai(condition: boolean, message: string) {
  if (!condition) throw new Error(message)
}

const H = 'a'.repeat(64)

const CORPS_VALIDE = {
  nom_association: 'Les Amis <b>du</b> Quartier',
  ville: 'Lyon',
  rna: 'w 751 234 567',
  siren: '',
  prenom: 'Camille',
  nom: 'Martin',
  email: ' Camille@Exemple.FR ',
  message: '',
  site_url: 'https://test.samakan.fr',
  site_web: '',
}

function deps(resultat: ResultatRpc | null, options: { notif?: string | null; hashKo?: boolean } = {}) {
  const appelsRpc: unknown[] = []
  const envois: { a: string; email: EmailInscription }[] = []
  const taches: Promise<unknown>[] = []
  const d: DependancesSoumission = {
    hashIp: () => (options.hashKo ? Promise.reject(new Error('RATE_LIMIT_KEY_MISSING')) : Promise.resolve(H)),
    hashEmail: () => Promise.resolve(H),
    soumettre: (ip, email, demande) => {
      appelsRpc.push({ ip, email, demande })
      return Promise.resolve(resultat)
    },
    envoyer: (a, email) => {
      envois.push({ a, email })
      return Promise.resolve()
    },
    emailNotification: options.notif === undefined ? 'notif@exemple.fr' : options.notif,
    arrierePlan: (t) => { taches.push(t) },
  }
  return { d, appelsRpc, envois, attendre: () => Promise.all(taches) }
}

const corps = (extra: Record<string, unknown> = {}) => JSON.stringify({ ...CORPS_VALIDE, ...extra })

Deno.test('nouvelle demande : réponse générique, accusé + notification, champs normalisés', async () => {
  const { d, appelsRpc, envois, attendre } = deps({ ok: true, cas: 'nouvelle', envoyer_accuse: true, demande_id: 'x' })
  const r = await traiterSoumission(corps(), d)
  await attendre()
  vrai(r.status === 200 && JSON.stringify(r.body) === JSON.stringify(REPONSE_OK.body), 'réponse générique')
  const demande = (appelsRpc[0] as { demande: Record<string, unknown> }).demande
  vrai(demande.email === 'camille@exemple.fr' && demande.rna === 'W751234567' && demande.siren === null, 'normalisation')
  vrai(envois.length === 2, `deux envois (${envois.length})`)
  vrai(envois[0].a === 'camille@exemple.fr' && envois[0].email.sujet.includes('bien reçue'), 'accusé nouvelle demande')
  vrai(envois[1].a === 'notif@exemple.fr' && envois[1].email.html.includes('&lt;b&gt;du&lt;/b&gt;'), 'notification échappée')
  vrai(envois[1].email.html.includes('https://test.samakan.fr/super-admin'), 'lien super-admin')
})

Deno.test('compte existant : même réponse, email « déjà un espace », pas de notification', async () => {
  const { d, envois, attendre } = deps({ ok: true, cas: 'compte_existant', envoyer_accuse: true })
  const r = await traiterSoumission(corps(), d)
  await attendre()
  vrai(r.status === 200 && JSON.stringify(r.body) === JSON.stringify(REPONSE_OK.body), 'réponse générique')
  vrai(envois.length === 1 && envois[0].email.sujet === 'Tu as déjà un espace Samakan', 'email compte existant')
  vrai(envois[0].email.html.includes('https://test.samakan.fr/login?mot-de-passe-oublie'), 'lien mot de passe oublié')
})

Deno.test('demande déjà en attente : même réponse, rappel « en cours », pas de notification', async () => {
  const { d, envois, attendre } = deps({ ok: true, cas: 'en_attente', envoyer_accuse: true })
  const r = await traiterSoumission(corps(), d)
  await attendre()
  vrai(r.status === 200 && JSON.stringify(r.body) === JSON.stringify(REPONSE_OK.body), 'réponse générique')
  vrai(envois.length === 1 && envois[0].email.sujet.includes('en cours'), 'email en cours')
})

Deno.test('plafond d’accusés atteint : même réponse, aucun accusé (notification seule si nouvelle)', async () => {
  const enAttente = deps({ ok: true, cas: 'en_attente', envoyer_accuse: false })
  await traiterSoumission(corps(), enAttente.d)
  await enAttente.attendre()
  vrai(enAttente.envois.length === 0, 'aucun envoi')
  const nouvelle = deps({ ok: true, cas: 'nouvelle', envoyer_accuse: false })
  await traiterSoumission(corps(), nouvelle.d)
  await nouvelle.attendre()
  vrai(nouvelle.envois.length === 1 && nouvelle.envois[0].a === 'notif@exemple.fr', 'notification seule')
})

Deno.test('champ piège rempli : même réponse, ni RPC ni email', async () => {
  const { d, appelsRpc, envois } = deps({ ok: true, cas: 'nouvelle', envoyer_accuse: true })
  const r = await traiterSoumission(corps({ site_web: 'http://spam' }), d)
  vrai(r.status === 200 && JSON.stringify(r.body) === JSON.stringify(REPONSE_OK.body), 'réponse générique')
  vrai(appelsRpc.length === 0 && envois.length === 0, 'rien')
})

Deno.test('débit dépassé : 429 neutre, aucun email', async () => {
  const { d, envois } = deps({ ok: false, reason: 'RATE_LIMIT' })
  const r = await traiterSoumission(corps(), d)
  vrai(r.status === 429 && r.headers?.['Retry-After'] === '3600', '429')
  vrai(envois.length === 0, 'aucun envoi')
})

Deno.test('champs invalides, site non autorisé, JSON cassé : 400 sans RPC', async () => {
  for (const raw of [
    corps({ email: 'pas-un-email' }),
    corps({ rna: 'W12' }),
    corps({ siren: '12345678' }),
    corps({ nom_association: '' }),
    corps({ site_url: 'https://evil.example' }),
    '{',
    '[]',
  ]) {
    const { d, appelsRpc } = deps({ ok: true, cas: 'nouvelle', envoyer_accuse: true })
    const r = await traiterSoumission(raw, d)
    vrai(r.status === 400 && appelsRpc.length === 0, `400 pour ${raw.slice(0, 40)}`)
  }
})

Deno.test('clé de limitation absente : 503 ; notification non configurée : accusé seul', async () => {
  const ko = deps({ ok: true, cas: 'nouvelle', envoyer_accuse: true }, { hashKo: true })
  vrai((await traiterSoumission(corps(), ko.d)).status === 503, '503')
  const sansNotif = deps({ ok: true, cas: 'nouvelle', envoyer_accuse: true }, { notif: null })
  await traiterSoumission(corps(), sansNotif.d)
  await sansNotif.attendre()
  vrai(sansNotif.envois.length === 1, 'accusé seul')
})
