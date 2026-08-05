export function toUpperName(value: string): string {
  return value.toLocaleUpperCase('fr-FR')
}

export function toCapitalizedName(value: string): string {
  return value
    .toLocaleLowerCase('fr-FR')
    .replace(/(^|[\s'-])(\p{L})/gu, (_, sep: string, letter: string) => sep + letter.toLocaleUpperCase('fr-FR'))
}

// L'extension (TLD) doit être composée uniquement de lettres et faire au moins 2 caractères
// (ex: ".fr" valide, ".f" invalide) — pas de vérification contre la liste IANA complète, qui
// évolue en continu et serait disproportionnée à maintenir pour ce formulaire.
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[A-Za-z]{2,24}$/

export function isValidEmail(value: string): boolean {
  return EMAIL_REGEX.test(value)
}

export function sanitizeDigits(value: string): string {
  return value.replace(/\D/g, '')
}
