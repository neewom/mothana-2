// deno test --no-lock supabase/functions/verifier-expediteur-brevo/decision.test.ts
import { autoriserAppelant, configBrevoComplete, statutAffiche, type DecisionAutorisation } from './decision.ts'

function egal(obtenu: unknown, attendu: unknown) {
  if (JSON.stringify(obtenu) !== JSON.stringify(attendu)) {
    throw new Error(`attendu ${JSON.stringify(attendu)}, obtenu ${JSON.stringify(obtenu)}`)
  }
}

const ORG = '0b6d1a52-2f39-4c7e-9a51-0b8cbb2d8f10'
const refus401: DecisionAutorisation = { autorise: false, status: 401, error: 'Non autorisé' }
const refus403: DecisionAutorisation = { autorise: false, status: 403, error: 'Accès refusé' }
const accorde: DecisionAutorisation = { autorise: true, organisationId: ORG }
const admin = { app_metadata: { provider: 'email' } }

Deno.test('sans session valide : 401', () => {
  egal(autoriserAppelant(null, null, ORG, 'admin'), refus401)
  egal(autoriserAppelant(undefined, { message: 'invalid JWT' }, ORG, null), refus401)
  egal(autoriserAppelant({ app_metadata: { is_super_admin: true } }, { message: 'expired' }, ORG, null), refus401)
})

Deno.test('organisation demandée absente ou mal formée : 400', () => {
  for (const org of [undefined, null, '', 'abc', 42, `${ORG}' or 1=1`]) {
    const d = autoriserAppelant(admin, null, org, 'admin')
    egal(d.autorise === false && d.status, 400)
  }
})

Deno.test('admin et contributeur de l\'organisation demandée : autorisés', () => {
  egal(autoriserAppelant(admin, null, ORG, 'admin'), accorde)
  egal(autoriserAppelant(admin, null, ORG, 'contributeur'), accorde)
})

Deno.test('membre d\'une autre organisation (aucun profil pour celle demandée) : 403', () => {
  egal(autoriserAppelant(admin, null, ORG, null), refus403)
})

Deno.test('session bénévole ou vendeur : 403', () => {
  egal(autoriserAppelant({ app_metadata: {} }, null, ORG, null), refus403)
  egal(autoriserAppelant({}, null, ORG, 'benevole'), refus403)
  egal(autoriserAppelant({}, null, ORG, 'vendeur'), refus403)
})

Deno.test('flag super-admin non strictement true : 403', () => {
  for (const valeur of [false, null, undefined, 'true', 1]) {
    egal(autoriserAppelant({ app_metadata: { is_super_admin: valeur } }, null, ORG, null), refus403)
  }
})

Deno.test('super-admin (mode Consulter) : autorisé sans profil', () => {
  egal(autoriserAppelant({ app_metadata: { is_super_admin: true } }, null, ORG, null), accorde)
})

Deno.test('statut affiché selon la réponse Brevo', () => {
  egal(statutAffiche('actif'), 'valide')
  egal(statutAffiche('inactif'), 'en_attente')
  egal(statutAffiche('introuvable'), 'introuvable')
  egal(statutAffiche('impossible'), 'erreur')
})

Deno.test('configuration incomplète : non configuré (aucun appel Brevo)', () => {
  egal(configBrevoComplete(null, 'a@b.fr'), false)
  egal(configBrevoComplete('  ', 'a@b.fr'), false)
  egal(configBrevoComplete('k', null), false)
  egal(configBrevoComplete('k', ''), false)
  egal(configBrevoComplete('k', 'a@b.fr'), true)
})
