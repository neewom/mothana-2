import { describe, expect, it } from 'vitest'
import { ACTIVITE_DATES_ERROR, activiteDbErrorMessage, isActiviteDateRangeInvalid } from './activiteDates'

describe('isActiviteDateRangeInvalid', () => {
  it('refuse une fin strictement antérieure au début', () => {
    expect(isActiviteDateRangeInvalid('2026-12-21', '2026-09-27')).toBe(true)
    expect(isActiviteDateRangeInvalid('2026-12-21', '2026-12-20')).toBe(true)
  })

  it('accepte le même jour et une fin postérieure', () => {
    expect(isActiviteDateRangeInvalid('2026-12-21', '2026-12-21')).toBe(false)
    expect(isActiviteDateRangeInvalid('2026-12-21', '2026-12-27')).toBe(false)
    expect(isActiviteDateRangeInvalid('2026-12-31', '2027-01-01')).toBe(false)
  })

  it('ne contrôle pas une date absente', () => {
    expect(isActiviteDateRangeInvalid('', '2026-09-27')).toBe(false)
    expect(isActiviteDateRangeInvalid('2026-12-21', '')).toBe(false)
    expect(isActiviteDateRangeInvalid(null, '2026-09-27')).toBe(false)
    expect(isActiviteDateRangeInvalid('2026-12-21', undefined)).toBe(false)
  })
})

describe('activiteDbErrorMessage', () => {
  it('traduit le refus de la contrainte', () => {
    expect(
      activiteDbErrorMessage('new row for relation "activites" violates check constraint "activites_dates_check"')
    ).toBe(ACTIVITE_DATES_ERROR)
  })

  it('laisse les autres messages intacts', () => {
    expect(activiteDbErrorMessage('permission denied')).toBe('permission denied')
  })
})
