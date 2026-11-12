/**
 * Pages légales du site public (mentions légales, confidentialité, CGU).
 * Gabarits à compléter par l'éditeur : tout texte entre crochets est à remplacer.
 * Point d'entrée unique pour leurs adresses et libellés (pied de page, liens).
 */
export const PAGES_LEGALES = [
  { path: '/mentions-legales', label: 'Mentions légales' },
  { path: '/confidentialite', label: 'Confidentialité' },
  { path: '/cgu', label: 'CGU' },
] as const

/**
 * Vrai une fois les CGU rédigées et publiées : le formulaire d'inscription affiche alors la case
 * « J'accepte les CGU » (obligatoire, date d'acceptation enregistrée). En attendant, une mention
 * renvoie à la page Confidentialité.
 */
export const CGU_PUBLIEES = false
