export function toUpperName(value: string): string {
  return value.toLocaleUpperCase('fr-FR')
}

export function toCapitalizedName(value: string): string {
  return value
    .toLocaleLowerCase('fr-FR')
    .replace(/(^|[\s'-])(\p{L})/gu, (_, sep: string, letter: string) => sep + letter.toLocaleUpperCase('fr-FR'))
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function isValidEmail(value: string): boolean {
  return EMAIL_REGEX.test(value)
}

export function sanitizePhoneInput(value: string): string {
  return value.replace(/[^\d\s+()-]/g, '')
}
