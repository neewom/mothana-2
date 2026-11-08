import { describe, expect, it } from 'vitest'
import { ADHERENT_SORT_DEFAUT, directionInitialeAdherent, paramsTriAdherents } from './adherentsTri'

describe('adherentsTri', () => {
  it('garde le tri historique par défaut (nom croissant)', () => {
    expect(paramsTriAdherents(ADHERENT_SORT_DEFAUT)).toEqual({ p_tri: 'nom', p_sens: 'asc' })
  })

  it('premier clic : dates décroissantes, textes croissants', () => {
    expect(directionInitialeAdherent('date_adhesion')).toBe('desc')
    expect(directionInitialeAdherent('date_fin')).toBe('desc')
    expect(directionInitialeAdherent('nom')).toBe('asc')
    expect(directionInitialeAdherent('code_postal')).toBe('asc')
  })

  it('transmet la clé et le sens à la RPC', () => {
    expect(paramsTriAdherents({ field: 'date_adhesion', direction: 'desc' })).toEqual({ p_tri: 'date_adhesion', p_sens: 'desc' })
  })
})
