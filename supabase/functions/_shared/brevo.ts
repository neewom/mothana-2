// Appels à l'API Brevo du compte d'une organisation (clé dans organisation_secrets.brevo_api_key),
// partagés par send-mailing-brevo et send-recu-email. `fetchFn` est injectable pour les tests.

// Délais maximaux des appels Brevo (relecture PR #339) : sans eux, un Brevo qui ne répond pas
// bloquerait la fonction jusqu'à son propre délai d'exécution. Un délai dépassé à l'envoi est une
// erreur sans statut HTTP (status null), donc « ambiguë » pour send-recu-email (envoi.ts).
export const DELAI_VERIFICATION_BREVO_MS = 10_000
export const DELAI_ENVOI_BREVO_MS = 20_000

export type VerificationExpediteur = 'valide' | 'non_valide' | 'impossible'

// Statut détaillé (carte B4, page Intégrations) : 'actif' | 'inactif' (présent mais pas encore
// validé) | 'introuvable' (absent du compte Brevo) | 'impossible' (Brevo n'a pas répondu
// exploitablement : clé refusée, permissions restreintes, 5xx, réseau, délai).
export type StatutExpediteurBrevo = 'actif' | 'inactif' | 'introuvable' | 'impossible'

export async function statutExpediteurBrevo(
  apiKey: string,
  email: string,
  contexte: string,
  fetchFn: typeof fetch = fetch,
  delaiMs: number = DELAI_VERIFICATION_BREVO_MS,
): Promise<StatutExpediteurBrevo> {
  try {
    const res = await fetchFn('https://api.brevo.com/v3/senders', {
      headers: { 'api-key': apiKey, Accept: 'application/json' },
      signal: AbortSignal.timeout(delaiMs),
    })
    if (!res.ok) {
      console.warn(`${contexte}: GET /v3/senders`, res.status)
      return 'impossible'
    }
    const { senders } = (await res.json()) as { senders?: { email?: string; active?: boolean }[] }
    const cible = email.trim().toLowerCase()
    const correspondants = (senders ?? []).filter((s) => s.email?.trim().toLowerCase() === cible)
    if (correspondants.length === 0) return 'introuvable'
    return correspondants.some((s) => s.active === true) ? 'actif' : 'inactif'
  } catch (err) {
    console.warn(`${contexte}: GET /v3/senders failed`, String(err))
    return 'impossible'
  }
}

/** 'valide' | 'non_valide' (Brevo a répondu : expéditeur absent ou inactif) | 'impossible'. */
export async function verifierExpediteurBrevo(
  apiKey: string,
  email: string,
  contexte: string,
  fetchFn: typeof fetch = fetch,
  delaiMs: number = DELAI_VERIFICATION_BREVO_MS,
): Promise<VerificationExpediteur> {
  const statut = await statutExpediteurBrevo(apiKey, email, contexte, fetchFn, delaiMs)
  if (statut === 'actif') return 'valide'
  if (statut === 'impossible') return 'impossible'
  return 'non_valide'
}

// Tags posés sur un email de reçu : renvoyés par Brevo dans les événements du webhook
// transactionnel (brevo-bounce-webhook), pour imputer un rejet au profil du donateur.
export const TAG_RECU_FISCAL = 'recu-fiscal'
const PREFIXE_TAG_PROFIL = 'profil:'

export function tagsEmailRecu(profilParticipantId: string): string[] {
  return [TAG_RECU_FISCAL, `${PREFIXE_TAG_PROFIL}${profilParticipantId}`]
}

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// Événement webhook → tags. Brevo envoie `tags` (tableau) et `tag` (chaîne : tags joints par des
// virgules, constaté sur l'API statistiques le 2026-11-04, ou tableau sérialisé en JSON) : toutes les
// formes sont lues.
export function tagsEvenement(evenement: { tags?: unknown; tag?: unknown }): string[] {
  const tags: string[] = []
  if (Array.isArray(evenement.tags)) {
    for (const t of evenement.tags) if (typeof t === 'string') tags.push(t)
  }
  if (typeof evenement.tag === 'string' && evenement.tag !== '') {
    const brut = evenement.tag.trim()
    if (brut.startsWith('[')) {
      try {
        const liste = JSON.parse(brut)
        if (Array.isArray(liste)) for (const t of liste) if (typeof t === 'string') tags.push(t)
      } catch {
        tags.push(...brut.split(',').map((t) => t.trim()).filter(Boolean))
      }
    } else {
      tags.push(...brut.split(',').map((t) => t.trim()).filter(Boolean))
    }
  }
  return tags
}

export type CibleRejet =
  | { type: 'adherent' }
  | { type: 'recu'; profilParticipantId: string | null }

// Un événement portant le tag reçu fiscal vise un donateur (profil participant), sinon un adhérent
// (campagnes de send-mailing-brevo, comportement d'origine).
export function cibleRejet(evenement: { tags?: unknown; tag?: unknown }): CibleRejet {
  const tags = tagsEvenement(evenement)
  if (!tags.includes(TAG_RECU_FISCAL)) return { type: 'adherent' }
  const profil = tags.find((t) => t.startsWith(PREFIXE_TAG_PROFIL))?.slice(PREFIXE_TAG_PROFIL.length) ?? null
  return { type: 'recu', profilParticipantId: profil && UUID_REGEX.test(profil) ? profil : null }
}

export interface EmailBrevo {
  expediteur: { nom: string; email: string }
  destinataire: { email: string; nom: string }
  objet: string
  html: string
  piecesJointes?: { nom: string; contenuBase64: string }[]
  tags?: string[]
}

export type ResultatEnvoiBrevo =
  | { ok: true; messageId: string | null }
  | { ok: false; status: number | null; detail: string }

/** Échec sans statut HTTP (exception réseau, délai dépassé) : status null. */
export async function envoyerEmailBrevo(
  apiKey: string,
  email: EmailBrevo,
  fetchFn: typeof fetch = fetch,
  delaiMs: number = DELAI_ENVOI_BREVO_MS,
): Promise<ResultatEnvoiBrevo> {
  try {
    const res = await fetchFn('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      signal: AbortSignal.timeout(delaiMs),
      headers: { 'api-key': apiKey, 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({
        sender: { name: email.expediteur.nom, email: email.expediteur.email },
        to: [{ email: email.destinataire.email, name: email.destinataire.nom }],
        subject: email.objet,
        htmlContent: email.html,
        ...(email.piecesJointes?.length
          ? { attachment: email.piecesJointes.map((p) => ({ name: p.nom, content: p.contenuBase64 })) }
          : {}),
        ...(email.tags?.length ? { tags: email.tags } : {}),
      }),
    })
    if (!res.ok) return { ok: false, status: res.status, detail: await res.text() }
    const data = (await res.json().catch(() => ({}))) as { messageId?: string }
    return { ok: true, messageId: data.messageId ?? null }
  } catch (err) {
    return { ok: false, status: null, detail: String(err) }
  }
}
