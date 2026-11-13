import { readdirSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { EDGE_FUNCTIONS } from './edgeFunctions'

describe('EDGE_FUNCTIONS (démo)', () => {
  it('liste toutes les Edge Functions du projet, sauf verify-pin réimplémentée', () => {
    const dir = path.resolve(__dirname, '../../supabase/functions')
    const onDisk = readdirSync(dir, { withFileTypes: true })
      .filter((d) => d.isDirectory() && !d.name.startsWith('_') && d.name !== 'verify-pin')
      .map((d) => d.name)
      .sort()
    expect([...EDGE_FUNCTIONS].sort()).toEqual(onDisk)
  })
})
