import { assertEquals } from 'jsr:@std/assert@1'
import { MESSAGE_ORGANISATION_AVEC_RECUS, refusSiRecusEmis } from './index.ts'

Deno.test('delete-org-admins : organisation avec reçus émis refusée (409) avant toute suppression', async () => {
  const res = await refusSiRecusEmis(() => Promise.resolve({ count: 3, error: null }))
  assertEquals(res?.status, 409)
  const body = await res!.json()
  assertEquals(body.error, MESSAGE_ORGANISATION_AVEC_RECUS)
  assertEquals(body.code, 'RECUS_EMIS')
})

Deno.test('delete-org-admins : organisation sans reçu, la suppression continue', async () => {
  assertEquals(await refusSiRecusEmis(() => Promise.resolve({ count: 0, error: null })), null)
})

Deno.test('delete-org-admins : comptage en erreur, refus par défaut (500)', async () => {
  const res = await refusSiRecusEmis(() => Promise.resolve({ count: null, error: { message: 'boom' } }))
  assertEquals(res?.status, 500)
  await res?.body?.cancel()
})
