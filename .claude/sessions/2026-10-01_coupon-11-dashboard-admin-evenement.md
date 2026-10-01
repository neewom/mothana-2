# Coupon 11 — Dashboard admin événement

## Réalisé

- Carte Trello `3GnuIBmT` lue et go utilisateur confirmé ; branche `codex/coupon-11-dashboard-admin` créée depuis `origin/dev`, PR #200 ouverte immédiatement en draft vers `dev`, commentaire « Dev en cours » publié sur la carte.
- Nouvelle route `/admin/evenements/:id` et lien « Détails » ajoutés à la liste des événements.
- Dashboard livré : statistiques crédit vendu / dépensé / restant, portefeuilles avec recherche, historique des mouvements, commandes, et soldes restants après clôture.
- Actions admin câblées sur les RPC existantes : gel/dégel et révocation irréversible de tous les secrets, avec confirmation et retour d’erreur dans la modale. Aucune migration ajoutée.
- Validation staging sur 5174 : 7 portefeuilles, 17 mouvements et 9 commandes chargés ; agrégats réconciliés (165,00 € − 18,72 € = 146,28 €) ; gel puis dégel confirmé ; révocation réelle du portefeuille de test `retest-fix2@example.com` confirmée (1 secret conservé, 0 actif après l’appel) ; action ensuite désactivée et état « Révoqué » affiché.
- Événement de démonstration brièvement passé de `ouvert` à `clos` pour valider la liste des 7 soldes restants, puis restauré et vérifié à `ouvert`.
- Validation locale verte : `tsc -b`, lint ciblé, 51 tests Vitest, `git diff --check`, `graphify update .`, detector Impeccable sans finding, inspection desktop/mobile sans overflow ni erreur console, revue Impeccable finale `ship` après correction des trois points d’accessibilité.
- PR #200 prête pour review lead tech ; commentaire Trello « Prête pour review » publié.

## Reste à faire

- Revue lead tech de la PR #200, puis corrections éventuelles.
- Après merge uniquement : déplacer la carte vers Done et ajouter l’entrée correspondante dans `docs/journal-avancement.md` dans la même action.

## Blockers

- Aucun.

## Décisions

- Agrégats calculés côté client à partir du journal immuable des mouvements et des soldes courants ; lecture paginée par lots de 1 000 pour éviter la limite Supabase par défaut.
- Les soldes restants ne s’affichent que lorsque l’événement est clos et restent strictement informatifs : aucune action de remboursement ajoutée.
- Les secrets bruts/hachés ne sont jamais sélectionnés par le dashboard ; seules les colonnes `id`, `portefeuille_id` et `revoque_le` servent à afficher l’état d’accès.
- La recherche porte sur l’email et le code public ; les tableaux conservent le pattern responsive `ScrollShadowX` du design system.
