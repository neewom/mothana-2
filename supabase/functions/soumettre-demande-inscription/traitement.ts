// Traitement d'une demande d'inscription publique (carte https://trello.com/c/hNqpdZXL), séparé de
// index.ts pour être testé cas par cas avec des dépendances factices.
//
// Réponse publique identique dans tous les cas acceptés (nouvelle demande, compte existant,
// demande déjà en attente, champ piège rempli) : seul l'email envoyé diffère, et seul le
// propriétaire de la boîte le lit. Exceptions : corps invalide (400), débit dépassé (429, message
// neutre), service mal configuré (503).
import { saisieDepuisCorps, validerDemandeInscription, type DemandeInscriptionNormalisee } from '../_shared/inscription.ts'
import {
  emailAccuseCompteExistant,
  emailAccuseDemandeEnCours,
  emailAccuseNouvelleDemande,
  emailNotificationSuperAdmin,
  type EmailInscription,
} from '../_shared/inscriptionEmails.ts'
import { normaliseSiteUrl } from '../_shared/siteUrl.ts'

export const CHAMP_PIEGE = 'site_web'
export const CORPS_MAX = 20_000
export const RETRY_AFTER_SECONDS = '3600'

export type ResultatRpc =
  | { ok: false; reason: 'ACCES_INVALIDE' | 'RATE_LIMIT' | string }
  | { ok: true; cas: 'nouvelle' | 'compte_existant' | 'en_attente'; envoyer_accuse: boolean; demande_id?: string }

export interface DependancesSoumission {
  hashIp(): Promise<string>
  hashEmail(email: string): Promise<string>
  soumettre(ipHash: string, emailHash: string, demande: DemandeInscriptionNormalisee): Promise<ResultatRpc | null>
  envoyer(destinataire: string, email: EmailInscription): Promise<void>
  /** Adresse de notification du super-admin (secret INSCRIPTION_NOTIF_EMAIL), absente = pas de notification. */
  emailNotification: string | null
  /** Poursuit les envois après la réponse : son délai ne dépend pas du cas (anti-énumération). */
  arrierePlan(tache: Promise<unknown>): void
}

export interface ReponseSoumission {
  status: number
  body: Record<string, unknown>
  headers?: Record<string, string>
}

export const REPONSE_OK: ReponseSoumission = { status: 200, body: { ok: true } }

export async function traiterSoumission(raw: string, deps: DependancesSoumission): Promise<ReponseSoumission> {
  if (raw.length > CORPS_MAX) return { status: 400, body: { error: 'DEMANDE_INVALIDE' } }
  let corps: Record<string, unknown>
  try {
    const parsed = JSON.parse(raw)
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return { status: 400, body: { error: 'DEMANDE_INVALIDE' } }
    corps = parsed as Record<string, unknown>
  } catch {
    return { status: 400, body: { error: 'DEMANDE_INVALIDE' } }
  }

  // Champ piège rempli : succès apparent, rien n'est écrit ni envoyé.
  if (typeof corps[CHAMP_PIEGE] === 'string' && (corps[CHAMP_PIEGE] as string).trim() !== '') return REPONSE_OK

  const siteUrl = normaliseSiteUrl(corps.site_url)
  // La case CGU n'est exigée que côté formulaire, quand elle est affichée (CGU_PUBLIEES).
  const validation = validerDemandeInscription(saisieDepuisCorps(corps), false)
  if (!siteUrl || !validation.ok) return { status: 400, body: { error: 'DEMANDE_INVALIDE' } }
  const demande = validation.demande

  let ipHash: string
  let emailHash: string
  try {
    ipHash = await deps.hashIp()
    emailHash = await deps.hashEmail(demande.email)
  } catch {
    console.error('soumettre-demande-inscription : limitation non configurée')
    return { status: 503, body: { error: 'SERVICE_INDISPONIBLE' } }
  }

  const resultat = await deps.soumettre(ipHash, emailHash, demande)
  if (!resultat || !resultat.ok) {
    if (resultat?.reason === 'RATE_LIMIT') {
      return {
        status: 429,
        body: { error: 'TROP_DE_DEMANDES', message: 'Trop de demandes en ce moment. Réessaie dans une heure.' },
        headers: { 'Retry-After': RETRY_AFTER_SECONDS },
      }
    }
    console.error('soumettre-demande-inscription : soumission refusée', resultat?.reason)
    return { status: 503, body: { error: 'SERVICE_INDISPONIBLE' } }
  }

  const envois: Promise<void>[] = []
  if (resultat.envoyer_accuse) {
    const accuse = resultat.cas === 'nouvelle'
      ? emailAccuseNouvelleDemande({ prenom: demande.prenom, nomAssociation: demande.nom_association })
      : resultat.cas === 'compte_existant'
        ? emailAccuseCompteExistant({ prenom: demande.prenom, siteUrl })
        : emailAccuseDemandeEnCours({ prenom: demande.prenom })
    envois.push(deps.envoyer(demande.email, accuse))
  }
  if (resultat.cas === 'nouvelle' && deps.emailNotification) {
    envois.push(deps.envoyer(deps.emailNotification, emailNotificationSuperAdmin(demande, `${siteUrl}/super-admin`)))
  }
  // Un envoi en échec ne change pas la réponse (la demande est enregistrée).
  if (envois.length > 0) deps.arrierePlan(Promise.allSettled(envois))

  return REPONSE_OK
}
