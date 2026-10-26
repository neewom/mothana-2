// Secret partagé d'un webhook entrant (ex. rebonds Brevo, qui ne signe pas ses envois).

export function genererSecretWebhook(): string {
  const octets = crypto.getRandomValues(new Uint8Array(32))
  return Array.from(octets, (o) => o.toString(16).padStart(2, '0')).join('')
}

// Comparaison en temps constant (la durée ne révèle pas le nombre de caractères corrects).
export function secretsEgaux(recu: string | null, attendu: string | null): boolean {
  if (!recu || !attendu) return false
  const a = new TextEncoder().encode(recu)
  const b = new TextEncoder().encode(attendu)
  let diff = a.length ^ b.length
  for (let i = 0; i < b.length; i++) diff |= (a[i] ?? 0) ^ b[i]
  return diff === 0
}
