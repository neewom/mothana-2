# MVP Coupon — finalisation pour la démo du 2026-10-02

## Réalisé

- Cartes Coupon 12 (achat public simulé), 13 (accès vendeur distinct) et 11 (dashboard admin) cadrées et développées par Codex le jour même (urgence démo), revues et mergées par le lead tech (PR #197, #198, #199, #200 — détail complet dans `docs/journal-avancement.md`).
- Correctif de sécurité trouvé par Codex en développant la carte 13 (RPC `next_adherent_id_externe`/`next_participant_id_externe` sans garde d'organisation), arbitré et corrigé par le lead tech dans la même PR.
- Validation de bout en bout sur `test.samakan.fr` (domaine réel, pas localhost) : achat simulé → email → portefeuille → demande vendeur → acceptation temps réel acheteur → confirmation temps réel vendeur, soldes cohérents, zéro erreur.
- Décision utilisateur : `SIMULATION_PAIEMENT_ACTIVE` laissé actif en continu sur staging (pas seulement autour de la démo) jusqu'à ce que la carte 6 (vrai prestataire) soit attaquée — acceptable vu le flag `evenements` désactivé par défaut, limité à l'org démo, et double garde-fou serveur (whitelist de domaine indépendante du flag).
- Bug de débordement horizontal trouvé par l'utilisateur en testant sur iPhone 8 réel (page portefeuille acheteur) — reproduit sur Chromium et WebKit à 375px, corrigé (`break-all` sur le code public), PR #201 mergée.
- Journal d'avancement et backlog `AGENTS.md` à jour.

## Reste à faire

- Démo le 2026-10-02 : utiliser une vraie adresse email pendant la démo (pas un `test@...` factice, même si le bug correspondant — carte 12 — est corrigé, c'est toujours la meilleure pratique).
- Carte 6 (choix du prestataire de paiement réel) : toujours en attente côté utilisateur (confirmation Stripe, avis juridique). Bloque les cartes 7/8/9.
- Checklist de tests à rejouer sur test.samakan.fr (https://trello.com/c/En0Q5ofB) : bon moment pour la reprendre, la plupart des blocages qu'elle listait sont désormais levés par les cartes mergées aujourd'hui.
- Trois portefeuilles de test (emails de l'utilisateur via plus-addressing) restent actifs sur l'événement démo "Fête du Mékong" — laissés tels quels à la demande de l'utilisateur, sans gêne pour la démo.

## Blockers

- Aucun.

## Décisions

- `SIMULATION_PAIEMENT_ACTIVE` reste actif en continu sur staging (pas de toggle autour de chaque test/démo), décision explicite utilisateur, consignée dans `AGENTS.md` avec la condition à surveiller (ne pas activer `evenements` sur une organisation réelle tant que le switch reste ouvert).
- Pas de nettoyage des portefeuilles de test de l'utilisateur (journal des mouvements immuable de toute façon, pas de vraie suppression possible).
