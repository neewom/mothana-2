# Campagne mailing — retours de revue sur les modales d'exclusion

## Réalisé

- PR #204 et revue lead tech relues sur source vivante ; suggestion mobile confirmée sur le `break-all` du fallback « Non renseigné ».
- PR repassée temporairement en draft pour l'itération UX demandée par l'utilisateur.
- Tableaux des modales nominatives harmonisés avec les conventions Mothana : intitulé « Adhérent » pour les exclusions, chevron de ligne cliquable, libellé accessible d'ouverture de fiche.
- Colonne Email supprimée dans la modale « email manquant » ; les autres catégories conservent l'email avec `break-words` pour les valeurs longues et le fallback éventuel.
- Validation locale verte : `tsc -b`, lint ciblé, 55 tests Vitest, build Vite, détecteur Impeccable, `git diff --check` et `graphify update .`.
- Correctif UX validé par l'utilisateur ; PR #204 repassée en ready for review, validation publiée sur la PR et nouveau commentaire « prête pour review » publié sur Trello.

## Reste à faire

- Confirmation finale du lead tech sur le correctif de revue.
- Après approbation lead tech et autorisation explicite utilisateur : merge, déplacement Trello vers Done et entrée correspondante dans `docs/journal-avancement.md` dans la même action.

## Blockers

- Aucun blocker code.

## Décisions

- La modale « email manquant » reste un tableau à une colonne de contenu plus le chevron, enveloppé dans `ScrollShadowX` conformément au design system.
- Le tableau existant des destinataires valides reçoit aussi le chevron de ligne cliquable pour rester cohérent avec le comportement partagé de la modale.
