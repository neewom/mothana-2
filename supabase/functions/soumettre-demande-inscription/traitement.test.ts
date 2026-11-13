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

const JETON = 'jeton-secret_123'
const EMPREINTE = 'b'.repeat(64)

function deps(resultat: ResultatRpc | null, options: { hashKo?: boolean; cgu?: boolean } = {}) {
  const appelsRpc: unknown[] = []
  const envois: { a: string; email: EmailInscription }[] = []
  const taches: Promise<unknown>[] = []
  const d: DependancesSoumission = {
    hashIp: () => (options.hashKo ? Promise.reject(new Error('RATE_LIMIT_KEY_MISSING')) : Promise.resolve(H)),
    hashEmail: () => Promise.resolve(H),
    jeton: () => Promise.resolve({ jeton: JETON, empreinte: EMPREINTE }),
    soumettre: (ip, email, jetonHash, demande) => {
      appelsRpc.push({ ip, email, jetonHash, demande })
      return Promise.resolve(resultat)
    },
    envoyer: (a, email) => {
      envois.push({ a, email })
      return Promise.resolve()
    },
    arrierePlan: (t) => { taches.push(t) },
    cguPubliees: options.cgu ?? false,
  }
  return { d, appelsRpc, envois, attendre: () => Promise.all(taches) }
}

const corps = (extra: Record<string, unknown> = {}) => JSON.stringify({ ...CORPS_VALIDE, ...extra })

Deno.test('nouvelle demande : réponse générique, email de confirmation seul (pas de notification), empreinte transmise', async () => {
  const { d, appelsRpc, envois, attendre } = deps({ ok: true, cas: 'nouvelle', envoyer_accuse: true, demande_id: 'x' })
  const r = await traiterSoumission(corps(), d)
  await attendre()
  vrai(r.status === 200 && JSON.stringify(r.body) === JSON.stringify(REPONSE_OK.body), 'réponse générique')
  const appel = appelsRpc[0] as { jetonHash: string; demande: Record<string, unknown> }
  vrai(appel.jetonHash === EMPREINTE, 'empreinte du jeton transmise, pas le jeton')
  vrai(!JSON.stringify(appel).includes(JETON), 'jeton absent de l’appel RPC')
  const demande = appel.demande
  vrai(demande.email === 'camille@exemple.fr' && demande.rna === 'W751234567' && demande.siren === null, 'normalisation')
  vrai(envois.length === 1, `un seul envoi (${envois.length})`)
  vrai(envois[0].a === 'camille@exemple.fr' && envois[0].email.sujet === 'Confirme ta demande d’espace Samakan', 'email de confirmation')
  vrai(envois[0].email.html.includes(`https://test.samakan.fr/inscription/confirmer?jeton=${JETON}`), 'lien de confirmation')
  vrai(envois[0].email.html.includes('Les Amis &lt;b&gt;du&lt;/b&gt; Quartier'), 'nom échappé')
})

Deno.test('demande encore à confirmer, soumise à nouveau : nouvel email de confirmation ; plafond atteint : rien', async () => {
  const renvoi = deps({ ok: true, cas: 'a_confirmer', envoyer_accuse: true, demande_id: 'x' })
  const r = await traiterSoumission(corps(), renvoi.d)
  await renvoi.attendre()
  vrai(r.status === 200 && JSON.stringify(r.body) === JSON.stringify(REPONSE_OK.body), 'réponse générique')
  vrai(renvoi.envois.length === 1 && renvoi.envois[0].email.html.includes(`/inscription/confirmer?jeton=${JETON}`), 'lien renvoyé')
  const plafond = deps({ ok: true, cas: 'a_confirmer', envoyer_accuse: false, demande_id: 'x' })
  vrai((await traiterSoumission(corps(), plafond.d)).status === 200, 'réponse générique (plafond)')
  await plafond.attendre()
  vrai(plafond.envois.length === 0, 'aucun envoi')
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

Deno.test('plafond d’emails atteint : même réponse, aucun email', async () => {
  for (const cas of ['en_attente', 'nouvelle', 'compte_existant'] as const) {
    const t = deps({ ok: true, cas, envoyer_accuse: false })
    vrai((await traiterSoumission(corps(), t.d)).status === 200, `réponse générique (${cas})`)
    await t.attendre()
    vrai(t.envois.length === 0, `aucun envoi (${cas})`)
  }
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

Deno.test('clé de limitation absente : 503 sans RPC', async () => {
  const ko = deps({ ok: true, cas: 'nouvelle', envoyer_accuse: true }, { hashKo: true })
  vrai((await traiterSoumission(corps(), ko.d)).status === 503 && ko.appelsRpc.length === 0, '503')
})

Deno.test('CGU publiées : cgu_acceptees exigé côté serveur, transmis quand coché', async () => {
  const sans = deps({ ok: true, cas: 'nouvelle', envoyer_accuse: true }, { cgu: true })
  const r = await traiterSoumission(corps(), sans.d)
  vrai(r.status === 400 && sans.appelsRpc.length === 0, 'refusé sans case cochée')
  const avec = deps({ ok: true, cas: 'nouvelle', envoyer_accuse: true }, { cgu: true })
  const ok = await traiterSoumission(corps({ cgu_acceptees: true }), avec.d)
  vrai(ok.status === 200, 'accepté case cochée')
  vrai((avec.appelsRpc[0] as { demande: { cgu_acceptees: boolean } }).demande.cgu_acceptees === true, 'acceptation transmise')
  const nonPubliees = deps({ ok: true, cas: 'nouvelle', envoyer_accuse: true })
  vrai((await traiterSoumission(corps(), nonPubliees.d)).status === 200, 'CGU non publiées : non exigées')
})
