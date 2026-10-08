import { formatDateLongue, urlPolitiqueValide } from '../lib/couponRgpd'

interface MentionDonneesAcheteurProps {
  organisationNom: string
  /** Dernier jour de conservation (AAAA-MM-JJ), cf. dateFinConservation. */
  conserveJusquau: string
  urlPolitique: string | null
  className?: string
}

/** Information de l'acheteur (art. 13 RGPD) : courte, toujours affichée ; lien si l'organisation en a fourni un. */
export default function MentionDonneesAcheteur({
  organisationNom,
  conserveJusquau,
  urlPolitique,
  className,
}: MentionDonneesAcheteurProps) {
  const date = formatDateLongue(conserveJusquau)
  return (
    <p className={`text-xs leading-5 text-ink-faint ${className ?? ''}`}>
      Votre email est utilisé par {organisationNom} uniquement pour vous envoyer l’accès à votre portefeuille.
      Vos données sont conservées jusqu’au {date}, puis anonymisées.
      {urlPolitique && urlPolitiqueValide(urlPolitique) && (
        <>
          {' '}
          <a
            href={urlPolitique}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-sm font-medium text-stamp underline underline-offset-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stamp/70"
          >
            Politique de confidentialité
          </a>
        </>
      )}
    </p>
  )
}
