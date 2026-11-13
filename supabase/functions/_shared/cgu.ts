// Source unique de la publication des CGU (carte https://trello.com/c/hNqpdZXL), lue par le
// formulaire /inscription et par l'Edge Function soumettre-demande-inscription. Module pur.
//
// Vrai une fois les CGU rédigées et publiées : la case « J'accepte les CGU » s'affiche, devient
// obligatoire (exigée aussi côté serveur) et la date d'acceptation est enregistrée. En attendant,
// une mention renvoie à la page Confidentialité.
export const CGU_PUBLIEES = false
