# Coupon 4 — page acheteur en lecture seule

## Réalisé

- Branche `codex/coupon-4-page-acheteur` créée depuis `origin/dev` au commit demandé `9c99ad4`, PR #193 ouverte immédiatement en draft vers `dev`, puis commentaire de démarrage posté sur la carte Trello.
- Route publique `/p#<secret>` implémentée : identité de l'organisation et de l'événement, solde, QR du code public, historique et état événement clos, avec gestion distincte des erreurs invalides/révoquées, réseau, indisponibilité et limite de débit.
- Secret brut lu uniquement depuis le fragment, retiré immédiatement de l'URL avec `history.replaceState`, puis haché en SHA-256 avant tout appel réseau. Le QR et le PDF n'embarquent que le code public.
- Migration `portefeuille_acheteur_lecture.sql` ajoutée : résolution par hash, agrégat `service_role` avec contrôle du feature flag, limitation persistante par IP hachée et portefeuille, droits et RLS resserrés.
- Deux Edge Functions ajoutées : lecture du portefeuille et génération du PDF QR via Gotenberg. Secret `PORTEFEUILLE_RATE_LIMIT_KEY` configuré sur staging.
- Snapshot SQL staging pris avant migration, migration appliquée et rejouée, tests SQL transactionnels passés. Les deux Edge Functions ont été déployées sur staging.
- Fixture synthétique de démonstration créée sur staging avec un solde et trois mouvements. Lecture HTTP réelle et génération d'un PDF A4 valide vérifiées.
- Parcours navigateur vérifié en desktop 1440 px et mobile 390 px. Les trois corrections de la revue visuelle ont été intégrées ; verdict final `ship`.
- `npm run build`, `npm test` (22 tests), lint ciblé, `deno check`, tests SQL, `git diff --check` et mise à jour Graphify validés.
- PR #192 laissée intacte, conformément au ticket.

## Reste à faire

- Faire tester la PR #193 en draft par l'utilisateur sur le port 5174 et intégrer ses éventuels retours fonctionnels/UX.
- Après validation fonctionnelle explicite, passer la PR en « ready for review », commenter « prête pour review » et laisser le lead tech effectuer l'unique revue complète.
- Après merge seulement, déplacer la carte Trello en Done et mettre à jour le journal dans la même action.

## Blockers

- Aucun blocker technique. Les mesures à deux téléphones de la PR #192 restent un jalon pré-production indépendant ; elles ne bloquent pas la page acheteur lecture seule de cette carte.

## Décisions

- Le navigateur ne transmet jamais le secret brut : SHA-256 côté client, fragment supprimé avant le chargement asynchrone.
- Les lectures publiques passent par des Edge Functions et une RPC agrégée inaccessible à `anon`/`authenticated` ; aucune table métier n'est ouverte publiquement.
- La limitation de débit utilise une empreinte HMAC de l'IP, jamais l'IP brute, et des seuils distincts lecture/PDF.
- Le QR et le PDF utilisent uniquement `code_public`. L'état d'une demande en attente est fourni par le backend mais n'est pas affiché dans cette phase lecture seule.
- Aucun déploiement ni changement de données en production.
