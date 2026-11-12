/**
 * Destination du bouton « Essayer gratuitement » (landing page et pages publiques).
 *
 * Provisoire : l'inscription en libre-service (`/inscription`) n'existe pas encore ;
 * en attendant, le bouton ouvre un email prérempli vers contact@samakan.fr.
 * La carte « inscription » remplacera cette valeur par `'/inscription'` (une ligne).
 */
export const ESSAI_GRATUIT_HREF =
  'mailto:contact@samakan.fr?subject=' +
  encodeURIComponent('Essayer Samakan gratuitement') +
  '&body=' +
  encodeURIComponent("Bonjour,\n\nJe souhaite essayer Samakan pour mon association.\n\nNom de l'association :\n")

/** Vrai tant que la destination est un email (lien externe) plutôt qu'une route de l'app. */
export const ESSAI_GRATUIT_EST_EXTERNE = !ESSAI_GRATUIT_HREF.startsWith('/')
