import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { hashClientIp } from '../_shared/rateLimit.ts'
import { sendViaResend } from '../_shared/resend.ts'
import { validerDemandeAdhesion } from '../soumettre-demande-adhesion/validation.ts'
import { lienPageDemandes } from '../soumettre-demande-adhesion/notificationAdmins.ts'
import { prevenirComptesOrganisation } from '../soumettre-demande-adhesion/prevenirComptes.ts'
import {
  SUJET_CONFIRMATION_RENOUVELLEMENT,
  confirmationRenouvellementHtml,
  corsHeaders,
  dateFinPublique,
  etatPublic,
  isSecretHash,
  jsonResponse,
} from './renouvellement.ts'

// Tâches poursuivies après la réponse (runtime Supabase Edge) ; absent en local → attendues.
declare const EdgeRuntime: { waitUntil(promise: Promise<unknown>): void } | undefined

// Envoi d'une demande de renouvellement par lien personnel (Renouvellement 2/3, 2026-10-30).
// Mêmes protections que soumettre-demande-adhesion :
//   1. champ piège rempli → succès apparent, rien n'est écrit ni envoyé ;
//   2. validation complète côté serveur (validation.ts partagé), date de naissance ignorée ;
//   3. RPC soumettre_renouvellement (service_role) : limites par IP et par lien, état du lien,
//      insertion de la demande « renouvellement » rattachée à l'adhérent du lien et lien marqué
//      utilisé, dans la même transaction ;
//   4. email de confirmation (texte saisi échappé, tag demande_id pour resend-bounce-webhook),
//      puis comptes de l'organisation prévenus (mêmes réglages que les demandes d'adhésion).
// Un lien est à usage unique : au plus une confirmation par lien.

const RETRY_AFTER_SECONDS = '3600'
// Signature (≤ 300 000 caractères) et champs texte : le corps reste bien en deçà.
const CORPS_MAX = 400_000

const invalide = () => jsonResponse({ error: 'DEMANDE_INVALIDE' }, 400)
const indisponible = () => jsonResponse({ error: 'SERVICE_INDISPONIBLE' }, 503)

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return jsonResponse({ error: 'METHODE_NON_AUTORISEE' }, 405)

  const raw = await req.text()
  if (raw.length > CORPS_MAX) return invalide()
  let corps: Record<string, unknown>
  try {
    const parsed = JSON.parse(raw)
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return invalide()
    corps = parsed as Record<string, unknown>
  } catch {
    return invalide()
  }

  // 1. Champ piège : succès apparent, rien d'écrit.
  if (typeof corps.site_web === 'string' && corps.site_web.trim() !== '') {
    return jsonResponse({ ok: true })
  }

  if (!isSecretHash(corps.secret_hash)) return jsonResponse({ error: 'LIEN_INVALIDE' }, 404)
  const slug = typeof corps.slug === 'string' ? corps.slug.trim() : ''
  if (!slug || slug.length > 100) return invalide()

  const adminClient = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
    auth: { persistSession: false },
  })

  // 2. Validation (statuts exigés si l'organisation en publie).
  const { data: organisation, error: orgError } = await adminClient
    .from('organisations')
    .select('nom, statuts_url')
    .eq('slug', slug)
    .is('archived_at', null)
    .maybeSingle()
  if (orgError) {
    console.error('soumettre-renouvellement-adhesion: organisation lookup failed', orgError.code)
    return indisponible()
  }
  if (!organisation) return jsonResponse({ error: 'LIEN_INVALIDE', etat: 'lien_invalide' }, 409)

  const validation = validerDemandeAdhesion({ ...corps, date_naissance: null }, Boolean(organisation.statuts_url))
  if (!validation.ok) return invalide()
  const v = validation.demande
  // Colonnes enregistrées : ni slug ni date de naissance (déjà connue pour l'adhérent).
  const demande = {
    civilite: v.civilite, nom: v.nom, prenom: v.prenom, adresse: v.adresse, code_postal: v.code_postal,
    ville: v.ville, pays: v.pays, telephone: v.telephone, courriel: v.courriel,
    signature_data_url: v.signature_data_url, accepte_statuts: v.accepte_statuts, consent_rgpd: v.consent_rgpd,
  }

  // 3. Limites, état du lien, insertion et lien utilisé (une transaction).
  let ipHash: string
  try {
    ipHash = await hashClientIp(req)
  } catch {
    console.error('soumettre-renouvellement-adhesion: rate limiter is not configured')
    return indisponible()
  }
  const { data, error } = await adminClient.rpc('soumettre_renouvellement', {
    p_secret_hash: corps.secret_hash,
    p_ip_hash: ipHash,
    p_slug: slug,
    p_demande: demande,
  })
  if (error) {
    // Deux liens du même adhérent envoyés au même instant : l'index unique tranche.
    if (error.code === '23505') return jsonResponse({ error: 'LIEN_INVALIDE', etat: 'deja_envoye' }, 409)
    console.error('soumettre-renouvellement-adhesion: submit failed', error.code)
    return error.code?.startsWith('23') ? invalide() : indisponible()
  }

  const resultat = data as Record<string, unknown> | null
  if (!resultat?.ok) {
    if (resultat?.reason === 'RATE_LIMIT') {
      return jsonResponse({ error: 'TROP_DE_REQUETES' }, 429, { 'Retry-After': RETRY_AFTER_SECONDS })
    }
    if (resultat?.reason === 'ETAT') {
      const etat = etatPublic(resultat.etat)
      return jsonResponse({
        error: 'LIEN_INVALIDE',
        etat,
        ...(etat === 'deja_renouvele' ? { date_fin: dateFinPublique(resultat.date_fin) } : {}),
      }, 409)
    }
    return invalide()
  }

  const demandeId = String(resultat.demande_id)
  const organisationId = String(resultat.organisation_id)

  // 4. Email de confirmation (best-effort), puis comptes de l'organisation en tâche de fond.
  if (demande.courriel) {
    const nomAffiche = demande.prenom ? `${demande.prenom} ${demande.nom}` : demande.nom
    const emailResult = await sendViaResend(
      demande.courriel,
      SUJET_CONFIRMATION_RENOUVELLEMENT,
      confirmationRenouvellementHtml(nomAffiche, organisation.nom),
      { tags: [{ name: 'demande_id', value: demandeId }] },
    )
    if (!emailResult.ok) console.error('soumettre-renouvellement-adhesion: Resend error', emailResult.detail)
  }

  if (resultat.notif_demandes_adhesion === true) {
    const notification = prevenirComptesOrganisation(
      adminClient,
      organisationId,
      lienPageDemandes(corps.site_url, Deno.env.get('SUPABASE_URL')),
      'renouvellement',
    ).catch((err) => console.error('soumettre-renouvellement-adhesion: notification des comptes impossible', String(err)))
    if (typeof EdgeRuntime !== 'undefined') EdgeRuntime.waitUntil(notification)
    else await notification
  }

  return jsonResponse({ ok: true })
})
