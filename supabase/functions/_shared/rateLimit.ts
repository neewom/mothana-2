function clientIp(req: Request): string {
  const forwarded = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
  return req.headers.get('cf-connecting-ip')?.trim()
    || forwarded
    || req.headers.get('x-real-ip')?.trim()
    || 'unknown'
}

export async function hashClientIp(req: Request): Promise<string> {
  const keyValue = Deno.env.get('PORTEFEUILLE_RATE_LIMIT_KEY')
  if (!keyValue) throw new Error('RATE_LIMIT_KEY_MISSING')

  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(keyValue),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const signature = await crypto.subtle.sign(
    'HMAC',
    key,
    new TextEncoder().encode(clientIp(req)),
  )
  return Array.from(
    new Uint8Array(signature),
    (byte) => byte.toString(16).padStart(2, '0'),
  ).join('')
}
