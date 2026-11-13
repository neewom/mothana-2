// Slug URL d'une organisation ou d'un événement (séparateur '-') : partagé entre le front
// (src/lib/organisationAssets.ts) et l'Edge Function creer-organisation.
export function slugifyUrl(input: string): string {
  return input
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

/**
 * Premier slug libre à partir de `base` : `base`, puis `base-2`, `base-3`… (inscription publique :
 * deux associations homonymes ne doivent pas se bloquer). `existants` : slugs déjà pris.
 */
export function slugDisponible(base: string, existants: Iterable<string>): string {
  const pris = new Set(existants)
  if (!pris.has(base)) return base
  let n = 2
  while (pris.has(`${base}-${n}`)) n++
  return `${base}-${n}`
}
