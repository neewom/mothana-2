// deno test --no-lock supabase/functions/_shared/genererRecu.test.ts
import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { genererRecu } from './genererRecu.ts'

function egal(obtenu: unknown, attendu: unknown) {
  if (JSON.stringify(obtenu) !== JSON.stringify(attendu)) {
    throw new Error(`obtenu ${JSON.stringify(obtenu)}, attendu ${JSON.stringify(attendu)}`)
  }
}

// Client factice : chaque from(table) renvoie une requête chaînable dont le résultat est donné par
// `reponse(table, n)` (n = rang de l'appel sur cette table). Tout appel rpc / storage est consigné.
function clientFactice(reponse: (table: string, n: number) => { data: unknown; error: unknown }) {
  const appels: Record<string, number> = {}
  const effets: string[] = []
  const client = {
    from(table: string) {
      const n = appels[table] ?? 0
      appels[table] = n + 1
      const res = Promise.resolve(reponse(table, n))
      const requete: Record<string, unknown> = new Proxy({}, {
        get(_c, prop) {
          if (prop === 'then') return res.then.bind(res)
          if (prop === 'single' || prop === 'maybeSingle') return () => res
          return () => requete
        },
      })
      return requete
    },
    rpc(nom: string) {
      effets.push(`rpc:${nom}`)
      return Promise.resolve({ data: null, error: { message: 'inattendu' } })
    },
    storage: {
      from() {
        effets.push('storage')
        return { upload: () => Promise.resolve({ error: { message: 'inattendu' } }), remove: () => Promise.resolve({ error: null }) }
      },
    },
  }
  return { client: client as unknown as SupabaseClient, effets, appels }
}

const ORG = {
  nom: 'Asso',
  adresse: '1 rue',
  code_postal: '75001',
  ville: 'Paris',
  pays: null,
  modele_recu_pdf: { rna: 'W123', objet_social: 'Objet', mention_legale: 'Mention' },
}
const PARTICIPANT = {
  id: 'pp1',
  organisation_id: 'org1',
  id_externe: null,
  personnes: {
    nom: 'Dupont', prenom: 'Jean', email: null, civilite: 1, nom2: null, prenom2: null,
    adresse: '1 rue', code_postal: '75001', ville: 'Paris', pays: null,
  },
}
const RECU = { id: 'recu1', numero_ordre: '2025-0001', fichier_url: 'org1/2025/recu.pdf', type_cerfa: '11580' }

function reponses(recuControleTete: unknown, recuEtape5: unknown) {
  return (table: string, n: number) => {
    switch (table) {
      case 'recus_fiscaux':
        return { data: n === 0 ? recuControleTete : recuEtape5, error: null }
      case 'organisations':
        return { data: ORG, error: null }
      case 'profils_participant':
        return { data: PARTICIPANT, error: null }
      case 'dons':
        return { data: [{ montant: 10, date: '2025-03-01', mode_paiement: 1, don_regulier_id: null, activites: null }], error: null }
      case 'templates_recu':
        return { data: { id: 't1', html_template: '<p></p>', css: '' }, error: null }
      default:
        return { data: null, error: null }
    }
  }
}

const PARAMS = { organisationId: 'org1', profilParticipantId: 'pp1', annee: 2025, generePar: 'u1', gotenbergUrl: 'http://gotenberg' }

Deno.test('lot : reçu émis entre le contrôle de tête et l’étape 5 → renvoyé tel quel, aucune version', async () => {
  const { client, effets } = clientFactice(reponses(null, RECU))
  const r = await genererRecu(client, { ...PARAMS, seulementSiAbsent: true })
  egal(r.ok, true)
  egal(r.dejaExistant, true)
  egal(r.recuId, 'recu1')
  egal(r.body, { fichier_url: RECU.fichier_url, numero_ordre: RECU.numero_ordre, type_cerfa: RECU.type_cerfa })
  // Ni numéro attribué, ni lecture des versions, ni PDF, ni dépôt, ni enregistrement
  egal(effets, [])
})

Deno.test('lot : reçu déjà émis au contrôle de tête → renvoyé tel quel', async () => {
  const { client, effets } = clientFactice(reponses(RECU, RECU))
  const r = await genererRecu(client, { ...PARAMS, seulementSiAbsent: true })
  egal([r.ok, r.dejaExistant, r.recuId], [true, true, 'recu1'])
  egal(effets, [])
})

Deno.test('mode normal (generate-recu) : un reçu existant est régénéré (nouvelle version tentée)', async () => {
  const { client, appels } = clientFactice((table, n) =>
    table === 'recus_fiscaux_versions' ? { data: { version: 1 }, error: null } : reponses(RECU, RECU)(table, n),
  )
  // Gotenberg injoignable : la génération s'arrête à la conversion PDF (résultat 500, ou exception
  // quand les variables d'environnement ne sont pas lisibles sous deno test), après l'étape 5 bis.
  const fetchOrigine = globalThis.fetch
  globalThis.fetch = () => Promise.reject(new Error('gotenberg indisponible'))
  try {
    const r = await genererRecu(client, PARAMS).catch(() => null)
    // Pas de court-circuit « déjà existant » en mode normal : la dernière version a été lue pour en créer une nouvelle
    egal(r?.dejaExistant ?? false, false)
    egal(appels['recus_fiscaux_versions'], 1)
  } finally {
    globalThis.fetch = fetchOrigine
  }
})
