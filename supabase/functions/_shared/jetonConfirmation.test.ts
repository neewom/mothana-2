// deno test --no-lock supabase/functions/_shared/jetonConfirmation.test.ts
import { empreinteJeton, jetonAleatoire, referenceEnvoi } from './jetonConfirmation.ts'

function vrai(condition: boolean, message: string) {
  if (!condition) throw new Error(message)
}

Deno.test('jeton : 32 octets en base64url (43 caractères sûrs dans une URL), jamais deux fois le même', () => {
  const jetons = new Set(Array.from({ length: 50 }, () => jetonAleatoire()))
  vrai(jetons.size === 50, 'jetons distincts')
  for (const j of jetons) vrai(/^[A-Za-z0-9_-]{43}$/.test(j), `format ${j}`)
})

Deno.test('référence d’envoi : 4 caractères sans ambiguïté, variée', () => {
  const refs = Array.from({ length: 200 }, () => referenceEnvoi())
  for (const r of refs) vrai(/^[ABCDEFGHJKMNPQRSTUVWXYZ2-9]{4}$/.test(r), `format ${r}`)
  vrai(new Set(refs).size > 190, 'références variées')
})

Deno.test('empreinte : SHA-256 en hexadécimal (format attendu par la base)', async () => {
  vrai(await empreinteJeton('abc') === 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad', 'vecteur SHA-256')
  vrai(/^[0-9a-f]{64}$/.test(await empreinteJeton(jetonAleatoire())), 'hex 64')
})
