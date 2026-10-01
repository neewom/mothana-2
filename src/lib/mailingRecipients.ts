// Doit rester cohérente avec la validation de send-mailing-brevo (Edge Function) :
// l'aperçu avant envoi doit refléter exactement ce qui sera réellement envoyé/exclu.
export const MAILING_EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

interface MailingContact {
  courriel: string | null
  mailing_opt_out: boolean
}

export interface MailingRecipientGroups<T extends MailingContact> {
  deliverable: T[]
  missingEmail: T[]
  invalidEmail: T[]
  optedOut: T[]
}

export function classifyMailingRecipients<T extends MailingContact>(
  contacts: T[],
): MailingRecipientGroups<T> {
  const groups: MailingRecipientGroups<T> = {
    deliverable: [],
    missingEmail: [],
    invalidEmail: [],
    optedOut: [],
  }

  for (const contact of contacts) {
    if (contact.mailing_opt_out) {
      groups.optedOut.push(contact)
      continue
    }

    const email = contact.courriel?.trim() ?? ''
    if (!email) {
      groups.missingEmail.push(contact)
    } else if (!MAILING_EMAIL_REGEX.test(email)) {
      groups.invalidEmail.push(contact)
    } else {
      groups.deliverable.push(contact)
    }
  }

  return groups
}
