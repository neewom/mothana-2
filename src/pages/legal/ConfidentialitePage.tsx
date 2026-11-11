import LegalLayout from './LegalLayout'
import PlanLegal from './PlanLegal'

const SECTIONS = [
  'Responsable du traitement (site) et rôle de sous-traitant (données des associations)',
  'Données collectées et finalités',
  'Base légale de chaque traitement',
  'Durées de conservation',
  'Destinataires et sous-traitants (hébergement, emails, génération des PDF)',
  "Lieu d'hébergement et transferts hors de l'Union européenne",
  'Droits des personnes et contact',
  'Cookies et mesure d’audience',
] as const

export default function ConfidentialitePage() {
  return (
    <LegalLayout titre="Politique de confidentialité">
      <PlanLegal sections={SECTIONS} />
    </LegalLayout>
  )
}
