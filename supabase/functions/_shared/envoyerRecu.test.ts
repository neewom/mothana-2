// deno test --no-lock supabase/functions/_shared/envoyerRecu.test.ts
import { adresseNonDelivrable, formatEmailValide } from './envoyerRecu.ts'

function vrai(condition: boolean, message: string) {
  if (!condition) throw new Error(message)
}

Deno.test('adresses .invalid : jamais délivrables', () => {
  vrai(adresseNonDelivrable('test.lot.1@example.invalid'), 'example.invalid')
  vrai(adresseNonDelivrable(' A@B.INVALID '), 'casse et espaces')
  vrai(!adresseNonDelivrable('a@invalid.fr'), 'invalid.fr est un vrai domaine')
  vrai(!adresseNonDelivrable('a@example.org'), 'example.org')
})

Deno.test('format email', () => {
  vrai(formatEmailValide('a@b.fr'), 'simple')
  vrai(!formatEmailValide('a@b'), 'sans point')
  vrai(!formatEmailValide('a b@c.fr'), 'espace')
  vrai(!formatEmailValide('ab.fr'), 'sans @')
})
