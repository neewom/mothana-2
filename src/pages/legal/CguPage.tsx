import LegalLayout from './LegalLayout'
import PlanLegal from './PlanLegal'

const SECTIONS = [
  'Objet et acceptation',
  'Accès au service, comptes et rôles',
  'Offre gratuite et abonnement',
  "Obligations de l'association (exactitude des reçus fiscaux, données saisies)",
  'Disponibilité et support',
  'Données, réversibilité et fin du contrat',
  'Responsabilité',
  'Droit applicable',
] as const

export default function CguPage() {
  return (
    <LegalLayout titre="Conditions générales d'utilisation">
      <PlanLegal sections={SECTIONS} />
    </LegalLayout>
  )
}
