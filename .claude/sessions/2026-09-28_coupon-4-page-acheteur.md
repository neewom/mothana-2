# Coupon 4 — page acheteur en lecture seule

## Réalisé

- Branche `codex/coupon-4-page-acheteur` créée depuis `origin/dev` au commit demandé `9c99ad4`, PR #193 ouverte immédiatement en draft vers `dev`, puis commentaire de démarrage posté sur la carte Trello.
- Route publique `/p#<secret>` implémentée : identité de l'organisation et de l'événement, solde, QR du code public, historique et état événement clos, avec gestion distincte des erreurs invalides/révoquées, réseau, indisponibilité et limite de débit.
- Secret brut lu uniquement depuis le fragment, conservé dans l'URL pour que le lien reste copiable comme prévu par le ticket, puis haché en SHA-256 avant tout appel réseau. Le fragment n'est transmis ni au serveur ni dans le `Referer`. Le QR et le PDF n'embarquent que le code public.
- Migration `portefeuille_acheteur_lecture.sql` ajoutée : résolution par hash, agrégat `service_role` avec contrôle du feature flag, limitation persistante par IP hachée et portefeuille, droits et RLS resserrés.
- Deux Edge Functions ajoutées : lecture du portefeuille et génération du PDF QR via Gotenberg. Secret `PORTEFEUILLE_RATE_LIMIT_KEY` configuré sur staging.
- Snapshot SQL staging pris avant migration, migration appliquée et rejouée, tests SQL transactionnels passés. Les deux Edge Functions ont été déployées sur staging.
- Fixture synthétique de démonstration créée sur staging avec un solde et trois mouvements. Lecture HTTP réelle et génération d'un PDF A4 valide vérifiées.
- Parcours navigateur vérifié en desktop 1440 px et mobile 390 px. Les trois corrections de la revue visuelle ont été intégrées ; verdict final `ship`.
- `npm run build`, `npm test` (24 tests), lint ciblé, `deno check`, tests SQL, `git diff --check` et mise à jour Graphify validés.
- PR #192 laissée intacte, conformément au ticket.
- Blocage de consultation depuis un téléphone via l'IP Tailscale levé : la page HTTP n'est pas un contexte sécurisé, donc Web Crypto n'exposait pas `crypto.subtle` et le hash échouait avant l'appel Supabase. Le calcul SHA-256 utilise maintenant `@noble/hashes`, y compris sans Web Crypto ; test de non-régression ajouté. CORS avait été contrôlé séparément et répondait correctement.
- Second cas mobile levé : le nettoyage du fragment rendait impossible la copie du lien depuis la barre d'adresse du navigateur ChatGPT, et rouvrir un lien dans le même onglet ne réinitialisait pas le composant. Le fragment reste désormais visible et copiable conformément au ticket ; un listener `hashchange` recharge aussi tout nouveau secret dans le même onglet. Vérifié sur l'origine HTTP Tailscale, y compris après rechargement.
- Cas de copie directe depuis le texte du fil traité : les caractères invisibles de mise en forme susceptibles d'être insérés au milieu d'une longue URL (`soft hyphen`, espaces sans largeur, `word joiner`, BOM) sont retirés du fragment avant validation et hash. Test dédié avec deux caractères invisibles encodés au milieu du secret.
- Validation fonctionnelle utilisateur reçue le 2026-09-28 après test dans le navigateur habituel via Tailscale. PR #193 prête pour la revue complète du lead tech.

## Reste à faire

- Laisser le lead tech effectuer l'unique revue complète de la PR #193 et intégrer ses éventuels retours.
- Après merge seulement, déplacer la carte Trello en Done et mettre à jour le journal dans la même action.

## Blockers

- Aucun blocker technique. Les mesures à deux téléphones de la PR #192 restent un jalon pré-production indépendant ; elles ne bloquent pas la page acheteur lecture seule de cette carte.

## Décisions

- Le navigateur ne transmet jamais le secret brut : il reste dans le fragment copiable de l'URL et seul son SHA-256 est envoyé aux Edge Functions.
- Le calcul SHA-256 ne dépend pas de l'API Web Crypto, afin de fonctionner aussi sur l'origine HTTP Tailscale utilisée pour les tests mobiles.
- Les lectures publiques passent par des Edge Functions et une RPC agrégée inaccessible à `anon`/`authenticated` ; aucune table métier n'est ouverte publiquement.
- La limitation de débit utilise une empreinte HMAC de l'IP, jamais l'IP brute, et des seuils distincts lecture/PDF.
- Le QR et le PDF utilisent uniquement `code_public`. L'état d'une demande en attente est fourni par le backend mais n'est pas affiché dans cette phase lecture seule.
- Aucun déploiement ni changement de données en production.
