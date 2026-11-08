// deno test --no-lock supabase/functions/traiter-lots-recus/resultat.test.ts
import { classerEnvoiLot, classerResultatLot } from './resultat.ts'

function egal(obtenu: unknown, attendu: unknown) {
  if (JSON.stringify(obtenu) !== JSON.stringify(attendu)) {
    throw new Error(`attendu ${JSON.stringify(attendu)}, obtenu ${JSON.stringify(obtenu)}`)
  }
}

const base = { recuId: null, dejaExistant: false }

Deno.test('succès : ligne faite, reçu préexistant signalé', () => {
  egal(classerResultatLot({ ...base, ok: true, status: 200, body: {}, recuId: 'r1' }),
    { resultat: 'fait', erreur: null, recuId: 'r1', recuPreexistant: false })
  egal(classerResultatLot({ ok: true, status: 200, body: {}, recuId: 'r2', dejaExistant: true }),
    { resultat: 'fait', erreur: null, recuId: 'r2', recuPreexistant: true })
})

Deno.test('erreur serveur, conflit ou exception : nouvelle tentative', () => {
  egal(classerResultatLot({ ...base, ok: false, status: 500, body: { error: 'Erreur lors de la génération du PDF' } }).resultat, 'reessayer')
  egal(classerResultatLot({ ...base, ok: false, status: 409, body: { error: 'pris' } }).resultat, 'reessayer')
  const r = classerResultatLot(null, new Error('réseau'))
  egal(r.resultat, 'reessayer')
  egal(r.erreur, 'Erreur serveur : Error: réseau')
})

Deno.test('refus définitif : échec avec la raison', () => {
  egal(classerResultatLot({ ...base, ok: false, status: 422, body: { error: 'Champs manquants pour le donateur : adresse' } }),
    { resultat: 'echec', erreur: 'Champs manquants pour le donateur : adresse', recuId: null, recuPreexistant: false })
  egal(classerResultatLot({ ...base, ok: false, status: 404, body: { error: 'Aucun don pour cette année' } }).resultat, 'echec')
  egal(classerResultatLot({ ...base, ok: false, status: 404, body: {} }).erreur, 'Erreur 404')
})

// Lots d'envoi (carte « Reçus en lot 4/5 »)
const envoye = {
  ok: true as const, canal: 'brevo' as const, motifSecours: null, recuId: 'r1', versionId: 'v1',
  envoyeLe: '2026-11-04T10:00:00.000Z', dejaEnvoye: false, email: 'a@example.org',
}

Deno.test('envoi réussi ou déjà envoyé : ligne faite avec la version et le canal', () => {
  egal(classerEnvoiLot(envoye), {
    resultat: 'fait', erreur: null, recuId: 'r1', versionId: 'v1', envoyeLe: '2026-11-04T10:00:00.000Z', canal: 'brevo', dejaEnvoye: false,
  })
  const deja = classerEnvoiLot({ ...envoye, canal: null, dejaEnvoye: true })
  egal([deja.resultat, deja.dejaEnvoye, deja.canal], ['fait', true, null])
})

Deno.test('envoi Brevo ambigu ou exception pendant l\'envoi : à vérifier, jamais de nouvelle tentative', () => {
  egal(classerEnvoiLot({ ok: false, status: 502, error: 'Envoi Brevo incertain', incertain: true }).resultat, 'a_verifier')
  // Resend ≥ 500 ou exception réseau Resend (envoiRecuEmail.ts) : même classement.
  egal(classerEnvoiLot({ ok: false, status: 502, error: 'Envoi incertain : vérifiez avant de renvoyer', incertain: true }).resultat, 'a_verifier')
  const r = classerEnvoiLot(null, new Error('délai'))
  egal(r.resultat, 'a_verifier')
  egal(r.erreur?.includes('Error: délai'), true)
})

Deno.test('erreur serveur avant envoi ou refus Resend : nouvelle tentative ; refus définitif : échec', () => {
  egal(classerEnvoiLot({ ok: false, status: 500, error: 'Erreur lors de la récupération du PDF', incertain: false }).resultat, 'reessayer')
  egal(classerEnvoiLot({ ok: false, status: 422, error: 'Aucune adresse email pour ce participant', incertain: false }),
    { recuId: null, versionId: null, envoyeLe: null, canal: null, dejaEnvoye: false, resultat: 'echec', erreur: 'Aucune adresse email pour ce participant' })
  egal(classerEnvoiLot({ ok: false, status: 404, error: 'Aucun reçu', incertain: false }).resultat, 'echec')
})

Deno.test('envoi en lot sans Brevo (sans secours Resend) : échec définitif ; refus Brevo 4xx : nouvelle tentative', () => {
  egal(classerEnvoiLot({ ok: false, status: 422, error: "Brevo n'est pas configuré", incertain: false }).resultat, 'echec')
  egal(classerEnvoiLot({ ok: false, status: 500, error: 'Envoi refusé par Brevo (400) : x', incertain: false }).resultat, 'reessayer')
})
