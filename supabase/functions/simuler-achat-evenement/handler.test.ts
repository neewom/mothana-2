// deno test --no-lock supabase/functions/simuler-achat-evenement/handler.test.ts
// Ordre des contrôles de simuler-achat-evenement : la limite de débit passe avant toute
// écriture (création/activation de commande), génération de PDF ou envoi d'email.
import { type RpcResult, type SimulationDeps, traiterDemande } from './handler.ts'

const EVENEMENT_ID = '00000000-0000-0000-0000-000000000001'
const COMMANDE_ID = '00000000-0000-0000-0000-000000000002'

interface Journal {
  rpc: string[]
  pdf: number
  emails: string[]
  hashEmail: string[]
}

function egal<T>(obtenu: T, attendu: T, contexte: string) {
  if (JSON.stringify(obtenu) !== JSON.stringify(attendu)) {
    throw new Error(`${contexte} : attendu ${JSON.stringify(attendu)}, obtenu ${JSON.stringify(obtenu)}`)
  }
}

function requete(overrides: Record<string, unknown> = {}): Request {
  return new Request('http://localhost/functions/v1/simuler-achat-evenement', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      evenement_id: EVENEMENT_ID,
      email: '  Acheteur@Example.FR ',
      montant_centimes: 1000,
      cle_idempotence: '00000000-0000-0000-0000-000000000003',
      site_url: 'https://test.samakan.fr',
      ...overrides,
    }),
  })
}

function deps(limite: RpcResult, journal: Journal, overrides: Partial<SimulationDeps> = {}): SimulationDeps {
  return {
    simulationActive: () => true,
    hashIp: () => Promise.resolve('a'.repeat(64)),
    hashEmail: (email) => {
      journal.hashEmail.push(email)
      return Promise.resolve('e'.repeat(64))
    },
    rpc: (fn) => {
      journal.rpc.push(fn)
      switch (fn) {
        case 'verifier_limite_simulation_achat':
          return Promise.resolve(limite)
        case 'creer_commande_en_attente':
          return Promise.resolve({ data: { id: COMMANDE_ID }, error: null })
        case 'activer_commande':
          return Promise.resolve({
            data: { ok: true, raison: null, portefeuille_id: 'p1', code_public: 'ABC123', secret: 'secret' },
            error: null,
          })
        case 'lire_portefeuille_par_secret_hash':
          return Promise.resolve({
            data: {
              ok: true,
              revision: 1,
              portefeuille: { codePublic: 'ABC123' },
              evenement: { nom: 'Fête', organisationNom: 'Association Démo' },
              mouvements: [],
            },
            error: null,
          })
        default:
          throw new Error(`RPC inattendue : ${fn}`)
      }
    },
    genererPdf: () => {
      journal.pdf++
      return Promise.resolve(new Uint8Array([1, 2, 3]).buffer)
    },
    envoyerEmail: (to) => {
      journal.emails.push(to)
      return Promise.resolve({ ok: true, id: 'email-1' })
    },
    ...overrides,
  }
}

function journalVide(): Journal {
  return { rpc: [], pdf: 0, emails: [], hashEmail: [] }
}

Deno.test('limite dépassée : 429, ni commande, ni PDF, ni email', async () => {
  const journal = journalVide()
  const res = await traiterDemande(requete(), deps({ data: { ok: false, reason: 'RATE_LIMIT' }, error: null }, journal))
  egal(res.status, 429, 'statut')
  egal(await res.json(), { error: 'TROP_DE_REQUETES' }, 'corps')
  egal(res.headers.get('Retry-After'), '3600', 'Retry-After')
  egal(journal.rpc, ['verifier_limite_simulation_achat'], 'RPC appelées')
  egal(journal.pdf, 0, 'PDF générés')
  egal(journal.emails, [], 'emails envoyés')
})

Deno.test('erreur de la RPC de limite : refus, ni commande, ni PDF, ni email', async () => {
  const journal = journalVide()
  const res = await traiterDemande(requete(), deps({ data: null, error: { code: 'PGRST202', message: 'not found' } }, journal))
  egal(res.status, 503, 'statut')
  egal(await res.json(), { error: 'SERVICE_INDISPONIBLE' }, 'corps')
  egal(journal.rpc, ['verifier_limite_simulation_achat'], 'RPC appelées')
  egal(journal.pdf, 0, 'PDF générés')
  egal(journal.emails, [], 'emails envoyés')
})

Deno.test('réponse inattendue de la RPC de limite (empreinte invalide) : refus sans envoi', async () => {
  const journal = journalVide()
  const res = await traiterDemande(requete(), deps({ data: { ok: false, reason: 'ACCES_INVALIDE' }, error: null }, journal))
  egal(res.status, 503, 'statut')
  egal(journal.rpc, ['verifier_limite_simulation_achat'], 'RPC appelées')
  egal(journal.emails, [], 'emails envoyés')
})

Deno.test('clé de hachage absente : refus sans appel à la base', async () => {
  const journal = journalVide()
  const res = await traiterDemande(requete(), deps({ data: { ok: true }, error: null }, journal, {
    hashIp: () => Promise.reject(new Error('RATE_LIMIT_KEY_MISSING')),
  }))
  egal(res.status, 503, 'statut')
  egal(journal.rpc, [], 'RPC appelées')
  egal(journal.emails, [], 'emails envoyés')
})

Deno.test('kill-switch coupé : 503 avant toute autre opération, limite comprise', async () => {
  const journal = journalVide()
  const res = await traiterDemande(requete(), deps({ data: { ok: true }, error: null }, journal, {
    simulationActive: () => false,
  }))
  egal(res.status, 503, 'statut')
  egal(await res.json(), { error: 'SIMULATION_DESACTIVEE' }, 'corps')
  egal(journal.rpc, [], 'RPC appelées')
})

Deno.test('corps invalide : 400 sans consommer la limite', async () => {
  const journal = journalVide()
  const res = await traiterDemande(requete({ email: 'pas-un-email' }), deps({ data: { ok: true }, error: null }, journal))
  egal(res.status, 400, 'statut')
  egal(journal.rpc, [], 'RPC appelées')
})

Deno.test('sous la limite : parcours inchangé, limite vérifiée en premier, adresse normalisée', async () => {
  const journal = journalVide()
  const res = await traiterDemande(requete(), deps({ data: { ok: true }, error: null }, journal))
  egal(res.status, 200, 'statut')
  const corps = await res.json()
  egal(corps.email_envoye, true, 'email_envoye')
  egal(corps.code_public, 'ABC123', 'code_public')
  egal(journal.rpc, [
    'verifier_limite_simulation_achat',
    'creer_commande_en_attente',
    'activer_commande',
    'lire_portefeuille_par_secret_hash',
  ], 'ordre des RPC')
  egal(journal.hashEmail, ['acheteur@example.fr'], 'adresse hachée')
  egal(journal.pdf, 1, 'PDF générés')
  egal(journal.emails, ['acheteur@example.fr'], 'emails envoyés')
})
