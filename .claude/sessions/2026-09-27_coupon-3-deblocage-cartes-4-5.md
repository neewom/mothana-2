# Session 2026-09-27 — Coupon 3 : déblocage des cartes 4/5

Reprise sur le blocage matériel de la carte 3 (spike temps réel) identifié en fin de session du 2026-09-22 : l'utilisateur n'a pas 2 vrais téléphones sous la main pour le protocole de test.

## Réalisé

### Clarification du blocage matériel
- L'utilisateur a un smartphone déjà dans de bonnes conditions (Tailscale configuré vers le réseau du Mac mini, worktrees accessibles). Le blocage concret : un 2e téléphone emprunté nécessiterait d'y installer Tailscale et de le connecter au réseau de l'utilisateur — jugé pas souhaitable sur un appareil emprunté. Le "3e téléphone" évoqué initialement n'est pas dans le protocole officiel (2 téléphones seulement, cf. carte Trello RSgVypMH) : il servait à filmer les deux premiers — besoin résolu directement, n'importe quel appareil avec caméra suffit (pas d'install requise).
- Piste retenue pour le 2e téléphone : tunnel HTTPS éphémère (`cloudflared tunnel --url http://localhost:5174`, sans compte requis) vers le worktree Codex, plutôt qu'installer Tailscale sur un appareil emprunté. Tentative d'installation via `brew install cloudflared` **bloquée par le mode auto** (catégorie "External Ingress Tunnel") — nécessite une validation manuelle explicite de l'utilisateur au moment de lancer le test, pas quelque chose qu'un agent peut faire seul.

### Décision : le test 2 téléphones ne bloque plus les cartes 4/5
- Question posée par l'utilisateur : est-ce que ce test est essentiel/déterminant pour la suite ? Réponse apportée et validée ("Go") :
  - Pas déterminant pour **démarrer le dev des cartes 4/5** : l'abstraction `paymentTransport.ts` (livrée par le spike de Codex, commit `a15531b` sur la branche `codex/coupon-3-spike-temps-reel`) est agnostique du mode retenu (Broadcast vs polling), et la décision provisoire est déjà étayée par les mesures Mac (écart net : 666 ms vs 1255 ms médiane pour la boucle demande/décision).
  - Déterminant en revanche **avant la mise en prod du module** : seul un vrai téléphone peut révéler le comportement écran verrouillé / coupure réseau mobile / reconnexion — le genre de défaillance qui, avec de l'argent réel en jeu, doit être vérifié avant que de vrais utilisateurs paient dessus. Le design prévoit déjà une reconciliation au retour au premier plan quel que soit le mode (pas un trou d'architecture, mais pas vérifié en conditions réelles pour autant).
- **Déblocage acté** : la carte 3 ne bloque plus formellement le démarrage des cartes 4/5. Le test à 2 téléphones devient un jalon avant mise en prod du module, pas avant de continuer à coder.
- Mis à jour : description de la carte Trello 3 (RSgVypMH, note "Mise à jour 2026-09-27 — déblocage cartes 4/5"), backlog condensé `AGENTS.md` (item 7 de l'État d'avancement).

### Carte 4 — cadrage (2026-09-28)
- Investigation code avant cadrage : schéma et RPC déjà complets côté carte 1 (`resoudre_secret_portefeuille`, `decider_demande_paiement`), pattern QR déjà écrit dans `EvenementAfficheModal.tsx` (`qrcode`, message d'attente explicite "sera livrée avec la carte Coupon 4"), pattern Gotenberg réutilisable de `generate-recu/index.ts`, pattern de route publique hors shell authentifié (`/adhesion/:slug`). Deux manques identifiés : aucune RPC de lecture agrégée du portefeuille par secret (à créer), et **aucune infra de rate limiting dans le projet** (vérifié par grep, `verify-pin` n'en a pas non plus) — à concevoir dans cette carte, réutilisable en carte 9.
- Cadrage présenté dans le chat puis validé par l'utilisateur ("Go") avant écriture sur Trello (routine habituelle respectée).
- Carte 4 mise à jour sur Trello (https://trello.com/c/D9PPs5h3) : ticket dev complet (objectif, périmètre inclus/exclu, zones de code, critères d'acceptation, ce que le dev tranche seul / remonte), étiquette "cadré" appliquée. Périmètre confirmé = phase (a) lecture seule uniquement (QR, solde, historique, PDF) ; la phase (b) temps réel reste hors carte, à ajouter une fois la carte 3 mergée — cohérent avec le découpage déjà acté dans l'épique, pas un nouveau choix.
- Question de l'utilisateur : merger la PR #192 (spike carte 3) pour enchaîner directement ? Réponse : non — la carte 4 (phase a) n'a pas besoin de `paymentTransport.ts` (qui ne sert qu'à la phase b, hors périmètre), et merger une PR encore en draft, non validée sur téléphones et jamais passée en revue lead tech romprait le processus posé par le spike lui-même. Décision : #192 reste intouchée, en draft. Documenté explicitement dans le ticket dev de la carte 4 (section contraintes) pour que Codex le voie au démarrage sans avoir à redemander.

## Reste à faire
- Confirmation explicite de l'utilisateur à redemander avant de démarrer le dev de la carte 4 (cadrage fait, dev pas encore lancé cette session).
- Test à 2 vrais téléphones (carte 3) à reprendre avant mise en prod du module Coupon : préparer le tunnel `cloudflared` le jour venu (installation + lancement à valider manuellement par l'utilisateur, bloqué par le mode auto).
- PR #192 (`codex/coupon-3-spike-temps-reel`) reste en draft, carte 3 reste hors Done tant que la preuve terrain n'existe pas (cf. doc `docs/spikes/coupon-3-transport.md` sur cette branche, non mergée).

## Blockers
- Aucun blocker actif sur la suite immédiate (cartes 4/5 débloquées). Le test 2 téléphones reste en attente d'opportunité (emprunt + tunnel), mais n'empêche plus d'avancer.

## Décisions
- Le test à 2 vrais téléphones (carte 3) passe de "bloque le démarrage des cartes 4/5" à "jalon avant mise en prod du module" — décision explicite de l'utilisateur (2026-09-27), après avoir pesé le fait que l'abstraction de transport est déjà réutilisable et que la décision provisoire est raisonnablement étayée par les mesures Mac.
- Pour un futur test terrain avec un téléphone emprunté : préférer un tunnel HTTPS éphémère (cloudflared, sans compte) plutôt que d'installer Tailscale sur l'appareil de quelqu'un d'autre.
