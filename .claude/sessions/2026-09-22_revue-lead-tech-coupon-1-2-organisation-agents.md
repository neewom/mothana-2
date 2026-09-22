# Session 2026-09-22 — Revue lead tech Coupon 1/2, organisation à deux agents

Session côté Claude Code (lead tech), en parallèle des sessions Codex (dev) sur les cartes 1 et 2 de l'épique porte-monnaie événementiel. Journée à cheval sur plusieurs sujets : mise en place définitive du fonctionnement à deux agents, revue et merge de la carte 1, revue en cours de la carte 2 (encore ouverte).

## Réalisé

### Organisation à deux agents (Claude Code lead tech / Codex dev)
- `AGENTS.md` complété : section "Organisation à deux agents" (rôles, ticket de dev, isolation par worktree), puis deux ajustements après retour d'expérience réel :
  - **Codex ne continue pas de lui-même après sa routine de démarrage** (confirmé sur la carte 1) : le message de démarrage doit toujours inclure "enchaîne sans t'arrêter après la routine de démarrage".
  - **PR draft ouverte dès le début du dev**, à partir de la carte 3 seulement (pas rétroactif) : permet au lead tech de s'abonner (`subscribe_pr_activity`) dès l'ouverture plutôt que d'attendre/sonder GitHub. Décidé après avoir écarté n8n/Zapier (pas de moyen de déclencher une session Claude Code depuis l'extérieur) et des bridges Claude↔Codex tiers (`squad`, `codex-claude-bridge`, etc. — projets communautaires non officiels, écartés pour l'instant vu l'accès prod que ce repo implique).
- **Graphify installé** (`uv tool install graphifyy[sql]`) pour Claude Code et Codex — utilisé activement pendant les revues (`graphify affected`, vérifications d'impact).
- **Worktrees** : `../mothana-2-codex` (Codex, port 5174) et `../mothana-2-review` (moi, port 5175) créés et utilisés en conditions réelles pour la première fois.
- Session Claude "Dispatch background conversation" repérée dans `ListAgents` (le compte n'en avait pas connaissance) — message envoyé pour comprendre son rôle, aucune réponse reçue à ce stade. Pas creusé plus loin (secondaire).

### Coupon 1 — Fondations (PR #190)
- Revue lead tech complète : vérifications indépendantes sur staging (audit RLS, droits EXECUTE, `tsc -b`, tests), aucun bloquant.
- Mergée par l'utilisateur, routine post-merge faite (Trello Done, journal, `dev` synchronisé).

### Coupon 2 — Admin gestion des événements (PR #191, **toujours ouverte**)
- Revue lead tech de la version de base : aucun bloquant (nouvelle dépendance `qrcode`, RPC `creer_credit_manuel`, pages/modales admin).
- **Discussion de fond sur le rattachement activité ↔ événement**, en 3 itérations successives avec l'utilisateur (chacune postée en commentaire Trello sur la carte 2, chacune revue après le push de Codex) :
  1. D'abord un lien optionnel simple (`evenements.activite_id`) — l'utilisateur a précisé que `activites` sert aussi aux campagnes courrier (vérifié dans le code : `campagnes_courrier.activite_id` est `NOT NULL`), donc plus généraliste qu'un simple tag de dons.
  2. Puis une création automatique si aucune activité existante n'est choisie (nom = nom événement, date_debut = date_fin = date_evenement) — implémentée par Codex avec un bon réflexe non demandé (rollback compensatoire si l'enregistrement de l'événement échoue après création de l'activité).
  3. Puis un champ unique de recherche + création (comme les listes de diffusion adhérents) au lieu d'un sélecteur séparé — implémenté en étendant `ActiviteAutocomplete` avec un mode `allowCreate` opt-in (confirmé sans impact sur `DonModal.tsx`, qui partage ce composant).
- **Dernier complément envoyé, pas encore confirmé par Codex** : fusionner "Nom" et "Activité" en un seul champ visible à l'écran (au lieu de deux champs synchronisés) — le champ Nom sert directement à retrouver/créer l'activité. Complément posté en commentaire Trello, message de démarrage donné à l'utilisateur pour Codex.

### Ajustement du process de revue (après retour utilisateur sur le coût des allers-retours)
- Constat partagé avec l'utilisateur : les allers-retours à 4 (Codex → Claude Code → utilisateur → Claude Code → Codex) sur les 3 itérations UX de la carte 2 (rattachement activité) rallongeaient le cycle sans ajouter de sécurité — chaque itération était revue intégralement par le lead tech alors qu'il s'agissait de pur fonctionnel/UX.
- `AGENTS.md` mis à jour (commit `6ca68cc`) : nouvelle sous-section "Boucle d'itération fonctionnelle/UX". Tant que la PR reste en draft, l'utilisateur itère en direct avec le dev (testé sur son port dédié) sans repasser par le lead tech à chaque push ; la revue lead tech complète n'a lieu qu'une seule fois, au passage « ready for review ». Une remontée explicite du dev sur un point d'architecture/sécurité/données reste traitée au fil de l'eau, mais ciblée sur ce point précis.
- **Rodé en conditions réelles dans la foulée sur la carte 2** : l'utilisateur est allé directement itérer avec Codex (plage de dates, refonte visuelle de la liste, alignement CTA — 3 commits `c7907b1`/`1d6ed15`/`6c75faf`), sans repasser par moi entre chaque push. Revue lead tech faite une seule fois sur l'ensemble une fois l'itération terminée.

### Coupon 2 — clôture (PR #191 mergée)
- Revue lead tech du dernier lot de changements (nouveau flux ci-dessus) : aucun bloquant. Vérifications : `tsc -b`, 18 tests Vitest, lint ciblé, migration `evenements_date_fin.sql` (colonne obligatoire + backfill, contrainte `date_fin >= date_evenement`, `get_evenement_public` recréée avec le même schéma de droits `revoke`/`grant`), filtrage des suggestions d'activités aux futures datées vérifié sans casser le lien existant en édition. Point d'attention vérifié avant de conclure : la refonte de la liste en cartes (`<ul>/<li>`, liseré `border-l-stamp`) reprend exactement le pattern déjà en production sur `ActivitesPage.tsx` — pas une nouvelle convention improvisée malgré la formulation de DESIGN.md sur les tableaux (qui vise la bascule table→cartes en CSS responsive, pas une refonte de composant assumée sur le modèle d'une page sœur). Une observation mineure non bloquante postée (attribut `min` HTML sur la date de fin, backé par la validation JS déjà en place).
- Confirmée mergée par l'utilisateur. Routine post-merge faite : `dev` synchronisée, Todo Trello vérifié bidirectionnellement (rien à en retirer, deux nouvelles cartes Backlog repérées — voir ci-dessous), carte 2 déplacée de la liste "Coupon" vers "Done", entrée journal ajoutée dans la même respiration (`docs/journal-avancement.md`, commit `314359d`), serveur du worktree de revue (port 5175, PID 30725) arrêté par PID exact.

## Reste à faire
- Deux nouvelles cartes repérées en Backlog pendant la vérification post-merge, pas encore cadrées ni signalées à l'utilisateur en détail : "Landing page" ([Trello](https://trello.com/c/472Mp1PN)) et "Activités : tampons et organisation" ([Trello](https://trello.com/c/PwT83I8V)) — à proposer de cadrer à la prochaine occasion.
- Cadrage du ticket de la carte 3 de l'épique Coupon (spike temps réel) — c'est elle qui doit servir de premier vrai test de la boucle draft/ready-for-review formalisée aujourd'hui (la carte 2 l'a testée après coup, hors flux draft puisqu'elle avait démarré avant la règle).
- Carte Backlog "Audit des droits EXECUTE des RPC existantes" ([Trello](https://trello.com/c/zb20DQpc)) toujours non cadrée, pas urgente.

## Blockers
Aucun.

## Décisions
- Le champ Activité de la carte 2 devient un seul champ fusionné avec Nom (pas deux champs synchronisés) — simplification demandée explicitement par l'utilisateur après test réel sur mobile, au prix de ne plus pouvoir donner à un événement un nom différent de son activité liée (accepté, ajustable plus tard si besoin réel).
- Pas d'installation de bridge Claude↔Codex tiers ni de canal Slack/Discord commun pour l'instant — recherché sérieusement (Claude Code Channels officiel, `squad`/`codex-claude-bridge` communautaires), écarté pour l'instant vu le niveau d'accès (prod Supabase) que ça donnerait à du code non audité.
- Règle "PR draft dès le début" explicitement non rétroactive — cartes 1 et 2 restent sur l'ancien flux (PR à la fin), la nouvelle règle s'applique à partir de la carte 3.
- Nouvelle règle de revue (2026-09-22) : itération fonctionnelle/UX en direct utilisateur ↔ dev pendant que la PR est en draft ; revue lead tech complète une seule fois, au passage « ready for review ». Si la revue lead tech déclenche un nouvel ajustement fonctionnel, la PR peut repasser en draft pour un nouveau tour direct plutôt que de reboucler par le lead tech à chaque micro-ajustement.

## Suite Codex — Coupon 3, prototype de transport (PR #192 draft)

### Réalisé
- Go explicite reçu pour https://trello.com/c/RSgVypMH. Ticket dev lu ; aucune PR ouverte au départ. Branche `codex/coupon-3-spike-temps-reel` créée depuis `origin/dev` (`56b901b`), PR draft #192 ouverte immédiatement, commentaire de démarrage Trello publié.
- Transport réutilisable avec Broadcast comme signal vide, relecture serveur, polling seul/repli, réconciliation 5 s, backoff, timeout, suspension/reprise et déduplication par révision.
- Banc synthétique `/coupon-spike.html`, capacités vendeur/acheteur distinctes et expirant en 2 h, demandes de 90 s, export diagnostic sans secrets. Aucun accès aux tables financières. Build opt-in staging uniquement.
- Table/RPC techniques dans `supabase/spikes/` (hors migrations produit), appliquées/rejouées sur staging après snapshot `/tmp/coupon3-before.sql`. Tests SQL transactionnels passés. Edge Function déployée sur `cxngcmvxktddhyxboyyx`, flag serveur `COUPON_SPIKE_ENABLED=true` ; production inchangée.
- Vérifications : `tsc -b`, 26 tests Vitest, lint ciblé, `deno check`, builds normal/opt-in. Tests réseau staging sur Mac : 5 demandes + décisions par mode, mauvais secret/rôles/création anonyme refusés et première décision conservée.
- Mesures Mac sauvegardées dans `docs/spikes/coupon-3-mesures-mac.json` ; demande Broadcast médiane 666 ms, décision 609 ms ; polling 1255/1253 ms. Ce ne sont PAS des mesures téléphones et la phase du polling démarre à l'action.
- Interface observée sur deux onglets : rôles distincts, demande reçue, boutons acheteur, décision envoyée. Pas de campagne mobile réalisée. Protocole, limites et installation dans `docs/spikes/coupon-3-transport.md`.
- Quota Pro documenté (500 avec spend cap / 10 000 sans) remonté au lead via commentaire PR ; quota réel et affluence encore inconnus.

### Reste à faire
- Mise à disposition HTTPS du banc avec variables staging explicites (le domaine recette suit `dev`, ne pas merger ou changer l'alias sans autorisation).
- Mesures sur 2 vrais téléphones : réseaux mobiles, coupures, verrouillage/arrière-plan et reprise. Le choix reste provisoire jusque-là.
- Validation fonctionnelle avec utilisateur puis passage ready for review, revue lead tech, merge seulement sur autorisation.
- Désactiver `COUPON_SPIKE_ENABLED` après la campagne. Carte reste dans Coupon, pas en Done.

### Blockers
- Pas d'accès aux deux téléphones physiques ; critères d'acceptation empiriques non encore satisfaits.
- Le banc n'est pas publié sur `test.samakan.fr` (PR non mergée, build opt-in requis).

### Décisions
- Candidat provisoire Broadcast + relecture serveur/polling de secours ; aucun payload Broadcast n'autorise une opération.
- Le prototype ne reproduit pas le modèle financier : intégration des véritables secrets/RPC/flag/gel/clôture à faire en cartes 4/5.
- PR conservée en draft, aucune affirmation de validation mobile ni de sujet terminé.
