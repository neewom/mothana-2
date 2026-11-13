// Traitement d'une demande d'inscription publique (carte https://trello.com/c/hNqpdZXL), séparé de
// index.ts pour être testé cas par cas avec des dépendances factices.
//
// Réponse publique identique dans tous les cas acceptés (nouvelle demande, demande à confirmer
// renvoyée, compte existant, demande déjà en attente, champ piège rempli) : seul l'email envoyé
// diffère, et seul le propriétaire de la boîte le lit. Une nouvelle demande (ou une demande pas
// encore confirmée, soumise à nouveau) reçoit le lien de confirmation de l'adresse ; le
// super-admin n'est notifié qu'à la confirmation (confirmer-demande-inscription).
// Exceptions : corps invalide (400), débit dépassé (429, message neutre), service mal configuré
// (503).
import { saisieDepuisCorps, validerDemandeInscription, type DemandeInscriptionNormalisee } from '../_shared/inscription.ts'
import {
  emailAccuseCompteExistant,
  emailAccuseDemandeEnCours,
  emailConfirmationDemande,
  lienConfirmationInscription,
  type EmailInscription,
} from '../_shared/inscriptionEmails.ts'
import { normaliseSiteUrl } from '../_shared/siteUrl.ts'

export const CHAMP_PIEGE = 'site_web'
export const CORPS_MAX = 20_000
export const RETRY_AFTER_SECONDS = '3600'

export type ResultatRpc =
  | { ok: false; reason: 'ACCES_INVALIDE' | 'RATE_LIMIT' | string }
  | { ok: true; cas: 'nouvelle' | 'a_confirmer' | 'compte_existant' | 'en_attente'; envoyer_accuse: boolean; demande_id?: string }

export interface DependancesSoumission {
  hashIp(): Promise<string>
  hashEmail(email: string): Promise<string>
  /** Jeton de confirmation (envoyé par email) et son empreinte SHA-256 (seule enregistrée). */
  jeton(): Promise<{ jeton: string; empreinte: string }>
  soumettre(ipHash: string, emailHash: string, jetonHash: string, demande: DemandeInscriptionNormalisee): Promise<ResultatRpc | null>
  envoyer(destinataire: string, email: EmailInscription): Promise<void>
  /** Poursuit les envois après la réponse : son délai ne dépend pas du cas (anti-énumération). */
  arrierePlan(tache: Promise<unknown>): void
  /** CGU publiées (constante CGU_PUBLIEES) : `cgu_acceptees` est alors exigé. */
  cguPubliees: boolean
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
  // CGU publiées : la case est exigée ici aussi, comme sur le formulaire.
  const validation = validerDemandeInscription(saisieDepuisCorps(corps), deps.cguPubliees)
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

  const { jeton, empreinte } = await deps.jeton()
  const resultat = await deps.soumettre(ipHash, emailHash, empreinte, demande)
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

  if (resultat.envoyer_accuse) {
    const email = resultat.cas === 'nouvelle' || resultat.cas === 'a_confirmer'
      ? emailConfirmationDemande({
        prenom: demande.prenom,
        nomAssociation: demande.nom_association,
        lien: lienConfirmationInscription(siteUrl, jeton),
      })
      : resultat.cas === 'compte_existant'
        ? emailAccuseCompteExistant({ prenom: demande.prenom, siteUrl })
        : emailAccuseDemandeEnCours({ prenom: demande.prenom })
    // Un envoi en échec ne change pas la réponse (la demande est enregistrée ; une nouvelle
    // soumission renvoie le lien).
    deps.arrierePlan(Promise.allSettled([deps.envoyer(demande.email, email)]))
  }

  return REPONSE_OK
}
