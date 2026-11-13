// deno test --no-lock supabase/functions/_shared/siteUrl.test.ts
import { origineRedirectionAuth } from './siteUrl.ts'

function egal(obtenu: unknown, attendu: unknown) {
  if (obtenu !== attendu) throw new Error(`attendu ${attendu}, obtenu ${obtenu}`)
}

Deno.test('origineRedirectionAuth : une IP littérale renvoie vers test.samakan.fr', () => {
  egal(origineRedirectionAuth('http://100.107.87.80:5175'), 'https://test.samakan.fr')
  egal(origineRedirectionAuth('http://127.0.0.1:5176'), 'https://test.samakan.fr')
  egal(origineRedirectionAuth('http://[::1]:5176'), 'https://test.samakan.fr')
})

Deno.test('origineRedirectionAuth : localhost et les domaines publics restent inchangés', () => {
  egal(origineRedirectionAuth('http://localhost:5176'), 'http://localhost:5176')
  egal(origineRedirectionAuth('https://samakan.fr'), 'https://samakan.fr')
  egal(origineRedirectionAuth('https://test.samakan.fr'), 'https://test.samakan.fr')
})
