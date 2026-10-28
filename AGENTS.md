# AGENTS.md — Mothana (Gestion des dons)

Contexte projet et règles de fonctionnement, lus par tout agent de code travaillant sur ce dépôt (Claude Code l'importe via `@AGENTS.md` en tête de `CLAUDE.md` ; un autre agent comme Codex le lit nativement). Objectif : pouvoir reprendre le travail avec un autre agent sans perte de contexte (ex. quota d'usage épuisé sur l'un d'eux). Ce fichier contient tout ce qui est portable ; `CLAUDE.md` ne garde que ce qui est spécifique à Claude Code.

---

## Continuité entre sessions

### En début de session
- Chercher automatiquement le fichier de la dernière session dans `.claude/sessions/`
- Identifier où on s'est arrêté et les blockers en cours
- Résumer en 3 lignes avant de commencer
- Vérifier la liste "Backlog" du board Trello "Mothana" (voir section Trello ci-dessous) — l'utilisateur y note à la volée ses demandes d'évolution, pas encore cadrées. En cas de nouveauté (carte non présente dans le backlog ci-dessous), proposer de la cadrer pour l'inscrire dans "État d'avancement"
- Quand un sujet est cadré (nouveauté détectée ou sujet déjà connu qu'on approfondit), alimenter la carte Trello correspondante avec le détail du cadrage (description), réécrire le titre si le libellé d'origine est devenu imprécis, appliquer l'étiquette verte "cadré", et **déplacer la carte de "Backlog" vers "Todo"**
- À ce même moment, reclasser les cartes de "Todo" (et des listes "Batch — ...") par priorité/complexité : un sujet peu complexe peut remonter en haut de la liste, un sujet complexe redescend en général plus bas — sauf s'il est aussi sensible ou prioritaire, auquel cas il remonte malgré sa complexité
- **Cette routine sert à décider quoi faire quand on arrive à froid.** Si le message de démarrage reçu est déjà complet et autonome (carte précise, lien du ticket dev, branche/commit de départ — cas type d'un dev qui démarre une carte cadrée par le lead tech), la décision est déjà prise : inutile de retracer "où on en est" ni de vérifier Backlog/Todo. Lire `AGENTS.md` reste toujours utile (règles opérationnelles générales), le reste de la routine ne l'est pas dans ce cas précis.

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
- **Ne jamais affirmer l'état d'une PR ou d'une carte (mergée, en draft, ready for review) de mémoire** — vérifier sur une source vivante avant de l'énoncer : `gh pr view <numéro> --json state,mergedAt,isDraft` (après `git fetch` si le worktree local peut être en retard), ou à défaut la dernière entrée du fichier de session/`docs/journal-avancement.md`. Deux occurrences confirmées de PR annoncées à tort comme non mergées alors qu'elles l'étaient (2026-09-22 carte 2 ; 2026-09-28 PR #194) — dans les deux cas une affirmation non vérifiée, pas juste un problème de session réutilisée (le 28/09 s'est produit dans une session neuve)

### Dimensionnement

Avant de démarrer une tâche, l'agent annonce son ordre de grandeur et ses jalons :

- **S** : correction localisée, typiquement 1 à 3 fichiers, avec tests ciblés
- **M** : plusieurs composants ou de la logique métier, avec tests complets et QA
- **L** : changement transversal, migration ou décision d'architecture ; découper en sous-tâches avant de coder

La taille d'une carte cadrée figure en tête de son titre Trello, entre crochets : `[S]`, `[M]` ou `[L]` (repris de Panda Scoring, 2026-10-08). Elle est posée au cadrage et corrigée si le périmètre change.

---

## Organisation : lead tech + sous-agents dev

**Workflow TL + sous-agents dev v2 (2026-10-28)**, copie adaptée de `~/.claude/workflows/duo-tl-dev.md` (sections 1, 2, 4, 8, 10 et 13). Une seule session permanente, **lead tech / PO / reviewer** (« Mothana - TL », worktree de revue `../mothana-2-review`, port 5175) ; le développement de chaque carte est confié à un **sous-agent dev** que le lead tech lance (outil `Agent`, en arrière-plan), dans le worktree dev `../mothana-2-claude-dev` (port 5174), **un à la fois**. Historique : deux sessions Claude Code TL + dev du 2026-10-07 au 2026-10-28 (Codex écarté le 2026-10-07) ; passage aux sous-agents décidé par l'utilisateur le 2026-10-28 après l'essai sur Panda Scoring (≈ 1,2 M tokens pondérés par carte contre ≈ 2,8 M avec une session dev). Une session dev dédiée (« Mothana - dev ») reste possible **sur décision de l'utilisateur**, pour une carte `[L]` ou une itération UX longue : les règles « Dev » ci-dessous valent alors pour elle, et la coordination passe par messages directs.

Le rôle est attribué **par session**, au lancement, par le message de démarrage de l'utilisateur : une session qui lit ce fichier sans rôle attribué demande lequel elle tient. Un sous-agent dev sait qu'il l'est par son prompt de lancement (gabarit `docs/sous-agent-dev.md`).

### Lead tech / PO
- Cadre les cartes (routine ci-dessus), les découpe, tranche l'architecture.
- Rédige le **ticket de dev** avant de lancer le sous-agent (format ci-dessous).
- **Lance un sous-agent dev par carte**, après le go de l'utilisateur, avec le prompt : « Lis et suis à la lettre les consignes de `/Users/vichithboulom/Projects/mothana-2-review/docs/sous-agent-dev.md` (ou la copie sur `origin/dev`), avec ces valeurs : `<CARD_ID>`, `<BASE>`, `<BRANCH>`, `<SCRATCH>` », suivi des précisions propres à la carte (ce qui a changé depuis le ticket, décisions récentes, pièges connus). Une carte à la fois dans le worktree dev ; en batch, il lance la carte suivante dès le rapport reçu et revoit la précédente pendant ce temps. Met à jour le gabarit quand une revue révèle une consigne manquante.
- **Questions ouvertes** d'un rapport de sous-agent : tranche ce qui est de son ressort, remonte le reste à l'utilisateur avec le résumé de revue, et les trace (commentaire de PR, carte, fichier de session) pour qu'elles ne se perdent pas.
- **Revoit la PR avant que l'utilisateur la teste ou la merge**, une seule fois, au passage « ready for review » (rapport du sous-agent) : état réel vérifié (`gh pr view <n> --json state,isDraft`), **diff relu lui-même** contre le ticket et le code existant (pas seulement contre le rapport), exactitude, sécurité (RLS avec bypass super-admin, gardes SQL `coalesce`, aucune écriture anonyme sensible), cohérence avec les patterns existants et `DESIGN.md`, tests, impact (`graphify affected "<symbole>"`), **checks relancés** (`tsc -b`, `npm test`, lint ciblé, `npm run lint:ds`). Résultat en commentaire de PR (bloquants / suggestions / vérifié).
- **Garde-fous** (il relit du code écrit sur ses propres consignes) : au moins **une mesure visuelle faite par lui-même** pour toute carte qui touche l'interface (sans se contenter des chiffres du rapport) ; **revue indépendante** par un sous-agent de revue (qui reçoit le diff, pas la conclusion du lead tech) pour une carte `[L]` ou sensible (sécurité, RLS, modèle de données, argent, reçus fiscaux).
- Un bloquant ou un retour fonctionnel de l'utilisateur se corrige par un **sous-agent relancé sur la même branche** (ou le même sous-agent repris), avec ces retours ; le lead tech confirme par un nouveau commentaire. Il **traite lui-même ses retours mécaniques** (duplication, renommage, nettoyage, `DESIGN.md`, tests manquants, sans ambiguïté) : commit séparé, checks verts, commentaire « corrigé par le lead tech ». Tout ce qui touche comportement, périmètre, logique métier, sécurité/RLS ou modèle de données repasse par un sous-agent.
- Ne code pas les cartes lui-même (correctif trivial ou mécanique toléré).
- **Branches** : celles créées par les sous-agents sont les siennes ; il les supprime après le merge.
- **Dashboard de suivi des reviews** (décision utilisateur, 2026-10-21 ; canal changé le 2026-10-26) : l'utilisateur suit les revues de tous ses projets dans un dashboard HTTP, que le lead tech alimente **lui-même directement par HTTP sur Tailscale** — plus de `SendMessage` à la session « Projects »/`projects-7c` (abandonné pour économiser des tokens ; les anciens messages `REVIEW AJOUT`/`REVIEW SUPPRIMER` ne sont plus traités). Dashboard : `http://100.123.59.74:8095` (URL non secrète, notable ; aucun jeton).
  - **Ajouter / mettre à jour** : `POST http://100.123.59.74:8095/api/review`, en-tête `Content-Type: application/json`, corps JSON en UTF-8 — écrire le JSON dans un fichier et l'envoyer (`curl -s -X POST …/api/review -H 'Content-Type: application/json' --data-binary @review.json`). Champs : `projet` (obligatoire, exactement « Mothana »), `pr` (entier, obligatoire), `titre` (obligatoire à la création), `lien_pr` (URL nue), `description`, `remarques`, `lien_test` (**URL nue uniquement**, `http(s)://…` sans aucun texte autour sinon refus — les précisions vont dans `remarques`), `plan_texte` (le plan de test copié **tel quel, identique à celui transmis à l'utilisateur**, `\n` entre les lignes ; `###` titres, `-` puces, `**gras**`, `` `code` `` acceptés) **ou** `plan_test` (liste d'étapes, exclusif avec `plan_texte`), `auteur` (« Mothana - TL »). Même `projet` + `pr` = mise à jour : seuls les champs envoyés changent ; un plan envoyé remplace l'ancien. Réponse `{"ok":true,"action":"créée"|"mise à jour"}` ; refus = code 400 + `{"erreur":"…"}` lisible → corriger et renvoyer.
  - **Retirer** (revue terminée, PR mergée/fermée) : `POST http://100.123.59.74:8095/api/review/supprimer` avec `{"projet":"Mothana","pr":<n°>}` (404 si absente).
  - **Lire** (ajouté le 2026-10-26) : `GET http://100.123.59.74:8095/api/reviews?projet=Mothana` → `{"ok":true,"reviews":[…]}` (sans `projet` = tous les projets ; tri par projet puis `pr` ; projet inconnu → `{"ok":true,"reviews":[],"projets":[…]}`). `GET http://100.123.59.74:8095/api/review?projet=Mothana&pr=<n°>` → `{"ok":true,"review":{…}}` (404 `{"erreur":"review introuvable : …"}` si absente ; 400 si `projet` ou `pr` entier manque). Chaque review renvoie les champs d'écriture (`projet`, `pr`, `titre`, `lien_pr`, `description`, `remarques`, `lien_test`, `plan_texte` ou `plan_test`, `auteur`) plus `cree_le`/`modifie_le` (ISO locale Optiplex). Permet de relire une review avant de la remettre à jour en POST.
  - Le plan de test reste **identique mot pour mot** à celui transmis à l'utilisateur (mêmes étapes, ordre, numérotation et détails, rien de résumé ni d'omis), renvoyé en entier à chaque mise à jour. Aucune confirmation à envoyer à une autre session : la réponse de l'API suffit. Le lead tech ne lance jamais lui-même le script du dashboard.
- Dans un batch dont l'utilisateur a donné le go, enchaîne les sous-agents sans reconfirmation. Ne démarre jamais de lui-même une carte ou un batch sans le go de l'utilisateur.
- Prévient l'utilisateur par un message clair **en tête de réponse** aux moments clés (batch prêt à tester, décision attendue, blocage), pour qu'il le voie sans lire tout le fil.
- Tient le fichier de session (`.claude/sessions/`) et y reporte ce que les sous-agents ont laissé en suspens ; les sous-agents n'en écrivent pas.

### Dev (sous-agent)
- Ne traite qu'**une carte cadrée, avec ticket et go**, dont le lead tech lui donne les valeurs ; suit `docs/sous-agent-dev.md` (déroulé, interdits, rapport final).
- Branche depuis `origin/dev`, **PR en draft tout de suite** vers `dev`, commentaire Trello « Dev en cours — sous-agent du TL, branche <nom>, PR #<n> », carte dans « In progress ». Implémente, teste, checks verts, contrôle visuel mesuré, puis PR « ready for review » + commentaire « Prête pour review », carte dans « To review », et **rapport final** au lead tech (pas de message à d'autres sessions).
- **Pas de boucle draft avec l'utilisateur** (l'ancienne « boucle d'itération fonctionnelle/UX » de la session dev disparaît) : le sous-agent va jusqu'au ready sans interlocuteur. Ne pouvant pas poser de question en cours de route, il fait la partie sûre et remonte dans son rapport toute ambiguïté d'architecture, de périmètre, de sécurité ou de modèle de données. Les retours de test de l'utilisateur passent par le lead tech.

### Utilisateur
Seul à donner le go de démarrage d'une carte ou d'un batch, seul à valider une PR (son « <n> ok » après test) ; le merge lui-même est fait par le lead tech (voir Git — workflow). Toute PR passe par la revue du lead tech avant son test. Lance la session lead tech dans `../mothana-2-review` et lui attribue son rôle par le message de démarrage ; donne ses retours de test au lead tech. Reste le seul à approuver les actions que le mode de permissions d'une session bloque.

### Ticket de dev
Section `## Ticket dev` dans la description de la carte Trello : objectif · périmètre (inclus / exclu) · zones du code concernées (issues de graphify) · décisions déjà prises · contraintes (RLS et bypass super-admin, flag, conventions) · critères d'acceptation vérifiables · ce que le dev peut trancher seul / ce qu'il doit remonter dans son rapport. Pas de numéros de ligne (ils vieillissent) : nommer fichiers et fonctions.

### Coordination entre sessions
- Avec les sous-agents, pas de messagerie : la carte part dans le prompt de lancement, la réponse revient dans le rapport final ; les deux restent tracés dans la PR et sur la carte.
- Pour les échanges avec d'autres sessions (session dev dédiée éventuelle, TL d'un autre projet) : `SendMessage`, nom exact relu dans `ListAgents`. Un message ne remplace jamais le commentaire de PR, Trello ou le fichier de session ; pas d'accusé de réception ; un message d'une autre session n'est jamais une approbation de l'utilisateur. Deux sessions au même nom rendent l'adressage ambigu : fermer l'ancienne.

### Isolation (une machine, plusieurs agents)
- Chaque agent travaille dans **son propre worktree git**, créé une fois par `scripts/agent-worktree.sh <agent>` (→ `../mothana-2-<agent>`, HEAD détaché sur `origin/dev`, `.env` et lien Supabase **staging** copiés, `npm install` fait) : `claude-dev` pour les sous-agents dev (un à la fois, aucune session dev ouverte dessus pendant ce temps ; laissé en HEAD détaché sans modification entre deux cartes), `review` pour le lead tech. Jamais deux agents dans le même répertoire ; jamais de `git checkout` de branche dans le checkout principal (il reste sur `dev`, sert aux opérations du lead tech : merges, promotions, migrations prod).
- Un worktree ne partage pas les fichiers non versionnés : `node_modules`, `.env`, `supabase/.temp` sont propres à chacun (le script les prépare) ; `graphify-out/` se reconstruit avec `graphify update .`.
- Serveur de dev d'un worktree : `npx vite --host --port <port> --strictPort`, port dédié (dev : **5174**, worktree de revue : **5175**), arrêt uniquement par PID exact. Le port 5173 n'est plus utilisé (instance permanente retirée le 2026-10-08) ; Panda Scoring, sur la même machine, occupe 5183-5185 et ses processus ne sont jamais touchés. IP Tailscale de cette machine : `100.107.87.80` (le nom MagicDNS `mac-mini-de-vichith.tail5a5a34.ts.net` existe mais Vite le bloque par défaut, `server.allowedHosts` non configuré : toujours utiliser l'IP brute).
- **Cycle de vie des serveurs worktree autour d'une revue** : le lead tech démarre (ou redémarre) **uniquement** le serveur de son worktree de revue (5175, checkout sur la branche de la PR) dès qu'il entame une revue. Il donne à l'utilisateur, sans attendre qu'on le demande, les URLs précises des pages à vérifier **et un plan de test** (scénarios pas à pas avec résultat attendu, cas limites, ce qui n'est pas testable depuis le téléphone et qu'il vérifie lui-même), puis arrête son serveur (5175, PID exact) dès que la PR est mergée et confirmée. Le sous-agent arrête son serveur 5174 avant de rendre son rapport.
- **Staging partagé** : un sous-agent peut appliquer sur **staging** les migrations de sa carte et y déployer les Edge Functions qu'il modifie (comme le faisait la session dev), en le signalant dans son rapport ; **jamais en prod** (le lead tech s'en charge à la promotion).
- Les flux d'authentification à redirection (invitation, reset mot de passe, changement d'email) échouent sur une origine absente de l'allowlist Supabase Auth : les tester sur `test.samakan.fr` après merge sur `dev`.
- L'ancien worktree `../mothana-2-codex` n'est plus utilisé ; avant de le supprimer, vérifier les commits non poussés et les fichiers non versionnés. Le mode auto peut bloquer `git worktree remove`/`kill` : approbation manuelle de l'utilisateur.

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
- **Hébergement** : Vercel (frontend, plan gratuit — limite de déploiements partagée par le compte ; seules `dev` et `main` déploient, les previews de branches sont coupées dans `vercel.json` depuis le 2026-10-08 car jamais utilisées : on teste sur les serveurs des worktrees) + Supabase (backend) en **deux organisations** depuis le 2026-10-08 : « Chithda » en **Pro** (prod `bocqfdhmxmleracrwvbu` seule, 25 $/mois, plafond de dépenses activé : sauvegardes quotidiennes 7 jours, pas de mise en pause, logs 7 jours) et « Chithda recette » en **gratuit** (staging/recette `cxngcmvxktddhyxboyyx` : pas de sauvegarde, mise en pause après 7 jours d'inactivité — la réveiller dans le dashboard avant de tester). Une place de projet gratuit reste libre (limite de 2 projets gratuits actifs par propriétaire, toutes organisations confondues). Projet `pagode-coupon` (POC) supprimé le 2026-10-08 après téléchargement de sa sauvegarde par l'utilisateur. Toujours faire un `pg_dump` avant une opération prod lourde, en plus des sauvegardes quotidiennes
- **Génération PDF** : Gotenberg (HTML→PDF, Railway/Render) — remplace pdf-lib

---

## Environnement de développement — ⚠️ règle critique

Ce projet tourne sur une machine dédiée (Mac mini), accessible à distance par l'utilisateur (MacBook ou smartphone, via Tailscale). **Depuis le 2026-10-08, il n'y a plus d'instance permanente `npm run dev` sur le port 5173** (décision utilisateur) : l'utilisateur ne relance plus ce processus et ne teste plus qu'avec **les liens et les plans de test fournis par le lead tech**, sur les serveurs des worktrees (revue : **5175**, dev : **5174**, voir Isolation). Chaque revue fournit donc les URLs précises (`http://100.107.87.80:<port>/...`) et un plan de test pas à pas ; sans ce lien, l'utilisateur n'a rien à tester.

- **Ne jamais faire `pkill -f vite`** (ou tout kill par nom de processus) — d'autres serveurs tournent sur la machine (worktree de l'autre agent, Panda Scoring 5183-5185) ; arrêt uniquement par PID exact
- Vérifications visuelles (Playwright ou équivalent) : sur le serveur du worktree de revue (5175) ou du dev (5174), jamais en démarrant un serveur depuis le checkout principal
- Si un test nécessite exceptionnellement une route/fichier temporaire, l'ajouter dans le worktree, tester, puis le retirer avant de commiter
- Les redirections d'authentification Supabase (invitation, reset mot de passe, changement d'email) échouent silencieusement si `site_url`/`redirectTo` pointe vers une IP littérale (ex. IP réseau/Tailscale) — tester ces flux sur `test.samakan.fr` après merge sur `dev`

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
- `npm run lint:ds` (garde-fous du design system : palette Tailwind brute, `rounded-lg`, ancien `Modal`, hex en dur) — doit être vert : il tourne en tête de `npm run build`, un échec casse le déploiement Vercel, et sans preview il ne se verrait qu'au merge sur `dev`. Exception hex : une ligne dans `HEX_EXCEPTIONS` (`eslint.design-system.js`), cf. `DESIGN.md` § Garde-fous lint

---

## Sécurité — règles absolues

- Sécurité via **RLS Supabase**, pas uniquement côté frontend
- Ne jamais exposer la clé `service_role` côté client
- Ne jamais commiter `.env`
- Toute policy RLS organisation-scopée doit avoir le bypass super-admin sur select/insert/update/delete dès la première migration (pas seulement certaines opérations) — l'utilisateur teste habituellement en mode "Consulter" super-admin
- **Garde d'autorisation dans une fonction SQL (RPC/trigger)** : toujours écrire `if not coalesce(<condition>, false) then raise exception …`. Les helpers d'identité (`current_user_organisation_id()`, `current_user_role()`, `is_current_user_super_admin()`) valent **NULL** pour une session sans `profils_organisation` (bénévole/vendeur) ou sans claim super-admin ; une garde `if not (<condition>)` vaut alors `if NULL`, qui **ne lève pas** l'exception → autorisation accordée à tort (faille inter-organisations trouvée le 2026-10-24 sur `get_org_admins`, en prod). Chaque fonction gardée doit avoir un **test SQL avec une session bénévole** vérifiant le refus.

---

## Git — workflow

Règles générales, valables quel que soit l'agent :
- **Merge d'une PR de feature** (règle assouplie le 2026-10-08, décision utilisateur, Mothana uniquement) : jamais sans le **« ok » explicite de l'utilisateur** après son test. Une fois cet « ok » donné, **le lead tech merge lui-même** (revue lead tech sans bloquant requise) — hors batch dev. **Dans un batch dev**, pas de merge au fil de l'eau : les PR du batch se mergent **à la fin, une fois tout le batch revu** et validé par l'utilisateur, par le lead tech après l'« ok ». Seule exception : un merge intermédiaire nécessaire au déroulement de la revue (ex. PR amont d'un batch empilé à merger pour débloquer la suivante), fait en cours de route, toujours après l'« ok ». Le dev (sous-agent) ne merge jamais. Après merge : `git pull` de `dev`, carte Trello en Done + entrée du journal dans la même respiration
- Ne jamais merger une PR sans l'« ok » explicite de l'utilisateur, même testée/validée manuellement par un agent
- **Exception « PR exclusivement doc »** (décision utilisateur, 2026-10-08) : une PR qui ne touche **que** de la documentation (`AGENTS.md`, `CLAUDE.md`, `docs/`, `.claude/sessions/`, README) est mergée par le lead tech dès son ouverture, sans attendre de confirmation. Dès qu'une PR touche autre chose (code, migrations, config, scripts, dépendances), la règle générale s'applique
- Avant de démarrer un nouveau développement, vérifier s'il y a des PR ouvertes ; si oui et sans rapport direct, informer l'utilisateur et demander confirmation
- Un blocage trouvé en testant une PR ouverte (même dans un fichier sans rapport direct) se corrige dans **cette même PR**, pas dans une PR séparée
- Dès qu'un développement est jugé terminé (fonctionnel, testé), pousser la branche et **ouvrir une PR automatiquement**, sans attendre qu'on le demande. **Sans exception**, y compris pour un correctif ponctuel codé directement par le lead tech (pas de carte, pas de dev) — même quand une revue indépendante n'a pas de sens puisque c'est le même agent qui a écrit et vérifié le changement : la PR reste la trace et le point de rollback. Écart constaté le 2026-09-22 (3 commits Activités poussés directement sur `dev`) — ne pas reproduire
- Demander confirmation explicite avant de démarrer le dev d'une carte/d'un sujet, même déjà cadré — ne pas enchaîner automatiquement après le merge d'une PR précédente
  - **Exception "batch dev"** : pour les cartes groupées dans une liste Trello "Batch — ..." (voir section Trello ci-dessous), la confirmation se donne une fois pour tout le batch — pas de nouvelle confirmation ni d'attente du merge entre deux cartes. Chaque nouvelle branche repart de `dev` (pas empilée, sauf dépendance réelle), chaque PR cible `dev` directement. Le merge de chaque PR reste manuel et explicite.
  - **Variante « batch empilé »** (reprise de Panda Scoring, 2026-10-08 ; choisie par l'utilisateur quand les cartes se suivent sur les mêmes fichiers ou qu'il teste tout le batch à la fin, liste Trello suffixée « (empilé) ») : chaque carte part de la **branche de la carte précédente** (`git fetch && git switch -c <branche> origin/<branche précédente>`) et sa PR **cible cette branche**, pour ne montrer que son propre diff. Une correction sur une PR amont se propage en mergeant la branche amont dans les suivantes (merge, jamais de rebase ni de force-push). En fin de batch, l'utilisateur teste PR par PR dans l'ordre ; après chaque merge sur `dev`, la PR suivante est reciblée sur `dev` (`gh pr edit <n> --base dev`) avant son test

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
- Liste "In progress" (`6ac7cbdc33212dd42717ae97`) : carte en cours de dev (PR en draft) — le dev l'y déplace au démarrage
- Liste "To review" (`6ac7cbcd30f2681d38594749`) : PR « ready for review » — revue du lead tech puis test utilisateur ; le dev l'y déplace au passage ready
- Liste "Done" (`6a4ec9b1939cbad2bfc0da8c`) : le lead tech y déplace la carte après le merge (avec l'entrée du journal)
- **Ordre des listes** : "Todo", "In progress", "To review" puis "Done" sont **toujours les quatre dernières listes** du board, dans cet ordre (listes ajoutées par l'utilisateur le 2026-10-08). Toute nouvelle liste (batch, épique, retours de PR, thème…) se crée **avant "Todo"** — vérifier les positions après création (l'API place une liste en fin de board par défaut)
- Listes "Batch — ..." : groupes de cartes à dev enchaîné sans confirmation/merge intermédiaire (voir règle "batch dev" ci-dessus) — créées à la discrétion de l'utilisateur, signal fiable = l'existence de la liste elle-même, pas de jugement à faire sur si des cartes hors liste sont "assez indépendantes" pour être enchaînées
- Listes "Pr \<numéro\>" : retours de QA sur une PR précise, une carte par retour, remplie par l'utilisateur pendant ses tests — à traiter en un seul passage groupé, un seul commit/push sur la PR existante, puis archiver la liste
- Liste "Amélioration UX/UI" (`6ac36b6a3a4c8db3a8272439`) : cartes issues de la passe UX/UI du 2026-10-05 — pas la sémantique "batch dev"
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
7. **Porte-monnaie événementiel** (Pagode Coupon) — épique multi-tenant (flag `evenements` désactivé par défaut), 13 cartes dans la liste Trello "Coupon", détail complet des décisions/revues dans `docs/journal-avancement.md`. **Promu en prod le 2026-10-08 (PR #212)**, flag `evenements` désactivé pour toutes les organisations ; cartes UX détail événement et RGPD livrées (Done) ; crédit manuel désormais activable par le super-admin seul. Avant d'activer `evenements` chez une vraie association : décision paiement (carte 6, contact HelloAsso en suspens), contrat de sous-traitance, politique de confidentialité, avis juridique. **État (2026-10-01)** : cartes 1, 2, 3 (spike temps réel — Broadcast + repli polling), 4, 5, 10, 11, 12 et 13 mergées (Done) — tout le périmètre dev non bloqué par le choix de prestataire est désormais livré (achat simulé démo, accès vendeur isolé, dashboard admin). Carte 12 (achat public simulé pour la démo MVP du 2026-10-02, PR #197 + correctif PR #198) : kill-switch `SIMULATION_PAIEMENT_ACTIVE` laissé **actif en continu sur staging depuis le 2026-10-01** (décision explicite utilisateur) — pas seulement autour de la démo, tant qu'on n'a pas attaqué la vraie brique de paiement (carte 6). Acceptable car le flag `evenements` reste désactivé par défaut et aujourd'hui seule l'organisation démo l'a activé. **Condition à surveiller** : revoir cette décision avant d'activer `evenements` sur une organisation réelle tant que le switch reste actif (achat gratuit illimité sinon, journal de mouvements immuable donc non nettoyable). Le bug email trouvé en revue (portefeuille crédité mais lien perdu si l'envoi échoue) a été corrigé (PR #198), donc plus de risque de portefeuille orphelin lié à l'usage prolongé. Carte 13 (accès vendeur distinct) a révélé en route un blocker sécurité pré-existant hors périmètre (`next_adherent_id_externe`/`next_participant_id_externe` sans garde d'organisation) — arbitré et corrigé dans la même PR. **Reste bloqué par la carte 6** (prestataire de paiement réel, choix non tranché, en attente côté utilisateur — confirmation Stripe, avis juridique) : cartes 7/8 (achat public réel, non simulé). **Carte 9 débloquée (2026-10-02)** : recadrée pour dépendre des cartes 1+4 (déjà livrées) plutôt que de la carte 8 — le modèle portefeuille/secret ne dépend pas du moyen de paiement, déjà exploitable via le flux simulé de la carte 12 ; prête à dev sans attendre la carte 6. Un point technique Gmail a été identifié à cette occasion (sujet d'email statique par événement → Gmail replie le contenu des emails répétés en conversation, y compris le lien du portefeuille) et doit être corrigé dans le même dev, sur l'email d'achat existant et celui de récupération (détail sur la carte Trello). **Carte 9 mergée (2026-10-05, PR #206)** : recadrée en cours de dev en renvoi de l'accès par un admin depuis le dashboard événement (le libre-service public a été abandonné), détail dans le journal. **Nouvelle carte [RGPD Coupon](https://trello.com/c/OJvbKKKV)** (2026-10-03, non bloquée, placée au-dessus des cartes 6/7/8) : l'effacement d'un acheteur est impossible par construction (journal immuable + clé étrangère sans cascade), aucune durée de conservation, aucune mention d'information sur les pages publiques — à solder avant d'activer `evenements` chez une vraie association. ⚠️ Les tarifs Stripe inscrits sur la carte 6 sont les tarifs **US** ; les tarifs France vérifiés sont 1,5 % + 0,25 € (carte standard EEE), et les frais ne sont **pas** rendus en cas de remboursement — ce qui touche la question ouverte du solde restant. Carte Backlog liée : [checklist de tests à rejouer sur test.samakan.fr](https://trello.com/c/En0Q5ofB) (angles morts cartes 4/10, scan caméra carte 5) — bon moment pour la rejouer, la plupart des blocages listés sont désormais levés. [Trello](https://trello.com/c/C9A5B9jr)
8. **Priorité 5 — Gestion abonnements/plans** — rattachée à la liste Trello "Business plan — Commercialisation", roadmap lointaine. [Trello](https://trello.com/c/cfKF8BNw)
9. **Amélioration UX/UI** — **soldée le 2026-10-10** (batchs design system, Navigation, Rôles + pages de liste, tous sur `dev`, à promouvoir). Liste Trello archivée ; détail dans `docs/journal-avancement.md`.

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
