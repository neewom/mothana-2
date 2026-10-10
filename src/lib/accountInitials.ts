/** Initiales de l'avatar du menu compte : nom affiché si renseigné, sinon partie locale de l'email. */
export function accountInitials(nomAffiche: string | null | undefined, email: string | null | undefined): string {
  const source = nomAffiche?.trim() || email?.split('@')[0]?.trim() || ''
  const words = source.split(/[\s._-]+/).filter(Boolean)
  if (words.length === 0) return '?'
  const letters = words.length === 1 ? words[0].slice(0, 2) : words[0][0] + words[words.length - 1][0]
  return letters.toLocaleUpperCase('fr-FR')
}
