import LegalLayout, { ACompleter, SectionLegale } from './LegalLayout'

export default function MentionsLegalesPage() {
  return (
    <LegalLayout titre="Mentions légales">
      <SectionLegale titre="Éditeur du site">
        <p>
          <ACompleter>Nom et prénom, ou raison sociale</ACompleter> — <ACompleter>forme juridique</ACompleter>
          <br />
          Adresse : <ACompleter>adresse du siège ou du domicile</ACompleter>
          <br />
          SIREN / SIRET : <ACompleter>numéro</ACompleter> — <ACompleter>RCS ou RNE et ville, capital social si société</ACompleter>
          <br />
          TVA intracommunautaire : <ACompleter>numéro, ou « TVA non applicable, art. 293 B du CGI »</ACompleter>
        </p>
      </SectionLegale>
      <SectionLegale titre="Directeur de la publication">
        <p>
          <ACompleter>Nom et prénom</ACompleter>
        </p>
      </SectionLegale>
      <SectionLegale titre="Hébergeurs">
        <p>
          Site : <ACompleter>nom, adresse et contact de l'hébergeur du site</ACompleter>
          <br />
          Données de l'application : <ACompleter>nom, adresse, contact et région d'hébergement</ACompleter>
        </p>
      </SectionLegale>
      <SectionLegale titre="Contact">
        <p>
          Email :{' '}
          <a href="mailto:contact@samakan.fr" className="rounded-sm text-stamp underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stamp/70">
            contact@samakan.fr
          </a>
          <br />
          Téléphone : <ACompleter>numéro, facultatif</ACompleter>
        </p>
      </SectionLegale>
    </LegalLayout>
  )
}
