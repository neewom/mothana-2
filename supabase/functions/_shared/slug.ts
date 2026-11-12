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
