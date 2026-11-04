// Appels à l'API Brevo du compte d'une organisation (clé dans organisation_secrets.brevo_api_key),
// partagés par send-mailing-brevo et send-recu-email. `fetchFn` est injectable pour les tests.

export type VerificationExpediteur = 'valide' | 'non_valide' | 'impossible'

/** 'valide' | 'non_valide' (Brevo a répondu : expéditeur absent ou inactif) | 'impossible'. */
export async function verifierExpediteurBrevo(
  apiKey: string,
  email: string,
  contexte: string,
  fetchFn: typeof fetch = fetch,
): Promise<VerificationExpediteur> {
  try {
    const res = await fetchFn('https://api.brevo.com/v3/senders', {
      headers: { 'api-key': apiKey, Accept: 'application/json' },
    })
    if (!res.ok) {
      console.warn(`${contexte}: GET /v3/senders`, res.status)
      return 'impossible'
    }
    const { senders } = (await res.json()) as { senders?: { email?: string; active?: boolean }[] }
    const cible = email.trim().toLowerCase()
    return (senders ?? []).some((s) => s.email?.trim().toLowerCase() === cible && s.active === true)
      ? 'valide'
      : 'non_valide'
  } catch (err) {
    console.warn(`${contexte}: GET /v3/senders failed`, String(err))
    return 'impossible'
  }
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

export async function envoyerEmailBrevo(
  apiKey: string,
  email: EmailBrevo,
  fetchFn: typeof fetch = fetch,
): Promise<ResultatEnvoiBrevo> {
  try {
    const res = await fetchFn('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
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
