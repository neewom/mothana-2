# 2026-10-17 — Session dev (Claude Code dev) : campagne courrier, exclus pour adresse incomplète

Go utilisateur transmis par le lead tech pour la carte « [S] Campagne courrier : voir et corriger les adhérents à l'adresse incomplète » (https://trello.com/c/brVWmKnB) — branche `feat/courrier-exclus-adresse` depuis `origin/dev` (4f953f5), PR #259 → `dev`, serveur 5174.

## Réalisé
- `lib/adresseCourrier.ts` (testé) : champs manquants (Adresse, Code postal, Ville ; règle `trim()` inchangée, pays non exigé) et libellé (« Adresse, Code postal manquants »).
- `CampagneCourrierPage` : « N exclus (adresse incomplète) » devient un lien vers la modale existante en mode « exclus » (titre « Adresse incomplète », colonne « À compléter ») ; clic → fiche (`handleApercuRowClick`), recomptage à l'enregistrement (inchangé). Une seule modale, deux modes (`apercuMode`). Listes triées par nom.
- Chargement via `fetchAllRows` (tri par id pour des pages stables) : plus de troncature à 1 000.
- Vérifié (Playwright, org démo) : actifs 30 + 1 exclu (« Import DS2 TEST » : Adresse, Code postal, Ville manquants) ; fiche complétée depuis la liste → 31 destinataires, plus d'exclu, présent dans « Voir la liste » ; « Tous les adhérents » : 33 + 1 exclu (archivé « Bounma Sengphachanh ») ; 375 px et super-admin « Consulter » OK.

## Signalé (hors périmètre)
- Même limite de 1 000 lignes dans `CampagneMailingPage.tsx` (~l. 404) et dans l'Edge Function `generate-campagne-courrier` (requête `adherents` non paginée, ~l. 226) : la planche serait tronquée au-delà de 1 000 adhérents (Wat : 493, non concerné).
- La fiche adhérent exige civilité et date de naissance : un adhérent importé sans ces champs ne peut être complété qu'en les renseignant aussi (comportement existant).

## Données de test modifiées sur staging (org démo)
- « Import DS2 TEST » : adresse « 10 rue du Test, 75011 Paris », civilité Monsieur, date de naissance 01/01/1980 renseignées pendant le test.

## Reste à faire
- Revue lead tech, test utilisateur, merge.

## Blockers
- Aucun.
