// Aléas cryptographiques des comptes techniques bénévole/vendeur (audit sécurité 2026-10-24) :
// jamais Math.random.

/** Secret de 32 octets (hex) : mot de passe des comptes techniques, jamais conservé. */
export function secretAleatoire(): string {
  const octets = crypto.getRandomValues(new Uint8Array(32))
  return Array.from(octets, (o) => o.toString(16).padStart(2, '0')).join('')
}

/** PIN à 6 chiffres uniformément tiré (tirage par rejet, sans biais de modulo). */
export function pinAleatoire(): string {
  const plage = 900000
  const limite = Math.floor(0x1_0000_0000 / plage) * plage
  const buffer = new Uint32Array(1)
  do {
    crypto.getRandomValues(buffer)
  } while (buffer[0] >= limite)
  return String(100000 + (buffer[0] % plage))
}
