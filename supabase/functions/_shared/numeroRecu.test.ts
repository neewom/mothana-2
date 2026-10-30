// deno test --no-lock supabase/functions/_shared/numeroRecu.test.ts
import { formatNumeroRecu, numeroRecuDonateur } from './numeroRecu.ts'

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
