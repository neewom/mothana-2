// deno test --no-lock supabase/functions/traiter-lots-recus/resultat.test.ts
import { classerResultatLot } from './resultat.ts'

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
