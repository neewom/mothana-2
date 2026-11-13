// Jeton de confirmation d'adresse (inscription, carte https://trello.com/c/hNqpdZXL) : 32 octets
// aléatoires en base64url, envoyés par email ; seule leur empreinte SHA-256 est enregistrée.
// Module pur (API Web Crypto, disponible dans Deno comme dans le navigateur).

export const JETON_LONGUEUR_MAX = 200

/** Jeton de 32 octets aléatoires, encodé en base64url (43 caractères, sûr dans une URL). */
export function jetonAleatoire(): string {
  const octets = crypto.getRandomValues(new Uint8Array(32))
  return btoa(String.fromCharCode(...octets)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

/** Empreinte SHA-256 (hex) d'un jeton : ce qui est stocké et comparé en base. */
export async function empreinteJeton(jeton: string): Promise<string> {
  const empreinte = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(jeton))
  return Array.from(new Uint8Array(empreinte), (o) => o.toString(16).padStart(2, '0')).join('')
}
