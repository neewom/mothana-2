import { assertEquals } from 'jsr:@std/assert@1'
import { reponseFormulaireRetire } from './index.ts'

Deno.test('soumettre-demande-adhesion : toute soumission reçoit un 410 explicite', async () => {
  const res = reponseFormulaireRetire(new Request('http://localhost/', { method: 'POST', body: '{"slug":"x"}' }))
  assertEquals(res.status, 410)
  const body = await res.json()
  assertEquals(body.error, 'FORMULAIRE_RETIRE')
  assertEquals(typeof body.message, 'string')
})

Deno.test('soumettre-demande-adhesion : GET refusé de même, preflight CORS accepté', async () => {
  assertEquals(reponseFormulaireRetire(new Request('http://localhost/')).status, 410)
  const preflight = reponseFormulaireRetire(new Request('http://localhost/', { method: 'OPTIONS' }))
  assertEquals(preflight.status, 200)
  await preflight.body?.cancel()
})
