# AGENTS.md — Mothana (Gestion des dons)

Contexte projet et règles de fonctionnement, lus par tout agent de code travaillant sur ce dépôt (Codex le lit nativement ; Claude Code l'importe via `@AGENTS.md` en tête de `CLAUDE.md`). Objectif : pouvoir reprendre le travail avec un autre agent sans perte de contexte (ex. quota d'usage épuisé sur l'un d'eux). Ce fichier contient tout ce qui est portable ; `CLAUDE.md` ne garde que ce qui est spécifique à Claude Code.

---

## Continuité entre sessions

### En début de session
- Chercher automatiquement le fichier de la dernière session dans `.claude/sessions/`
- Identifier où on s'est arrêté et les blockers en cours
- Résumer en 3 lignes avant de commencer
- Vérifier la liste "Backlog" du board Trello "Mothana" (voir section Trello ci-dessous) — l'utilisateur y note à la volée ses demandes d'évolution, pas encore cadrées. En cas de nouveauté (carte non présente dans le backlog ci-dessous), proposer de la cadrer pour l'inscrire dans "État d'avancement"
- Quand un sujet est cadré (nouveauté détectée ou sujet déjà connu qu'on approfondit), alimenter la carte Trello correspondante avec le détail du cadrage (description), réécrire le titre si le libellé d'origine est devenu imprécis, appliquer l'étiquette verte "cadré", et **déplacer la carte de "Backlog" vers "Todo"**
- À ce même moment, reclasser les cartes de "Todo" (et des listes "Batch — ...") par priorité/complexité : un sujet peu complexe peut remonter en haut de la liste, un sujet complexe redescend en général plus bas — sauf s'il est aussi sensible ou prioritaire, auquel cas il remonte malgré sa complexité

### En fin de session
- Sauvegarder un résumé dans `.claude/sessions/[date]_[sujet].md`
- Inclure : Réalisé, Reste à faire, Blockers, Décisions
- Si un fichier existe déjà pour aujourd'hui, le compléter plutôt que le remplacer
- Format du nom de fichier : `YYYY-MM-DD_sujet-en-kebab-case.md`
- **Déplacement Trello Done ↔ entrée `docs/journal-avancement.md` : action indissociable, jamais l'une sans l'autre.** Dès qu'une carte passe en Done (fin de sujet ou merge de PR), ajouter dans la même respiration l'entrée correspondante dans le journal — ne jamais différer à une session ultérieure

### Règles
- Toujours lire ce fichier et le fichier de session le plus récent AVANT d'agir — ne pas redemander ce qui est déjà documenté
- Les blockers non résolus de la session précédente deviennent la priorité
- Quand un blocker est levé, le noter explicitement dans "Réalisé"
- **Avant toute action corrective sur une carte Trello jugée mal classée** : `grep` l'URL/le nom de la carte sur **l'ensemble** de `.claude/sessions/*.md`, pas seulement le fichier de session le plus récent — un sujet peut se refermer dans une session ultérieure à celle qui l'a initialement cadré

---

## Organisation à deux agents : lead tech / dev

Deux agents travaillent sur ce dépôt depuis la même machine : **Claude Code** et **Codex**. Rôles fonctionnels, attribution par défaut : **Claude Code = lead tech / PO / reviewer**, **Codex = dev**.

**Indisponibilité (quota) — pas de handoff automatique.** Si un agent est à court de tokens en cours de carte, l'autre **n'enchaîne pas** de lui-même sur son rôle : on attend son retour par défaut (constaté en pratique sur la carte 3, 2026-09-22 — Codex a manqué de tokens après la seule routine de démarrage). Le handoff (l'autre agent reprend les deux rôles, PR sans revue indépendante) reste possible mais seulement sur demande explicite de l'utilisateur au moment où la situation se présente, jamais présumé.

Pas de messagerie directe entre agents : la coordination passe par les commentaires Trello, les commentaires de PR et `.claude/sessions/`. L'utilisateur lance chaque agent, dans son propre répertoire (voir Isolation).

### Lead tech / PO
- Cadre les cartes (routine ci-dessus), les découpe, tranche l'architecture.
- Rédige le **ticket de dev** avant de passer la main (format ci-dessous).
- **Revoit la PR du dev avant que l'utilisateur la teste ou la merge** : exactitude, sécurité (RLS avec bypass super-admin, aucune écriture anonyme sensible), cohérence avec les patterns existants, tests, impact (`graphify affected "<symbole>"` sur ce qui est touché), `tsc -b` et `npm test`. Résultat en commentaire de PR (bloquants / suggestions) ; le dev corrige, le lead tech confirme.
- **Cette revue a lieu une seule fois, au passage « ready for review »** — pas à chaque push pendant que la PR est en draft (voir "Boucle d'itération fonctionnelle/UX" ci-dessous). Exception : une remontée explicite du dev sur un point d'architecture/sécurité/modèle de données (cf. section Dev) se traite au fil de l'eau, sans attendre la fin de l'itération, mais reste ciblée sur ce point précis — pas une revue complète anticipée.
- Ne code pas les cartes confiées au dev (correctif trivial ponctuel toléré sur demande de l'utilisateur).
- Dès que le dev ouvre sa PR (même en draft, cf. ci-dessous), s'y abonner (`subscribe_pr_activity`) — réveil automatique quand elle passe « ready for review », pas besoin d'interroger GitHub périodiquement.

### Dev
- Ne démarre qu'une carte **cadrée + ticket rédigé + go explicite de l'utilisateur**.
- Au démarrage : crée la branche, **ouvre immédiatement une PR en draft** vers `dev` (même quasi vide) puis pose un commentaire Trello « Dev en cours — <agent>, branche <nom>, PR #<numéro> » : une carte = un seul agent à la fois. La PR draft dès le départ permet au lead tech de s'y abonner sans polling (voir ci-dessus). Introduit à partir de la carte 3 de l'épique Coupon (2026-09-22) — pas rétroactif sur les cartes précédentes.
- Implémente, teste, pousse ses commits sur cette même PR, puis la **repasse en « ready for review »** + commentaire « prête pour review » (fichier de session aussi), intègre les retours du lead tech.
- Sur toute ambiguïté touchant architecture, sécurité, périmètre ou modèle de données : remonter (commentaire de PR ou Trello) au lieu de trancher seul — que la PR soit encore en draft ou non.

### Boucle d'itération fonctionnelle/UX
Introduit le 2026-09-22 (carte 3 de l'épique Coupon et suivantes), après constat que les allers-retours à 4 (Codex → Claude Code → utilisateur → Claude Code → Codex) sur des points purement fonctionnels/UX rallongeaient inutilement le cycle sans ajouter de sécurité — la carte 2 (rattachement activité ↔ événement) en a fait les frais avec 3 itérations chacune revues intégralement par le lead tech.

- Tant que la PR reste **en draft**, l'utilisateur teste directement avec le dev sur son port dédié (voir Isolation) et lui donne son feedback fonctionnel/UX en direct, sans passer par le lead tech à chaque tour. Le dev pousse ses commits au fil de l'eau ; le lead tech reste abonné mais n'intervient pas sur ces pushes (pas de revue, pas de commentaire), sauf remontée explicite du dev sur un point d'architecture/sécurité/données.
- Une fois le périmètre fonctionnel stabilisé (validé par l'utilisateur en direct avec le dev), le dev repasse la PR en « ready for review » : c'est ce seul passage qui déclenche la revue complète du lead tech (routine ci-dessus).
- Si la revue lead tech remonte un point qui nécessite un nouvel ajustement fonctionnel (pas juste une correction technique), la PR peut repasser en draft pour un nouveau tour direct utilisateur ↔ dev, plutôt que de re-boucler par le lead tech à chaque micro-ajustement.

### Utilisateur
Inchangé : seul à donner le go de démarrage d'une carte, seul à merger. Toute PR passe par la revue du lead tech avant son test.

### Ticket de dev
Section `## Ticket dev` dans la description de la carte Trello : objectif · périmètre (inclus / exclu) · zones du code concernées (issues de graphify) · décisions déjà prises · contraintes (RLS et bypass super-admin, flag, conventions) · critères d'acceptation vérifiables · ce que le dev peut trancher seul / ce qu'il doit remonter.

### Isolation (deux agents, une machine)
- Chaque agent travaille dans **son propre worktree git**, créé une fois par `scripts/agent-worktree.sh <agent>` (→ `../mothana-2-<agent>`, HEAD détaché sur `origin/dev`, `.env` et lien Supabase copiés, `npm install` fait). Par carte : `git switch -c <branche> origin/dev` dans ce worktree. Jamais deux agents dans le même répertoire ; jamais de `git checkout` de branche dans le checkout principal (servi par l'instance permanente 5173), sauf pour mettre une PR à disposition de l'utilisateur, en l'annonçant (règle existante).
- Un worktree ne partage pas les fichiers non versionnés : `node_modules`, `.env`, `supabase/.temp` sont propres à chacun (le script les prépare) ; `graphify-out/` se reconstruit avec `graphify update .`.
- Serveur de dev d'un worktree : `npx vite --host --port <port> --strictPort`, port dédié (Codex : **5174**, worktree de revue : **5175**), arrêt uniquement par PID exact. L'instance permanente 5173 n'est jamais touchée. L'agent annonce à l'utilisateur l'URL/port de la branche à tester (même hôte Tailscale que 5173) au lieu de basculer le checkout principal.
- Les flux d'authentification à redirection (invitation, reset mot de passe, changement d'email) échouent sur une origine absente de l'allowlist Supabase Auth : les tester sur `localhost:5173` ou `test.samakan.fr` après merge sur `dev`.

---

## Contexte du projet

Mothana (marque publique : Samakan) est une application de gestion des dons pour associations. MVP fullstack (React + Supabase).

**Lire seulement si le sujet du jour s'y prête** :
- `docs/cadrage-mothana.md` — spec fonctionnelle complète (tout nouveau sujet fonctionnel, pour vérifier qu'il n'est pas déjà tranché ou explicitement hors scope)
- `docs/schema-mothana.sql` — schéma initial historique, **obsolète** (ne contient pas les tables récentes, ex. `dons_reguliers`, `listes_diffusion`) : la source de vérité du schéma actuel est l'ensemble de `supabase/migrations/*.sql` ; ne pas mettre ce fichier à jour, s'appuyer sur les migrations (avant toute migration ou requête touchant une table pas encore rencontrée)
- `docs/plan-dev-mothana.md` — plan de développement (question de roadmap/priorisation long terme)
- `docs/regles-recus-fiscaux.md` — règles métier reçus fiscaux (tout dev touchant Cerfa/reçus fiscaux)
- `docs/brief-cerfa.md` — brief technique refonte Cerfa (référence si on retouche la génération de reçus)

---

## Stack technique

- **Frontend** : React + TypeScript + Vite, Tailwind CSS, React Router
- **Backend** : Supabase (PostgreSQL + Auth + Storage + Edge Functions)
- **Client JS** : `@supabase/supabase-js`
- **Hébergement** : Vercel Pro (frontend) + Supabase Pro (backend)
- **Génération PDF** : Gotenberg (HTML→PDF, Railway/Render) — remplace pdf-lib

---

## Environnement de développement — ⚠️ règle critique

Ce projet tourne sur une machine dédiée où il est exposé sur le réseau via une instance **permanente** `npm run dev` (port 5173) — c'est cette URL que l'utilisateur utilise pour piloter/vérifier le travail à distance (MacBook ou smartphone, y compris via Tailscale). Cette instance ne doit **jamais** être interrompue par un agent.

- **Ne jamais faire `pkill -f vite`** (ou tout kill par nom de processus) — ça tue l'instance permanente de l'utilisateur, pas seulement une instance de test
- Pour des vérifications visuelles (Playwright ou équivalent), **réutiliser l'instance déjà en cours sur `http://localhost:5173`** plutôt que d'en lancer une nouvelle — les changements de fichiers sont pris en compte automatiquement (HMR Vite)
- Si un test nécessite exceptionnellement une route/fichier temporaire, l'ajouter, tester via l'instance existante, puis le retirer avant de commiter — sans jamais démarrer ni arrêter de processus `npm run dev`/`vite`
- Si une instance séparée est vraiment nécessaire, la lancer sur un port dédié différent et ne l'arrêter que par PID exact (jamais par pattern de nom)
- Les redirections d'authentification Supabase (invitation, reset mot de passe, changement d'email) échouent silencieusement si `site_url`/`redirectTo` pointe vers une IP littérale (ex. IP réseau/Tailscale) — utiliser un nom d'hôte (`localhost`, `test.samakan.fr`, ou un nom Tailscale MagicDNS ajouté à l'allowlist Supabase Auth) plutôt que l'IP brute pour tester ces flux

---

## Modèle d'authentification

**Super-Admin** : `is_super_admin = true` dans `app_metadata` auth.users → `/super-admin`
**Admin** : Supabase Auth email/password → dashboard organisation via `profils_organisation`
**Bénévole** : PIN → Edge Function `verify-pin` → `signInWithPassword` compte technique `benevole-{org_id}@mothana.internal`

⚠️ Pas de table `utilisateurs_app` — tout via `auth.users` Supabase
⚠️ JWT custom abandonné (RS256 incompatible HS256)

---

## Schéma de données

Source de vérité : `supabase/migrations/*.sql` (`docs/schema-mothana.sql` n'est qu'une base historique obsolète). Points non évidents à la simple lecture des colonnes :

- `personnes.civilite` (smallint) : 1=Monsieur 2=Madame 3=Mademoiselle 4=Foyer 5=Société 6=Association 7=Famille — 0/255→NULL
- `adherents.civilite` (smallint réduit, enum **distinct** de celui de `personnes`) : 0=non défini, 1=Monsieur, 2=Madame — pas de personne morale/famille adhérente pour l'instant
- `profils_participant.id_externe` = IDFideles (import legacy, seulement rempli pour les participants importés) — ne pas l'utiliser comme numéro de donateur générique
- `profils_organisation.role` : `admin` (créé uniquement par le super-admin) ou `contributeur` (créé par un admin, mêmes droits fonctionnels, aucun droit de gestion des comptes)
- `adhesions.mode_paiement` réutilise l'enum `dons.mode_paiement` (CHECK `[1,2,3,4]` : Espèces/Chèque/Prélèvement-virement/Autres)
- `adhesions.renouvellement` et `date_fin` : calculés côté application (`lib/adhesion.ts`), jamais saisis manuellement

---

## Conventions de code

- **Langue** : code en anglais, UI en français
- **Composants** : PascalCase, un fichier par composant
- **Hooks custom** : préfixe `use`, dans `src/hooks/`
- **Types TypeScript** : dans `src/types/`, toujours typer les réponses Supabase
- **Pas de `any`** sauf cas exceptionnel justifié en commentaire
- **Réutilisation** : composants partagés entre écrans (formulaires, modales, autocomplete)

**Avant tout push** :
- `tsc -b` (pas `tsc --noEmit` seul, insuffisant sur ce projet — tsconfig racine vide, `-b` matche la commande de build Vercel)
- `npm test` (Vitest, `src/lib/participantSearch.test.ts` en référence) pour tout changement touchant une fonction couverte par des tests unitaires
- Lint ciblé sur les fichiers touchés au minimum — le lint global reste rouge sur 6 erreurs préexistantes hors périmètre (`DonFichiers.tsx`, `TemplateRecuEditorModal.tsx`), pas un bloqueur pour une PR qui n'y touche pas

---

## Sécurité — règles absolues

- Sécurité via **RLS Supabase**, pas uniquement côté frontend
- Ne jamais exposer la clé `service_role` côté client
- Ne jamais commiter `.env`
- Toute policy RLS organisation-scopée doit avoir le bypass super-admin sur select/insert/update/delete dès la première migration (pas seulement certaines opérations) — l'utilisateur teste habituellement en mode "Consulter" super-admin

---

## Git — workflow

Règles générales, valables quel que soit l'agent :
- Ne jamais merger une PR sans autorisation explicite de l'utilisateur, même testée/validée manuellement
- Avant de démarrer un nouveau développement, vérifier s'il y a des PR ouvertes ; si oui et sans rapport direct, informer l'utilisateur et demander confirmation
- Un blocage trouvé en testant une PR ouverte (même dans un fichier sans rapport direct) se corrige dans **cette même PR**, pas dans une PR séparée
- Dès qu'un développement est jugé terminé (fonctionnel, testé), pousser la branche et **ouvrir une PR automatiquement**, sans attendre qu'on le demande. **Sans exception**, y compris pour un correctif ponctuel codé directement par le lead tech (pas de carte, pas de dev) — même quand une revue indépendante n'a pas de sens puisque c'est le même agent qui a écrit et vérifié le changement : la PR reste la trace et le point de rollback. Écart constaté le 2026-09-22 (3 commits Activités poussés directement sur `dev`) — ne pas reproduire
- Demander confirmation explicite avant de démarrer le dev d'une carte/d'un sujet, même déjà cadré — ne pas enchaîner automatiquement après le merge d'une PR précédente
  - **Exception "batch dev"** : pour les cartes groupées dans une liste Trello "Batch — ..." (voir section Trello ci-dessous), la confirmation se donne une fois pour tout le batch — pas de nouvelle confirmation ni d'attente du merge entre deux cartes. Chaque nouvelle branche repart de `dev` (pas empilée, sauf dépendance réelle), chaque PR cible `dev` directement. Le merge de chaque PR reste manuel et explicite.

Spécifique à Mothana :
- Quand une PR de feature est mergée (cible `dev`), `checkout dev` puis `pull` pour mettre la branche locale à jour avant de démarrer les développements suivants — `checkout main`/`pull` seulement après une promotion `dev` → `main`. Vérifier aussi à ce moment-là la liste "Todo" du board Trello : identifier les cartes traitées par cette PR, les déplacer vers "Done", et signaler les cartes déplacées + toute nouvelle carte apparue depuis le dernier check — vérification **bidirectionnelle**, pas seulement un scan des nouvelles cartes
- **Branche `dev`** (environnement de recette, `test.samakan.fr`) : les PR de features ciblent `dev`, jamais `main` directement. `main` ne reçoit que des promotions depuis `dev` (une feature à la fois, pas de lot) — c'est ce merge `dev → main` qui déclenche migrations Supabase + déploiement Edge Function en prod. Détail complet : `docs/environnement-recette.md`
- **Promotion `dev` → `main` via PR GitHub** : passe par `gh pr create` (base `main`, head `dev`) puis `gh pr merge --merge` (commit de fusion, jamais `--squash`/`--rebase`). Sur confirmation explicite de l'utilisateur pour démarrer la promotion, l'agent peut créer **et** merger cette PR sans redemander — pas de re-review de contenu à ce stade. Ne s'applique **pas** aux PR de feature classiques, qui restent soumises à la règle standard "jamais merger sans autorisation explicite"
  - ⚠️⚠️⚠️ **NE JAMAIS laisser `gh pr merge` supprimer la branche `dev`** (`--delete-branch=false` ou décocher dans le flux interactif). `dev` est une branche **permanente** : la recette (`test.samakan.fr`) et les variables d'environnement Vercel scopées y sont rattachées par son *nom*. Une suppression basculerait silencieusement la recette sur les identifiants **prod**, sans erreur visible ⚠️⚠️⚠️
- Edge Functions : ne se déploient jamais automatiquement au push/merge sur ce projet — toujours `supabase functions deploy <nom>` explicitement après une édition de leur code
- Migrations SQL : sur confirmation, appliquer directement via `supabase db query --linked -f <fichier>` plutôt que de se contenter de dire à l'utilisateur de les lancer lui-même

---

## Board Trello "Mothana"

Boîte à idées de l'utilisateur — il y note à la volée ses demandes d'évolution, hors session. Board `6a4ec9a8b4b49022a9b125a7` (⚠️ un second board homonyme existe mais est archivé, ne pas le confondre).

- Liste "Backlog" (`6a9de5d6feb9f5af27ab5240`) : idées pas encore cadrées
- Liste "Todo" (`6a4ec9ad1fb154cfc45c858d`) : cadrées, prêtes à prioriser
- Liste "Done" (`6a4ec9b1939cbad2bfc0da8c`)
- Listes "Batch — ..." : groupes de cartes à dev enchaîné sans confirmation/merge intermédiaire (voir règle "batch dev" ci-dessus) — créées à la discrétion de l'utilisateur, signal fiable = l'existence de la liste elle-même, pas de jugement à faire sur si des cartes hors liste sont "assez indépendantes" pour être enchaînées
- Listes "Pr \<numéro\>" : retours de QA sur une PR précise, une carte par retour, remplie par l'utilisateur pendant ses tests — à traiter en un seul passage groupé, un seul commit/push sur la PR existante, puis archiver la liste
- Liste "Coupon" : sujet épique (porte-monnaie événementiel « Pagode Coupon », cf. backlog actif) — la carte de tête reste la référence de cadrage global, à découper en sous-cartes dans cette même liste au fur et à mesure. Pas la sémantique "batch dev" (pas d'enchaînement sans confirmation) sauf si une liste "Batch — ..." est créée séparément pour un sous-ensemble de ces sous-cartes
- Étiquette "cadré" (verte) : `6a4ec9a991df5c8810c08fb9`
- Étiquette "action admin" (bleue) : `6a4ec9ab204b09f95ad0f09f` — tâche pour l'utilisateur lui-même, à ignorer au cadrage

Accès API : credentials dans `.env` à la racine (`TRELLO_API_KEY`, `TRELLO_TOKEN`), requêtes REST directes. Exemple de lecture d'une liste (limiter aux listes utiles, jamais "Done" en scan de routine, omettre `desc` sauf sur une carte précisément identifiée) :
```
curl -s "https://api.trello.com/1/lists/<LIST_ID>/cards?fields=name,shortUrl,labels&key=${TRELLO_API_KEY}&token=${TRELLO_TOKEN}"
```
Déplacer une carte vers une autre liste :
```
curl -s -X PUT "https://api.trello.com/1/cards/<CARD_ID>?idList=<LIST_ID>&key=${TRELLO_API_KEY}&token=${TRELLO_TOKEN}"
```

---

## État d'avancement

Historique complet des sujets terminés (détail des décisions techniques, bugs trouvés en testant, PR associées) : `docs/journal-avancement.md` — à lire seulement en cas de besoin d'archéologie sur une décision passée, pas systématiquement.

### ⏳ Backlog actif — ordre Trello

Le board Trello est la source de vérité unique du backlog (hors cartes "Action admin"). Liste ci-dessous volontairement réduite à titre + statut + lien — le détail complet vit sur la description de la carte Trello. Ordre = priorité/complexité, pas l'ordre d'ajout. Confirmation explicite à redemander avant de démarrer le dev de l'une d'entre elles, même déjà cadrée.

1. **Mire de connexion personnalisée par organisation** (admin + bénévole) — cadré. [Trello](https://trello.com/c/gkOuH3uh)
2. **Campagne mailing : inclure les donateurs** — cadré (2026-09-13). [Trello](https://trello.com/c/GqVqTkKB)
3. **Support multi-organisation pour un compte admin** — cadré, dev reporté à plus tard (décision explicite utilisateur). [Trello](https://trello.com/c/WtLrSLGW)
4. **Dette technique : factoriser CampagneCourrierPage / CampagneMailingPage** — cadré (2026-09-13), dev reporté au 3ᵉ signal de duplication. [Trello](https://trello.com/c/RBsb8fbs)
5. **Demande d'adhésion : email aux admins à la soumission** — cadré (2026-09-15). [Trello](https://trello.com/c/eHtWmxYK)
6. **Priorité 5 — Export comptable enrichi** — roadmap lointaine. [Trello](https://trello.com/c/W3GCYUOt)
7. **Porte-monnaie événementiel** (Pagode Coupon) — cadré et recadré (2026-09-21) : **seul le mode porte-monnaie est conservé** (plus de coupons). Module Mothana multi-tenant ouvert à toutes les organisations (flag désactivé par défaut), reconstruction native (incompatibilité Next.js/Vite). L'acheteur pré-achète du crédit en ligne dans un **portefeuille par événement** (un par email, expire à la clôture de l'événement ; persistance d'un événement à l'autre à réévaluer après avis juridique ; recharge possible sur le même portefeuille) ; le jour J le vendeur scanne son QR et saisit un montant, l'acheteur **valide sur son téléphone** (temps réel) puis le débit est fait au centime. Paiement en ligne dans le périmètre (prestataire décidé en carte 6). Découpé en 11 cartes dans la liste Trello "Coupon", risque d'abord (flux à deux appareils avant le paiement) : fondations → admin événements → spike temps réel → page acheteur (+ PDF du QR) → écran vendeur → cadrage paiement → paiement backend → achat public + email (lien + PDF) + recharge → récupération du lien acheteur → durcissement `verify-pin` → dashboard. Ticket dev de la carte 1 en cours de validation. Confirmation à redemander avant de démarrer la première. [Trello](https://trello.com/c/C9A5B9jr)
8. **Priorité 5 — Gestion abonnements/plans** — rattachée à la liste Trello "Business plan — Commercialisation", roadmap lointaine. [Trello](https://trello.com/c/cfKF8BNw)

---

## Instructions générales

1. Lire ce fichier et le fichier de session le plus récent (`.claude/sessions/`) avant toute action
2. Mettre à jour "État d'avancement" après chaque étape complétée — ajouter l'entrée (résumé + détail : décisions, bugs trouvés en testant) directement dans `docs/journal-avancement.md`
3. Sauvegarder un résumé de session dans `.claude/sessions/` en fin de session
4. Ne jamais sauter d'étape sans validation explicite
5. Demander confirmation en cas de doute fonctionnel ou technique
6. Traiter un sujet à la fois — sauf lien étroit explicitement demandé
7. Ne pas présumer qu'un accord donné à un moment donné (session précédente, ou avant que d'autres changements aient eu lieu) tient toujours — revérifier avant de reprendre un plan déjà validé mais qui date

## graphify

This project has a knowledge graph at graphify-out/ with god nodes, community structure, and cross-file relationships.

When the user types `/graphify`, use the installed graphify skill or instructions before doing anything else.

Rules:
- For codebase questions, first run `graphify query "<question>"` when graphify-out/graph.json exists. Use `graphify path "<A>" "<B>"` for relationships and `graphify explain "<concept>"` for focused concepts. These return a scoped subgraph, usually much smaller than GRAPH_REPORT.md or raw grep output.
- Dirty graphify-out/ files are expected after hooks or incremental updates; dirty graph files are not a reason to skip graphify. Only skip graphify if the task is about stale or incorrect graph output, or the user explicitly says not to use it.
- If graphify-out/wiki/index.md exists, use it for broad navigation instead of raw source browsing.
- Read graphify-out/GRAPH_REPORT.md only for broad architecture review or when query/path/explain do not surface enough context.
- After modifying code, run `graphify update .` to keep the graph current (AST-only, no API cost).
