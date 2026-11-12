// deno test --no-lock supabase/functions/valider-demande-inscription/invitation.test.ts
import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { inviterAdminDemande } from './invitation.ts'

function vrai(condition: boolean, message: string) {
  if (!condition) throw new Error(message)
}

/** Client factice : enregistre les écritures ; generateLink répond selon `lien`. */
function clientFactice(lien: { data: unknown; error: { message: string } | null }) {
  const majs: { table: string; valeurs: Record<string, unknown> }[] = []
  const suppressions: string[] = []
  const insertions: string[] = []
  const chaine = (resultat: unknown) => {
    const c: Record<string, unknown> = {}
    for (const m of ['select', 'eq']) c[m] = () => c
    c.single = () => Promise.resolve(resultat)
    c.then = (ok: (v: unknown) => unknown) => Promise.resolve(resultat).then(ok)
    return c
  }
  const client = {
    from(table: string) {
      return {
        select: () => chaine({ data: { nom: 'ZZ Test inscription' }, error: null }),
        update: (valeurs: Record<string, unknown>) => {
          majs.push({ table, valeurs })
          return chaine({ data: null, error: null })
        },
        insert: () => {
          insertions.push(table)
          return chaine({ data: null, error: null })
        },
        delete: () => {
          suppressions.push(table)
          return chaine({ data: null, error: null })
        },
      }
    },
    auth: {
      admin: {
        generateLink: () => Promise.resolve(lien),
        deleteUser: (id: string) => {
          suppressions.push(`auth:${id}`)
          return Promise.resolve({ error: null })
        },
      },
    },
  }
  return { client: client as unknown as SupabaseClient, majs, suppressions, insertions }
}

const DEMANDE = {
  id: 'd-1',
  prenom: 'Camille',
  nom: 'Martin',
  email: 'boulom.nicolas+samakan-inscription-existant@gmail.com',
  organisation_id: 'org-1',
  admin_utilisateur_id: null,
}

Deno.test('email déjà dans Auth à la validation : erreur enregistrée, organisation conservée, rien créé', async () => {
  const { client, majs, suppressions, insertions } = clientFactice({
    data: { user: null, properties: null },
    error: { message: 'A user with this email address has already been registered' },
  })
  const erreur = await inviterAdminDemande(client, DEMANDE, 'https://test.samakan.fr')
  vrai(erreur === 'A user with this email address has already been registered', `erreur renvoyée : ${erreur}`)
  const trace = majs.find((m) => m.table === 'demandes_inscription' && 'erreur_invitation' in m.valeurs)
  vrai(trace?.valeurs.erreur_invitation === erreur, 'erreur enregistrée sur la demande')
  vrai(!majs.some((m) => 'invitation_envoyee_le' in m.valeurs), 'invitation non marquée envoyée')
  vrai(!majs.some((m) => 'admin_utilisateur_id' in m.valeurs), 'aucun admin rattaché')
  vrai(suppressions.length === 0, 'aucune suppression (organisation ni compte)')
  vrai(insertions.length === 0, 'aucun profil créé')
})

Deno.test('relance (compte déjà créé pour la demande) : lien en échec → erreur enregistrée', async () => {
  const { client, majs } = clientFactice({ data: { properties: null }, error: { message: 'User not found' } })
  const erreur = await inviterAdminDemande(client, { ...DEMANDE, admin_utilisateur_id: 'u-1' }, 'https://test.samakan.fr')
  vrai(erreur === 'User not found', 'erreur de relance')
  vrai(majs.some((m) => m.valeurs.erreur_invitation === 'User not found'), 'erreur enregistrée')
})
