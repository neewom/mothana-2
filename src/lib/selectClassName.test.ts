import { describe, expect, it } from 'vitest'
import { splitSelectClassName } from './selectClassName'

describe('splitSelectClassName', () => {
  it('envoie largeur et marges au wrapper, le reste au select', () => {
    expect(splitSelectClassName('mt-1 w-full py-1 text-xs')).toEqual({ wrapper: 'mt-1 w-full', select: 'py-1 text-xs' })
  })

  it('gère les préfixes responsives et les valeurs arbitraires', () => {
    expect(splitSelectClassName('w-full sm:w-48 md:max-w-xs min-w-[8rem] pl-2 pr-7')).toEqual({
      wrapper: 'w-full sm:w-48 md:max-w-xs min-w-[8rem]',
      select: 'pl-2 pr-7',
    })
  })

  it('ne confond pas une marge avec un padding ni une classe de texte', () => {
    expect(splitSelectClassName('-mt-px px-3 text-ink flex-1 font-medium')).toEqual({
      wrapper: '-mt-px flex-1',
      select: 'px-3 text-ink font-medium',
    })
  })

  it('accepte une valeur absente', () => {
    expect(splitSelectClassName(undefined)).toEqual({ wrapper: '', select: '' })
  })
})
