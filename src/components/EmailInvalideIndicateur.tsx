import { libelleRejetEmail } from '../lib/emailInvalide'

interface EmailInvalideIndicateurProps {
  /** profils_participant.email_invalide_at : rien n'est affiché s'il est vide. */
  invalideLe: string | null | undefined
  evenement?: string | null
  raison?: string | null
  /** pastille : liste (comme les demandes d'adhésion) ; detail : sous l'email d'une fiche (comme la fiche adhérent). */
  variante?: 'pastille' | 'detail'
}

/**
 * Indicateur « Email invalide » d'un donateur : un email de reçu fiscal envoyé par le Brevo de
 * l'organisation a été rejeté (brevo-bounce-webhook). Effacé quand l'email de la personne change.
 */
export default function EmailInvalideIndicateur({ invalideLe, evenement = null, raison = null, variante = 'pastille' }: EmailInvalideIndicateurProps) {
  if (!invalideLe) return null
  if (variante === 'pastille') {
    return (
      <span
        title="Un email de reçu envoyé à cette adresse n'a pas pu être délivré"
        className="inline-flex items-center whitespace-nowrap rounded-full border border-warning-border bg-white px-2 py-0.5 font-registre-mono text-[11px] font-medium text-warning"
      >
        Email invalide
      </span>
    )
  }
  const libelle = libelleRejetEmail(evenement, raison)
  return (
    <div className="font-registre-mono text-[11px] text-warning">
      <p>Email invalide — un envoi précédent à cette adresse n'a pas pu être délivré (mis à jour si vous corrigez l'adresse).</p>
      <p className="mt-0.5">
        {libelle ? `${libelle} · ` : ''}le {new Date(invalideLe).toLocaleDateString('fr-FR')}
      </p>
    </div>
  )
}
