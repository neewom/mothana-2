# Coupon 10 — durcissement verify-pin

## Réalisé

- Branche `codex/coupon-10-verify-pin-rate-limit` créée depuis `origin/dev` au commit demandé `bbae716`, PR #195 ouverte immédiatement en draft vers `dev`, puis commentaire de démarrage publié sur Trello.
- Mécanisme de la carte 4 réutilisé : table `acces_portefeuille_rate_limits`, empreinte HMAC de l'IP avec `PORTEFEUILLE_RATE_LIMIT_KEY` et verrou advisory anti-course. Le calcul de l'empreinte a été extrait dans un helper partagé sans changement de comportement pour les accès portefeuille.
- Contrainte `scope` étendue à `verify_pin` et RPC `verifier_limite_verify_pin(text)` ajoutée, exécutable uniquement par `service_role`. Aucun rattachement à une organisation ou un portefeuille.
- `verify-pin` contrôle la limite avant toute recherche du PIN. Les 10 premiers appels sur 15 minutes sont autorisés ; le 11e renvoie 429, `Retry-After: 900` et un message français clair. Le flux échoue fermé en 503 si le limiteur est indisponible.
- Migration et tests SQL transactionnels appliqués avec succès sur la recette liée. Les tests couvrent les privilèges, l'empreinte invalide, le seuil, l'absence de `portefeuille_id` et la remise à zéro après la fenêtre.
- `verify-pin`, `get-portefeuille` et `generate-portefeuille-qr-pdf` redéployées sur la recette, les deux dernières embarquant le helper partagé.
- Test HTTP réel : PIN invalide sous le seuil = 401 ; 11e tentative = 429 avec `Retry-After: 900` ; compteur de test remis hors fenêtre puis retour au 401 confirmé.
- `deno check` sur les trois Edge Functions, lint Deno ciblé, `tsc -b`, `npm test` (31 tests), `git diff --check` et `graphify update .` validés.
- PR #195 passée de draft à « ready for review » et commentaire Trello « Prête pour review » publié.

## Reste à faire

- Revue complète du lead tech sur la PR #195, puis intégration des éventuels retours.
- Après merge seulement, déplacer la carte Trello en Done et ajouter l'entrée correspondante dans `docs/journal-avancement.md` dans la même action.

## Blockers

- Aucun.

## Décisions

- Limitation volontairement globale par IP, jamais par organisation : l'organisation n'est pas connue avant la recherche du PIN.
- Seuil conservé à 10 tentatives par fenêtre glissante de 15 minutes, conformément au ticket.
- Les tentatives réussies et échouées sont toutes comptées puisque le contrôle précède volontairement la résolution du PIN.
- Aucun nouveau stockage : la colonne nullable `portefeuille_id` reste à `null` pour le scope `verify_pin`.
- Aucun changement du mécanisme de session bénévole ni de la longueur des PIN.
- Aucun changement ni déploiement en production.
