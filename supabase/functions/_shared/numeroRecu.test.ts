// deno test --no-lock supabase/functions/_shared/numeroRecu.test.ts
import { estConflitStorage, formatNumeroRecu, messageNumeroDejaPris, numeroDonateurAffiche, numeroRecuDonateur } from './numeroRecu.ts'

function egal(obtenu: unknown, attendu: unknown) {
  if (obtenu !== attendu) throw new Error(`attendu ${JSON.stringify(attendu)}, obtenu ${JSON.stringify(obtenu)}`)
}

Deno.test('format absent ou inconnu : séquence annuelle', () => {
  egal(formatNumeroRecu(undefined), 'sequence')
  egal(formatNumeroRecu(null), 'sequence')
  egal(formatNumeroRecu('sequence'), 'sequence')
  egal(formatNumeroRecu('autre'), 'sequence')
  egal(formatNumeroRecu('donateur'), 'donateur')
})

Deno.test('année + numéro de donateur, tel quel', () => {
  egal(numeroRecuDonateur(2026, '2803'), '2026-2803')
  egal(numeroRecuDonateur(2026, '007'), '2026-007')
  egal(numeroRecuDonateur(2025, ' 446 '), '2025-446')
})

Deno.test('donateur sans numéro exploitable : null', () => {
  egal(numeroRecuDonateur(2026, null), null)
  egal(numeroRecuDonateur(2026, undefined), null)
  egal(numeroRecuDonateur(2026, ''), null)
  egal(numeroRecuDonateur(2026, '   '), null)
  egal(numeroRecuDonateur(2026, '12/34'), null)
  egal(numeroRecuDonateur(2026, '../x'), null)
})

Deno.test('numéro de donateur affiché sur le reçu : même valeur nettoyée', () => {
  egal(numeroDonateurAffiche(' 446 '), '446')
  egal(numeroDonateurAffiche('2803'), '2803')
  egal(numeroDonateurAffiche(null), '')
  egal(numeroDonateurAffiche(undefined), '')
})

Deno.test('message 409 selon le format', () => {
  const seq = messageNumeroDejaPris('sequence', '2026-004')
  if (!seq.includes('2026-004') || !seq.includes('numéro suivant')) throw new Error(seq)
  const don = messageNumeroDejaPris('donateur', '2026-4')
  if (!don.includes('2026-4') || !don.includes('support') || don.includes('numéro suivant')) throw new Error(don)
})

Deno.test('conflit Storage : objet déjà existant', () => {
  egal(estConflitStorage({ message: 'The resource already exists', statusCode: '409' }), true)
  egal(estConflitStorage({ status: 409, message: 'Duplicate' }), true)
  egal(estConflitStorage({ status: 400, statusCode: '400', message: 'The resource already exists' }), true)
  egal(estConflitStorage({ status: 500, message: 'Internal error' }), false)
  egal(estConflitStorage(null), false)
})
