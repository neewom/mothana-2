// Domaines proposés pendant la saisie d'une adresse email (carte « Suggestions de domaine »).
// Ordre = fréquence approximative chez les donateurs français : FR d'abord, puis les variantes
// internationales des mêmes fournisseurs. Simple aide à la saisie : tout autre domaine reste
// accepté, rien n'est jamais corrigé automatiquement.
export const EMAIL_DOMAINS = [
  'gmail.com',
  'hotmail.fr',
  'orange.fr',
  'free.fr',
  'yahoo.fr',
  'laposte.net',
  'outlook.fr',
  'icloud.com',
  'sfr.fr',
  'wanadoo.fr',
  'hotmail.com',
  'outlook.com',
  'live.fr',
  'yahoo.com',
] as const

/**
 * Adresses complètes à suggérer pour la saisie `value` : rien avant le premier `@` (ou sans
 * partie locale), puis les domaines qui commencent par ce qui est tapé après le `@`.
 * Liste vide dès que le domaine tapé correspond exactement à un domaine connu, ou que la
 * saisie ne peut plus en devenir un (second `@`, espace).
 */
export function getEmailDomainSuggestions(value: string, domains: readonly string[] = EMAIL_DOMAINS): string[] {
  const at = value.indexOf('@')
  if (at <= 0) return []
  const local = value.slice(0, at)
  const typed = value.slice(at + 1).toLowerCase()
  if (typed.includes('@') || /\s/.test(typed) || /\s/.test(local)) return []
  if (domains.includes(typed)) return []
  return domains.filter((domain) => domain.startsWith(typed)).map((domain) => `${local}@${domain}`)
}
