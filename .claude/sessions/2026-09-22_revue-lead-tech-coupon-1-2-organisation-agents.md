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

### Cadrage carte 3 — Spike temps réel (Coupon)
- Ticket dev rédigé et posté sur la carte ([Trello](https://trello.com/c/RSgVypMH)), label "cadré" appliqué : objectif (choisir Broadcast vs polling pour le transport vendeur↔acheteur, validé sur 2 vrais téléphones), zones de code, contrainte trouvée en amont (`demandes_paiement`/`portefeuilles` en RLS `authenticated`-only, donc Postgres Changes inutilisable pour l'acheteur anonyme → pousse vers Broadcast canal non devinable ou polling via Edge Function).
- Message de démarrage donné à l'utilisateur pour Codex. Premier essai avec la même session Codex que la carte 2 : état de reprise obsolète (Coupon 2 annoncée "toujours en PR #191, non mergée" alors que mergée depuis un moment) — cause probable : mémoire de conversation de la session plutôt que relecture des fichiers à jour. Résolu en démarrant une nouvelle session Codex avec le message de démarrage complet.
- PR #192 ouverte en draft (`codex/coupon-3-spike-temps-reel`) dès le départ, conforme à la nouvelle règle à partir de cette carte.

### Codex à court de tokens — ajustement du process
- Après la seule routine de démarrage de la carte 3, Codex a manqué de tokens (un seul commit doc stub sur la PR #192). Décision utilisateur : pas de handoff automatique, on attend son retour. `AGENTS.md` mis à jour (commit `1f7d4dd`) : le handoff (l'autre agent reprend les deux rôles) reste possible mais seulement sur demande explicite au moment venu, jamais présumé.
- Outils d'abonnement PR (`subscribe_pr_activity`) confirmés indisponibles dans cette session (CLI locale, pas l'environnement cloud intégré GitHub) — recherché via `ToolSearch`, aucun résultat. Alternative `Monitor`+polling `gh pr view` proposée mais écartée par l'utilisateur (expire au bout de 30 min, préfère juste me prévenir directement).

### Audit des droits EXECUTE des RPC existantes (fait seul pendant l'attente de Codex)
- Carte Backlog ([Trello](https://trello.com/c/zb20DQpc)) traitée directement, sans dev : requête sur `pg_proc`/staging, 22 fonctions `security definer`, 9 exécutables par `anon` sans jamais l'être légitimement. Trouvaille sérieuse : `next_numero_recu`, `next_adherent_id_externe`, `next_participant_id_externe` sans aucune garde interne — un anonyme pouvait faire avancer la numérotation légale des reçus fiscaux ou les séquences id_externe de n'importe quelle organisation. Migration `rpc_execute_grants_hardening.sql` (commit `cbbcf02`), grants resserrés vérifiés via grep des callers réels en frontend/Edge Functions, appliquée et vérifiée sur staging. Carte déplacée en Done, journal à jour.
- Effet de bord élucidé plus tard dans la session : une fonction/table `coupon_spike_step`/`coupon_transport_spike` repérée sans trace dans les migrations — en fait le banc de spike de la carte 3 (`supabase/spikes/coupon_transport.sql`, volontairement hors du dossier `migrations/`), pas une dérive de schéma.

### Correctifs Activités (faits seul, sur retour utilisateur direct, pendant l'attente de Codex)
- 3 commits directement sur `dev` (`b317b86`, `6e5c3d5`, `8a2a778`) : tampon affichant désormais la date pour les activités "à venir" (plus de cercle pointillé vide), colonne "actives" scindée en "À venir / en cours" vs "Récurrentes" (sans date) ; ligne cliquable ouvrant la modale (chevron `›`, CTA Modifier/Supprimer retirés de la ligne, pattern repris d'AdherentsPage/AdherentModal) ; chevron mobile mal aligné corrigé (résidu `flex-col` inutile) et Supprimer devenu une icône poubelle ancrée en haut à droite de la modale plutôt qu'un bouton texte. Vérifié à chaque étape sur le worktree de revue (port 5175, relancé pour l'occasion). Carte Trello déplacée en Done, journal à jour.
- **Écart de process repéré par l'utilisateur** : ces 3 commits (et la migration d'audit EXECUTE) ont été poussés directement sur `dev` sans branche ni PR — extrapolation à tort d'une exception à partir des commits docs/journal (qui eux ne touchent pas de code). `AGENTS.md` corrigé (commit `f499a36`) : la règle "pousser + ouvrir une PR" s'applique sans exception, y compris à un correctif solo du lead tech sans revue indépendante possible — la PR reste la trace et le point de rollback. Pas de retouche rétroactive sur les commits déjà poussés (décision explicite de l'utilisateur), la règle s'applique à partir de maintenant.
- Découverte annexe en testant : l'instance permanente (port 5173) était cassée (500/écran blanc sur toutes les routes) depuis le merge de Coupon 2 (~3h), faute de `npm install` dans le checkout principal après l'ajout de la dépendance `qrcode`. `npm install` fait, mais impossible de recharger le process Vite déjà lancé sans le redémarrer — interdit à un agent. Signalé à l'utilisateur, qui a lui-même éliminé/géré cette instance et bascule désormais sur les worktrees (Codex 5174, revue 5175) pour ses vérifications.

### Carte 3 — mesures Mac, spike livré mais pas fini
- Codex a poussé un prototype complet (`a15531b`) : abstraction de transport réutilisable (`paymentTransport.ts`), Edge Function de banc dédiée verrouillée sur staging, tables/tests SQL de spike, doc de décision. Décision provisoire : Broadcast (signal vide, canal non devinable) + relecture serveur avec repli polling, favorisé par les mesures Mac mais **critère d'acceptation du ticket (2 vrais téléphones) pas encore rempli** — doc explicite "aucun choix final n'est acté", PR volontairement gardée en draft par Codex lui-même.
- Remontée explicite de Codex sur la PR (dimensionnement quota Realtime) traitée au fil de l'eau (exception prévue par le process) : pas d'objection sur l'archi sécurité du banc ; sur les quotas, prod documentée Supabase Pro mais deux inconnues hors de ma portée (spend cap actif ou non, affluence cible par événement) laissées à l'utilisateur.
- Utilisateur indisponible pour le test à 2 téléphones dans l'immédiat : **spike mis en pause**, commentaire posté sur la carte Trello pour la continuité.

## Reste à faire
- Reprendre la carte 3 dès que le test à 2 vrais téléphones est possible côté utilisateur (avec Codex, en direct, PR #192 reste en draft jusque-là).
- Répondre aux deux inconnues de dimensionnement Realtime avant la décision finale carte 3 : spend cap Supabase prod actif ou non (dashboard), affluence cible par événement (produit).
- Une nouvelle carte Backlog est apparue en cours de session, pas encore vue en détail : "Landing page" ([Trello](https://trello.com/c/472Mp1PN)) — à cadrer à la prochaine occasion. ("Activités : tampons et organisation" traitée cette session, voir ci-dessus.)
- Instance permanente (port 5173) à relancer par l'utilisateur quand il le souhaite (plus d'action agent possible dessus) ; `npm install` déjà fait dans le checkout principal.

## Blockers
- Carte 3 (spike temps réel) : test à 2 vrais téléphones pas réalisable dans l'immédiat côté utilisateur.
- Codex à court de tokens depuis le début de la carte 3 — retour non confirmé à la fin de cette session.

## Décisions
- Le champ Activité de la carte 2 devient un seul champ fusionné avec Nom (pas deux champs synchronisés) — simplification demandée explicitement par l'utilisateur après test réel sur mobile, au prix de ne plus pouvoir donner à un événement un nom différent de son activité liée (accepté, ajustable plus tard si besoin réel).
- Pas d'installation de bridge Claude↔Codex tiers ni de canal Slack/Discord commun pour l'instant — recherché sérieusement (Claude Code Channels officiel, `squad`/`codex-claude-bridge` communautaires), écarté pour l'instant vu le niveau d'accès (prod Supabase) que ça donnerait à du code non audité.
- Règle "PR draft dès le début" explicitement non rétroactive — cartes 1 et 2 restent sur l'ancien flux (PR à la fin), la nouvelle règle s'applique à partir de la carte 3.
- Nouvelle règle de revue (2026-09-22) : itération fonctionnelle/UX en direct utilisateur ↔ dev pendant que la PR est en draft ; revue lead tech complète une seule fois, au passage « ready for review ». Si la revue lead tech déclenche un nouvel ajustement fonctionnel, la PR peut repasser en draft pour un nouveau tour direct plutôt que de reboucler par le lead tech à chaque micro-ajustement.
- Pas de handoff automatique entre agents sur quota épuisé — attente par défaut, handoff seulement sur demande explicite de l'utilisateur au moment venu (décidé après le cas réel de la carte 3).
- Règle "pousser + ouvrir une PR" sans exception, y compris pour un correctif solo du lead tech — pas de rétroactivité sur les commits déjà poussés directement sur `dev` avant cette clarification.
