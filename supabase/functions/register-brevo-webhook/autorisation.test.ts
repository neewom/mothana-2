// deno test --no-lock supabase/functions/register-brevo-webhook/autorisation.test.ts
import { autoriserToutesOrganisations, type DecisionAutorisation } from './autorisation.ts'

function egal(obtenu: DecisionAutorisation, attendu: DecisionAutorisation) {
  if (JSON.stringify(obtenu) !== JSON.stringify(attendu)) {
    throw new Error(`attendu ${JSON.stringify(attendu)}, obtenu ${JSON.stringify(obtenu)}`)
  }
}

const refus401: DecisionAutorisation = { autorise: false, status: 401, error: 'Non autorisé' }
const refus403: DecisionAutorisation = { autorise: false, status: 403, error: 'Accès refusé' }

Deno.test('sans session valide : 401', () => {
  egal(autoriserToutesOrganisations(null, null), refus401)
  egal(autoriserToutesOrganisations(undefined, { message: 'invalid JWT' }), refus401)
})

Deno.test('erreur getUser même avec un utilisateur : 401', () => {
  egal(autoriserToutesOrganisations({ app_metadata: { is_super_admin: true } }, { message: 'expired' }), refus401)
})

Deno.test('admin ou contributeur (sans flag super-admin) : 403', () => {
  egal(autoriserToutesOrganisations({ app_metadata: { provider: 'email', providers: ['email'] } }, null), refus403)
})

Deno.test('session bénévole (compte technique, sans app_metadata utile) : 403', () => {
  egal(autoriserToutesOrganisations({ app_metadata: {} }, null), refus403)
  egal(autoriserToutesOrganisations({}, null), refus403)
})

Deno.test('flag super-admin non strictement true : 403', () => {
  for (const valeur of [false, null, undefined, 'true', 1, 'yes']) {
    egal(autoriserToutesOrganisations({ app_metadata: { is_super_admin: valeur } }, null), refus403)
  }
})

Deno.test('super-admin : autorisé', () => {
  egal(autoriserToutesOrganisations({ app_metadata: { is_super_admin: true } }, null), { autorise: true })
})
