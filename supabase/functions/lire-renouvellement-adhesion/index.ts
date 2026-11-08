import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { hashClientIp } from '../_shared/rateLimit.ts'
import {
  corsHeaders,
  dateFinPublique,
  etatPublic,
  isSecretHash,
  jsonResponse,
} from '../soumettre-renouvellement-adhesion/renouvellement.ts'

// Lecture d'un lien personnel de renouvellement (/adhesion/<slug>/renouveler#<secret>) —
// Renouvellement 2/3, 2026-10-30. Modèle de get-portefeuille : le navigateur n'envoie que
// l'empreinte SHA-256 du secret ; la RPC lire_lien_renouvellement (service_role seulement) compte
// les appels par IP (empreinte HMAC) et par lien, et ne renvoie les coordonnées de l'adhérent
// (jamais sa date de naissance) que pour un lien valide. Aucune distinction inconnu / révoqué /
// utilisé : « lien_invalide ».

const RETRY_AFTER_SECONDS = '600'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return jsonResponse({ error: 'METHODE_NON_AUTORISEE' }, 405)

  const raw = await req.text()
  let body: { secret_hash?: unknown; slug?: unknown } | null = null
  if (raw.length <= 512) {
    try {
      body = JSON.parse(raw)
    } catch {
      body = null
    }
  }
  const slug = typeof body?.slug === 'string' ? body.slug.trim() : ''
  if (!body || !isSecretHash(body.secret_hash) || !slug || slug.length > 100) {
    return jsonResponse({ error: 'LIEN_INVALIDE' }, 404)
  }

  let ipHash: string
  try {
    ipHash = await hashClientIp(req)
  } catch {
    console.error('lire-renouvellement-adhesion: rate limiter is not configured')
    return jsonResponse({ error: 'SERVICE_INDISPONIBLE' }, 503)
  }

  const adminClient = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
    auth: { persistSession: false },
  })
  const { data, error } = await adminClient.rpc('lire_lien_renouvellement', {
    p_secret_hash: body.secret_hash,
    p_ip_hash: ipHash,
    p_slug: slug,
  })
  if (error) {
    console.error('lire-renouvellement-adhesion: read failed', error.code)
    return jsonResponse({ error: 'SERVICE_INDISPONIBLE' }, 503)
  }

  const resultat = data as Record<string, unknown> | null
  if (!resultat?.ok) {
    if (resultat?.reason === 'RATE_LIMIT') {
      return jsonResponse({ error: 'TROP_DE_REQUETES' }, 429, { 'Retry-After': RETRY_AFTER_SECONDS })
    }
    return jsonResponse({ error: 'LIEN_INVALIDE' }, 404)
  }

  const organisation = resultat.organisation ?? null
  if (resultat.etat === 'valide' && resultat.adherent && organisation) {
    return jsonResponse({ etat: 'valide', organisation, adherent: resultat.adherent })
  }

  const etat = etatPublic(resultat.etat)
  return jsonResponse({
    etat,
    organisation,
    ...(etat === 'deja_renouvele' ? { date_fin: dateFinPublique(resultat.date_fin) } : {}),
  })
})
