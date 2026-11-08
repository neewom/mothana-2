import { describe, expect, it } from 'vitest'
import { isLogoEligibleUrl } from './organisationLogo'

describe('isLogoEligibleUrl', () => {
  it('accepte les images PNG et JPEG', () => {
    expect(isLogoEligibleUrl('https://x.supabase.co/storage/v1/object/public/organisation-assets/o/logo-1.png')).toBe(true)
    expect(isLogoEligibleUrl('https://x/o/logo.jpg')).toBe(true)
    expect(isLogoEligibleUrl('https://x/o/logo.JPEG')).toBe(true)
    expect(isLogoEligibleUrl('https://x/o/logo.png?v=2')).toBe(true)
  })

  it('refuse un PDF ou une URL sans extension image', () => {
    expect(isLogoEligibleUrl('https://x/o/statuts.pdf')).toBe(false)
    expect(isLogoEligibleUrl('https://x/o/png')).toBe(false)
    expect(isLogoEligibleUrl('https://x/o/logo.png.pdf')).toBe(false)
  })
})
