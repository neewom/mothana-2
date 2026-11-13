/**
 * Destination de l'ancien bouton « Essayer gratuitement » : la demande d'espace en ligne (carte
 * « Inscription freemium »), validée par le super-admin.
 *
 * En sommeil : tant que l'offre n'est pas prête, la landing et la démo ne mènent plus qu'à la démo et au
 * contact (carte « Landing : démo + contact seulement »), et plus aucun lien public ne pointe vers
 * /inscription — la page reste en place et fonctionnelle pour qui a le lien. Pour réactiver l'essai :
 * importer cette constante dans `src/pages/LandingPage.tsx`, y remettre un bouton plein « Essayer
 * gratuitement » (`<Link to={ESSAI_GRATUIT_HREF}>`) dans `BoutonsAppel`, et passer la démo en bouton
 * secondaire (cf. l'historique git de la carte).
 */
export const ESSAI_GRATUIT_HREF = '/inscription'
