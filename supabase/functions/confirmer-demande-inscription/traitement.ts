// Confirmation de l'adresse d'une demande d'inscription (carte https://trello.com/c/hNqpdZXL),
// séparée de index.ts pour être testée cas par cas avec des dépendances factices.
//
// Corps : {jeton, site_url}. Le jeton n'est jamais enregistré ni journalisé : seule son empreinte
// SHA-256 part à la RPC confirmer_demande_inscription, qui fait passer la demande de a_confirmer
// à en_attente. Réponse {ok:true, cas} : confirmee | deja_confirmee | expiree | invalide (le
// jeton est secret, le cas peut être affiché tel quel). La notification du super-admin part
// seulement au cas confirmee (une fois : un second clic répond deja_confirmee).
import { emailNotificationSuperAdmin, type DemandePourNotification, type EmailInscription } from '../_shared/inscriptionEmails.ts'
import { JETON_LONGUEUR_MAX } from '../_shared/jetonConfirmation.ts'
import { normaliseSiteUrl } from '../_shared/siteUrl.ts'

export const CORPS_MAX = 2_000
export const RETRY_AFTER_SECONDS = '3600'

export type CasConfirmation = 'confirmee' | 'deja_confirmee' | 'expiree' | 'invalide'

export type ResultatRpcConfirmation =
  | { ok: false; reason: 'ACCES_INVALIDE' | 'RATE_LIMIT' | string }
  | { ok: true; cas: CasConfirmation; demande?: DemandePourNotification }

export interface DependancesConfirmation {
  hashIp(): Promise<string>
  empreinte(jeton: string): Promise<string>
  confirmer(ipHash: string, jetonHash: string): Promise<ResultatRpcConfirmation | null>
  envoyer(destinataire: string, email: EmailInscription): Promise<void>
  /** Adresse de notification du super-admin (secret INSCRIPTION_NOTIF_EMAIL), absente = pas de notification. */
  emailNotification: string | null
  /** Poursuit l'envoi après la réponse. */
  arrierePlan(tache: Promise<unknown>): void
}

export interface ReponseConfirmation {
  status: number
  body: Record<string, unknown>
  headers?: Record<string, string>
}

const CAS: CasConfirmation[] = ['confirmee', 'deja_confirmee', 'expiree', 'invalide']

export async function traiterConfirmation(raw: string, deps: DependancesConfirmation): Promise<ReponseConfirmation> {
  if (raw.length > CORPS_MAX) return { status: 400, body: { error: 'DEMANDE_INVALIDE' } }
  let corps: Record<string, unknown>
  try {
    const parsed = JSON.parse(raw)
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return { status: 400, body: { error: 'DEMANDE_INVALIDE' } }
    corps = parsed as Record<string, unknown>
  } catch {
    return { status: 400, body: { error: 'DEMANDE_INVALIDE' } }
  }

  const jeton = typeof corps.jeton === 'string' ? corps.jeton.trim() : ''
  const siteUrl = normaliseSiteUrl(corps.site_url)
  if (!jeton || jeton.length > JETON_LONGUEUR_MAX || !siteUrl) return { status: 400, body: { error: 'DEMANDE_INVALIDE' } }

  let ipHash: string
  try {
    ipHash = await deps.hashIp()
  } catch {
    console.error('confirmer-demande-inscription : limitation non configurée')
    return { status: 503, body: { error: 'SERVICE_INDISPONIBLE' } }
  }

  const resultat = await deps.confirmer(ipHash, await deps.empreinte(jeton))
  if (!resultat || !resultat.ok) {
    if (resultat?.reason === 'RATE_LIMIT') {
      return {
        status: 429,
        body: { error: 'TROP_DE_DEMANDES', message: 'Trop d’essais en ce moment. Réessaie dans une heure.' },
        headers: { 'Retry-After': RETRY_AFTER_SECONDS },
      }
    }
    console.error('confirmer-demande-inscription : confirmation refusée', resultat?.reason)
    return { status: 503, body: { error: 'SERVICE_INDISPONIBLE' } }
  }
  if (!CAS.includes(resultat.cas)) {
    console.error('confirmer-demande-inscription : cas inattendu', resultat.cas)
    return { status: 503, body: { error: 'SERVICE_INDISPONIBLE' } }
  }

  if (resultat.cas === 'confirmee' && resultat.demande && deps.emailNotification) {
    // Un envoi en échec ne change pas la réponse (la demande est confirmée et visible du super-admin).
    deps.arrierePlan(Promise.allSettled([
      deps.envoyer(deps.emailNotification, emailNotificationSuperAdmin(resultat.demande, `${siteUrl}/super-admin`)),
    ]))
  }

  return { status: 200, body: { ok: true, cas: resultat.cas } }
}
