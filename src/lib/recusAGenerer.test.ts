import { describe, expect, it } from 'vitest'
import { recusAGenerer } from './recusAGenerer'

const ok = { blocking: false, missing: [] }

describe('recusAGenerer', () => {
  it('ne garde que les reçus pas encore générés, dans l’ordre des lignes', () => {
    const rows = [
      { id: 'a', recu: null, validation: ok },
      { id: 'b', recu: { id: 'r1' }, validation: ok },
      { id: 'c', recu: null, validation: ok },
    ]
    expect(recusAGenerer(rows, false).map((r) => r.id)).toEqual(['a', 'c'])
  })

  it('écarte les fiches bloquées ou incomplètes', () => {
    const rows = [
      { id: 'a', recu: null, validation: { blocking: true, missing: [] } },
      { id: 'b', recu: null, validation: { blocking: false, missing: ['adresse'] } },
      { id: 'c', recu: null, validation: ok },
    ]
    expect(recusAGenerer(rows, false).map((r) => r.id)).toEqual(['c'])
  })

  it('ne génère rien si l’organisation est incomplète', () => {
    expect(recusAGenerer([{ recu: null, validation: ok }], true)).toEqual([])
  })

  it('renvoie une liste vide quand tous les reçus sont déjà générés', () => {
    expect(recusAGenerer([{ recu: { id: 'r1' }, validation: ok }], false)).toEqual([])
  })
})
