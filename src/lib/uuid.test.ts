import { describe, expect, it } from 'vitest'
import { generateUUID } from './uuid'

describe('generateUUID', () => {
  it('génère un UUID v4 sans dépendre de crypto.randomUUID', () => {
    const uuid = generateUUID()

    expect(uuid).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    )
  })
})
