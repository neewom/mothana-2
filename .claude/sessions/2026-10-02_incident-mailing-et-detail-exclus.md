# Incident mailing (email invalide) + détail nominatif des exclus

## Réalisé

- **Incident prod** (2026-10-01) : envoi de campagne mailing échouant intégralement pour « Wat Vélouvanaram - Bussy Saint Georges » (341 destinataires). Diagnostic par lecture prod en lecture seule (mode auto désactivé explicitement pour ce type d'accès) : un seul adhérent (Thavisay CHANTHABOUN) avait un `courriel` mal formé (`"chanthaboun Thavisay@gmai"`) — Brevo rejette l'intégralité du batch `messageVersions` dès qu'une seule adresse est invalide.
- **Correctif** (PR #202 sur `dev`) : validation de format d'email dans `send-mailing-brevo` (Edge Function) et dans l'aperçu frontend (`CampagneMailingPage.tsx`) — une adresse invalide est désormais exclue et comptée au lieu de faire échouer tout l'envoi ; affichage du détail de l'erreur Brevo (`json.detail`), jusque-là masqué.
- **Promotion accélérée** (PR #203, cherry-pick vers `main`) : `dev` portant aussi tout l'épique Coupon pas encore prêt pour la prod, le correctif a été isolé plutôt que promu via un `dev → main` complet. Edge Function déployée explicitement sur staging et prod. `main` remergé dans `dev` ensuite.
- Donnée fautive corrigée en prod par l'utilisateur lui-même ; campagne originale relancée avec succès avant même la fin du correctif de code (la donnée seule suffisait à débloquer ce cas précis).
- **Nouvelle carte Trello cadrée** ([lien](https://trello.com/c/EofwzM1G)) : détail nominatif des exclus (email manquant / email invalide / opt-out), scope élargi en cours de cadrage sur retour utilisateur (distinction email manquant vs invalide).
- **Dev par Codex** (PR #204) : module `classifyMailingRecipients` (classification exhaustive et mutuellement exclusive), 4 compteurs avec CTA "Voir la liste" → modale nominative par catégorie. Itération UX en direct avec l'utilisateur après une première revue lead tech (suggestion non bloquante sur un `break-all` mal choisi) : colonne Email retirée pour "email manquant", `break-words` substitué, chevron de ligne ajouté (cohérent avec `DESIGN.md` § Tables).
- **Revue lead tech finale** : `tsc -b`, lint, 55 tests Vitest, `graphify affected` verts ; testé en conditions réelles sur `Association Démo Staging` (4 catégories représentées simultanément, desktop + mobile 375px). Aucun bloquant. PR #204 mergée sur `dev`.
- **Promotion PR #204** (PR #205, cherry-pick vers `main`) : fonctionnalité indépendante du Coupon, promue isolément plutôt que d'attendre une promotion `dev → main` complète. `main` remergé dans `dev` (petit conflit add/add sur les fichiers de session Codex, résolu en gardant la version complète de `dev`).
- Journal d'avancement à jour (2 nouvelles entrées), carte Trello déplacée en Done.

## Reste à faire

- Rien en cours sur ce sujet.
- Backlog inchangé par ailleurs : carte 6 (prestataire de paiement réel) toujours en attente côté utilisateur, bloque la promotion de tout l'épique Coupon (PR #190 à #201, toujours uniquement en recette).

## Blockers

- Aucun.

## Décisions

- **Promotion isolée par cherry-pick** plutôt que `dev → main` complet, dès qu'un correctif/une feature n'a aucune dépendance avec l'épique Coupon actuellement retenu en recette — pattern réutilisé deux fois dans cette session (PR #203, PR #205), à reproduire tant que `dev` reste très en avance sur `main` à cause du Coupon.
- Après chaque promotion par cherry-pick, toujours remerger `main` dans `dev` immédiatement (règle déjà documentée dans `docs/environnement-recette.md` § 5, "cas rare : hotfix direct sur main") pour éviter toute régression à la prochaine promotion complète.
