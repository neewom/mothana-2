// Carrousel « À essayer dans la démo » : captures de la landing, une action concrète par visuel.
// Seulement ce qui marche dans la démo (rien sur les emails ni les PDF : les actions serveur y
// répondent « indisponible »). Les images ne sont importées que par la démo.
import dashboard800 from '../../assets/landing/dashboard-800.webp'
import dashboard1280 from '../../assets/landing/dashboard-1280.webp'
import benevole320 from '../../assets/landing/benevole-mobile-320.webp'
import benevole640 from '../../assets/landing/benevole-mobile-640.webp'
import stats640 from '../../assets/landing/statistiques-640.webp'
import stats1080 from '../../assets/landing/statistiques-1080.webp'

export interface Slide {
  title: string
  /** Ce que le visiteur peut faire, tel quel, dans la démo. */
  action: string
  src: string
  srcSet: string
  alt: string
  /** Capture de téléphone (portrait) : affichée entière, centrée, plutôt que recadrée. */
  portrait?: boolean
}

export const SLIDES: Slide[] = [
  {
    title: 'Le tableau de bord',
    action: 'Clique sur « Nouveau » puis « Saisir un don » : il apparaît aussitôt dans les dons récents.',
    src: dashboard800,
    srcSet: `${dashboard800} 800w, ${dashboard1280} 1280w`,
    alt: "Tableau de bord : dons du mois et de l'année, adhésions à renouveler, dons récents et activités à venir.",
  },
  {
    title: 'La saisie bénévole',
    action: "Ouvre l'espace bénévole, entre le code 123456 et enregistre un don de 20 € en espèces.",
    src: benevole320,
    srcSet: `${benevole320} 320w, ${benevole640} 640w`,
    alt: "Espace bénévole sur téléphone : saisie d'un don de 20 € en espèces.",
    portrait: true,
  },
  {
    title: 'Les statistiques',
    action: "Ouvre « Statistiques » : les dons de l'année, mois par mois, face à l'année précédente.",
    src: stats640,
    srcSet: `${stats640} 640w, ${stats1080} 1080w`,
    alt: "Statistiques : total des dons de l'année et courbe des dons par mois comparée à l'année précédente.",
  },
]
