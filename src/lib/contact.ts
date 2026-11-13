/**
 * Lien « Nous contacter » de la landing et de la démo : email vers la boîte de contact, sujet prérempli.
 * Tant que l'inscription en ligne n'a plus de lien public (cf. `essaiGratuit.ts`), c'est la seule suite
 * proposée après la démo.
 */
export const CONTACT_EMAIL = 'contact@samakan.fr'
export const CONTACT_MAILTO = `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent('Samakan — prise de contact')}`
