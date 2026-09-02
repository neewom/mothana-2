# CLAUDE.md — Mothana (Gestion des dons)

Ce fichier est lu automatiquement par Claude Code à chaque session. Il contient le contexte du projet, les conventions à respecter, et l'état d'avancement.

---

## Session Continuity

### En début de session
- Chercher automatiquement le fichier de la dernière session dans `.claude/sessions/`
- Identifier où on s'est arrêté et les blockers en cours
- Résumer en 3 lignes avant de commencer
- Vérifier la liste "Todo" du board Trello "Mothana" (voir mémoire persistante pour les identifiants/credentials) — l'utilisateur y note à la volée ses demandes d'évolution. En cas de nouveauté (carte non présente dans le backlog de ce fichier), proposer de la cadrer pour l'inscrire dans "État d'avancement" / backlog ci-dessous
- Quand un sujet est cadré (que la carte Trello associée soit une nouveauté détectée ou un sujet déjà connu qu'on approfondit), alimenter la carte Trello correspondante avec le détail du cadrage (description), réécrire le titre si le libellé d'origine est devenu imprécis une fois le sujet creusé, et appliquer l'étiquette verte "cadré" (signal fiable, ne pas se fier uniquement à la présence d'une description)
- À ce même moment, reclasser les cartes de "Todo" par priorité/complexité (jugement de l'agent) : un sujet peu complexe peut remonter en haut de la liste, un sujet complexe redescend en général plus bas — sauf s'il est aussi sensible ou prioritaire, auquel cas il remonte malgré sa complexité
- Ce réflexe est aussi noté dans la mémoire persistante (MEMORY.md) pour qu'il s'applique même si ce fichier n'est pas relu

### En fin de session
- Sauvegarder un résumé dans `.claude/sessions/[date]_[sujet].md`
- Inclure : Réalisé, Reste à faire, Blockers, Décisions
- Si un fichier existe déjà pour aujourd'hui, le compléter plutôt que le remplacer
- Format du nom de fichier : `YYYY-MM-DD_sujet-en-kebab-case.md`
- Exemple : `2026-07-17_refonte-cerfa.md`
- **Déplacement Trello Done ↔ entrée `docs/journal-avancement.md` : action indissociable, jamais l'une sans l'autre.** Dès qu'une carte passe en Done (fin de sujet ou merge de PR), ajouter dans la même respiration l'entrée correspondante dans le journal (résumé + détail, cf. Instructions pour Claude Code point 4) — ne jamais différer à une session ultérieure (c'est exactement ce qui a créé une désynchro le 2026-08-15 : carte Trello "impeccable" en Done depuis le 2026-08-12 sans entrée correspondante, découverte seulement au check bidirectionnel 3 jours après ; règle mise à jour le 2026-09-02, la cible était alors la section "✅ Terminé" de ce fichier avant son retrait)

### Règles
- Toujours lire AVANT d'agir — ne pas redemander ce qui est déjà documenté
- Les blockers non résolus de la session précédente deviennent la priorité
- Quand un blocker est levé, le noter explicitement dans "Réalisé"
- **Avant toute action corrective sur une carte Trello jugée mal classée** (ex. carte en Done qui semble ne pas avoir été terminée, ou l'inverse) : `grep` l'URL/le nom de la carte sur **l'ensemble** de `.claude/sessions/*.md`, pas seulement le fichier de session le plus récent, pour reconstituer l'historique complet avant de conclure et d'agir — un sujet peut se refermer dans une session ultérieure à celle qui l'a initialement cadré

---

## Contexte du projet

Mothana est une application de gestion des dons pour associations. C'est un MVP fullstack (React + Supabase) construit à partir d'une maquette existante.

**Lire seulement si le sujet du jour s'y prête** (plus une lecture systématique en début de session depuis le 2026-09-02 — ces 5 docs pèsent ~68 Ko cumulés, à ne charger que si la tâche touche vraiment leur domaine) :
- `docs/cadrage-mothana.md` — spec fonctionnelle complète (tout nouveau sujet fonctionnel, pour vérifier qu'il n'est pas déjà tranché ou explicitement hors scope)
- `docs/schema-mothana.sql` — schéma SQL de référence (avant toute migration ou requête touchant une table pas encore rencontrée dans la session)
- `docs/plan-dev-mothana.md` — plan de développement (question de roadmap/priorisation long terme)
- `docs/regles-recus-fiscaux.md` — règles métier reçus fiscaux (tout dev touchant Cerfa/reçus fiscaux)
- `docs/brief-cerfa.md` — brief technique complet refonte Cerfa (référence si on retouche la génération de reçus)

---

## Stack technique

- **Frontend** : React + TypeScript + Vite, Tailwind CSS, React Router
- **Backend** : Supabase (PostgreSQL + Auth + Storage + Edge Functions)
- **Client JS** : `@supabase/supabase-js`
- **Hébergement** : Vercel Pro (frontend) + Supabase Pro (backend)
- **Génération PDF** : Gotenberg (HTML→PDF, à déployer sur Railway/Render ~5$/mois) — remplace pdf-lib

---

## Environnement de développement — ⚠️ règle critique

Claude Code tourne sur une machine dédiée où le projet est exposé sur le réseau via une instance **permanente** `npm run dev` (port 5173) — c'est cette URL que l'utilisateur utilise pour piloter/vérifier le travail à distance (MacBook ou smartphone). Cette instance ne doit **jamais** être interrompue par l'agent.

- **Ne jamais faire `pkill -f vite`** (ou tout kill par nom de processus) — ça tue l'instance permanente de l'utilisateur, pas seulement une instance de test lancée par l'agent
- Pour des vérifications visuelles (Playwright/screenshots), **réutiliser l'instance déjà en cours sur `http://localhost:5173`** plutôt que d'en lancer une nouvelle — les changements de fichiers sont pris en compte automatiquement (HMR Vite)
- Si un test nécessite exceptionnellement une route/fichier temporaire (ex: harnais de test pour un composant), l'ajouter, tester via l'instance existante, puis le retirer avant de commiter — sans jamais démarrer ni arrêter de processus `npm run dev`/`vite`
- Si une instance séparée est vraiment nécessaire, la lancer sur un port dédié différent et ne l'arrêter que par PID exact (jamais par pattern de nom)
- Skill `.claude/skills/webapp-testing/` disponible pour les vérifications navigateur (Playwright Python) — son propre helper `scripts/with_server.py` sait démarrer/arrêter un serveur, mais **ne pas l'utiliser dans ce projet** puisqu'une instance tourne déjà en permanence : suivre la branche "serveur déjà en cours → reconnaissance puis action" de son arbre de décision, jamais la branche "démarrer un serveur"

---

## Modèle d'authentification

**Super-Admin** : `is_super_admin = true` dans `app_metadata` auth.users → `/super-admin`
**Admin** : Supabase Auth email/password → dashboard organisation via `profils_organisation`
**Bénévole** : PIN → Edge Function `verify-pin` → `signInWithPassword` compte technique `benevole-{org_id}@mothana.internal`

⚠️ Pas de table `utilisateurs_app` — tout via `auth.users` Supabase
⚠️ JWT custom abandonné (RS256 incompatible HS256)

---

## Schéma de données

Référence complète et à jour (toutes les tables, colonnes, contraintes) : `docs/schema-mothana.sql`. Points non évidents à la simple lecture des colonnes :

- `personnes.civilite` (smallint) : 1=Monsieur 2=Madame 3=Mademoiselle 4=Foyer 5=Société 6=Association 7=Famille — 0/255→NULL
- `adherents.civilite` (smallint réduit, enum **distinct** de celui de `personnes`) : 0=non défini, 1=Monsieur, 2=Madame — pas de personne morale/famille adhérente pour l'instant
- `profils_participant.id_externe` = IDFideles (import legacy, seulement rempli pour les participants importés) — ne pas l'utiliser comme numéro de donateur générique
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

---

## Sécurité — règles absolues

- Sécurité via **RLS Supabase**, pas uniquement côté frontend
- Ne jamais exposer la clé `service_role` côté client
- Ne jamais commiter `.env`

---

## Git — workflow

Règles génériques (ne jamais merger sans confirmation, vérifier les PR ouvertes avant de démarrer, corriger un blocage trouvé en testant dans la même PR, ouvrir une PR dès qu'un dev est jugé terminé) : voir `~/.claude/CLAUDE.md`, valables sur tous les projets.

Spécifique à Mothana :
- Quand l'utilisateur informe qu'une PR de feature est mergée (cible `dev`), `checkout dev` puis `pull` pour mettre la branche locale à jour avant de démarrer les développements suivants — `checkout main`/`pull` seulement après une promotion `dev` → `main` (voir plus bas). Vérifier aussi à ce moment-là la liste "Todo" du board Trello "Mothana" (voir mémoire persistante) : identifier les cartes traitées par cette PR, les déplacer soi-même vers "Done" (le token a les droits d'écriture depuis le 2026-08-08), et signaler à l'utilisateur les cartes déplacées + toute nouvelle carte apparue depuis le dernier check, pour discuter d'éventuels nouveaux sujets — vérification **bidirectionnelle** (voir mémoire persistante), pas seulement un scan des nouvelles cartes
- **Branche `dev` (depuis le 2026-08-15, environnement de recette)** : les PR de features ciblent désormais `dev`, plus `main` directement. `main` ne reçoit que des promotions depuis `dev` (une feature à la fois, pas de lot) — c'est ce merge `dev → main`, pas le merge feature→`dev`, qui déclenche migrations Supabase + déploiement Edge Function en prod. Détail complet : `docs/environnement-recette.md`. **`CLAUDE.md` n'a plus de règle spéciale** (revu le 2026-08-21, après une dérive constatée entre les deux branches causée par cette exception) : il s'édite comme n'importe quel fichier, sur `dev`, et suit le flux normal de promotion vers `main` — `main` peut donc être temporairement en retard de quelques jours sur le backlog/l'historique documenté entre deux promotions, sans conséquence puisque `CLAUDE.md` n'est pas exécutable (pas de migration/déploiement en jeu).
- **Promotion `dev` → `main` via PR GitHub (depuis le 2026-08-15)** : `git merge` direct bloqué par le classifier auto-mode sur des actions jugées sensibles sur `main` — la promotion passe donc par `gh pr create` (base `main`, head `dev`) puis `gh pr merge --merge` (commit de fusion, jamais `--squash`/`--rebase`, pour garder l'équivalent `--no-ff`). Exception scopée à *cette* PR de promotion : sur confirmation explicite de l'utilisateur pour démarrer la promotion, l'agent peut créer **et** merger cette PR sans redemander — pas de re-review de contenu à ce stade (déjà validé au merge feature→dev). Ne s'applique **pas** aux PR de feature classiques (feature→`dev`), qui restent soumises à la règle standard "jamais merger sans autorisation explicite" (`~/.claude/CLAUDE.md`).
  - ⚠️⚠️⚠️ **NE JAMAIS laisser `gh pr merge` supprimer la branche `dev`** (option par défaut sur une PR de feature, à désactiver explicitement ici — `--delete-branch=false` ou décocher dans le flux interactif). `dev` est une branche **permanente**, pas une branche de feature jetable : la recette (`test.samakan.fr`) et les variables d'environnement Vercel scopées y sont rattachées par son *nom*. Une suppression basculerait silencieusement la recette sur les identifiants **prod**, sans erreur visible. ⚠️⚠️⚠️

---

## État d'avancement

Historique complet des sujets terminés (détail des décisions techniques, bugs trouvés en testant, PR associées) : `docs/journal-avancement.md` — à lire seulement en cas de besoin d'archéologie sur une décision passée, pas systématiquement.

### ✅ Terminé

Historique complet déplacé dans `docs/journal-avancement.md` le 2026-09-02 (dernier sujet archivé : "Rollout shadcn/ui — DonsPage", PR #117, terminé 2026-09-01). Pour le rattrapage court terme en début de session, se fier au fichier de session le plus récent dans `.claude/sessions/` (déjà lu automatiquement, cf. Session Continuity) plutôt qu'à cette section — elle ne contient donc plus d'historique, seulement les notes actives ci-dessous.

**Point de vigilance permanent** : les Edge Functions ne se déploient jamais automatiquement au push/merge sur ce projet — toujours `supabase functions deploy <nom>` explicitement après une édition de leur code (voir mémoire persistante).

**Limitation connue (non bloquante, décision utilisateur)** : les 4 fonctions RPC d'import échouent en mode super-admin "Consulter" (pas de `profils_organisation` dans ce contexte) — se connecter en admin normal pour tester les imports. Même limitation confirmée le 2026-08-22 sur les Edge Functions reçus fiscaux (`generate-recu`, `send-recu-email`) : contrôle d'accès basé uniquement sur `profils_organisation` de l'utilisateur authentifié, sans tenir compte de `viewingOrgId`. Décision explicite de l'utilisateur : laisser tel quel plutôt que de faire évoluer le contrôle d'accès. Détail : `docs/journal-avancement.md`.

### ⏳ Backlog actif — ordre Trello (board "Mothana", voir mémoire persistante)

Le board Trello est la source de vérité unique du backlog (hors cartes "Action admin", gérées par l'utilisateur lui-même) — description à jour sur chaque carte cadrée avec le détail complet des décisions, relue à chaque session. Liste ci-dessous volontairement réduite à titre + statut + lien depuis le 2026-09-02 (le détail dupliquait la description Trello sans plus-value — cf. la règle de cadrage en début de session qui alimente déjà la carte). Ordre = priorité/complexité (jugement agent), pas l'ordre d'ajout. Confirmation explicite à redemander avant de démarrer le dev de l'une d'entre elles, même déjà cadrée.

1. **Audit mobile : masquer les colonnes redondantes avec la vue détail** (Dons, Participants) — cadré. [Trello](https://trello.com/c/QH2dLvfT)
2. **Support multi-organisation pour un compte admin** (rattachement + sélecteur) — cadré, dev reporté à plus tard (décision explicite utilisateur). [Trello](https://trello.com/c/WtLrSLGW)
3. **Vraie documentation utilisateur (guides / FAQ)** — pas encore cadré. [Trello](https://trello.com/c/5pwUxgqA)
4. **`agents.md` calqués sur `CLAUDE.md`** (switch Codex ↔ Claude Code) — pas encore cadré. [Trello](https://trello.com/c/0XmhK0iv)
5. **Mire de connexion personnalisée par organisation** (admin + bénévole) — cadré. [Trello](https://trello.com/c/gkOuH3uh)
6. **Pièces jointes sur un don** (justificatifs) — cadré. [Trello](https://trello.com/c/G1MFP7Ao)
7. **Double opt-in email** avant ratification d'une demande d'adhésion — cadré. [Trello](https://trello.com/c/0gt0LIVU)
8. **Modèles réutilisables pour les campagnes mailing** — cadré. [Trello](https://trello.com/c/BfHOUb3v)
9. **Switches d'activation de fonctionnalités par organisation** (Dons / Adhérents) — cadré, pas urgent. [Trello](https://trello.com/c/1tNWFQr9)
10. **Suppression d'organisation : étape d'archivage intermédiaire** — cadré. [Trello](https://trello.com/c/Z0kThckV)
11. **Sélection d'un adhérent à la saisie d'un don + doublonnement** — prio basse (explicite), cadrage volontairement léger. [Trello](https://trello.com/c/RtRY8ltX)
12. **OCR scan de carte adhérent** — pas encore cadré. [Trello](https://trello.com/c/zVBOjAWk)
13. **Priorité 5 — Export comptable enrichi** — recadré, roadmap lointaine. [Trello](https://trello.com/c/W3GCYUOt)
14. **Priorité 5 — Brique événements/coupons + portefeuille virtuel** (Pagode Coupon) — clarifié, prérequis (inspection projet Supabase "pagode-coupon") avant cadrage technique. [Trello](https://trello.com/c/C9A5B9jr)
15. **Priorité 5 — Gestion abonnements/plans** (facturation Samakan) — clarifié, roadmap lointaine. [Trello](https://trello.com/c/cfKF8BNw)

**Carte supprimée du board le 2026-08-26** (constatée disparue en début de session, hors session Claude Code, décision utilisateur de ne pas la recréer) : "Ajouter des contraintes de saisie de mot de passe dans la page reset password".

**2 cartes archivées le 2026-08-25** (besoin déjà couvert / fusionné, pas de dev séparé) : "Mailing : envoyer à des listes personnalisées" (fusionnée dans la carte 1 ci-dessus) et "Cerfa : éditer les cerfa des années précédentes" (le sélecteur d'année permet déjà de générer/régénérer jusqu'à 3 ans en arrière).

**Carte clôturée le 2026-08-20** (besoin déjà couvert, pas de nouveau dev) : "Contrainte d'unicité `id_externe` par organisation sur les activités" — la contrainte existe déjà en prod (`activites_organisation_id_externe_unique`, migration `import_id_externe_unique_constraints.sql`), confirmé par requête directe sur la base. Déplacée en Done sur Trello.

---

## Instructions pour Claude Code

1. **Lire ce fichier en entier** avant toute action
2. **Chercher le fichier de session du jour** dans `.claude/sessions/` avant de commencer
3. Pas de brief dédié pour la priorité en cours (`docs/brief-cerfa.md` était spécifique à la refonte Cerfa, terminée depuis 2026-07-18) — s'appuyer sur le dernier fichier de session (`.claude/sessions/`) et l'ordre du backlog Trello pour identifier le sujet actif
4. **Mettre à jour "État d'avancement"** après chaque étape complétée — ajouter l'entrée (résumé + détail : décisions, bugs trouvés en testant) directement dans `docs/journal-avancement.md`, plus besoin de doublon dans `CLAUDE.md` (section "✅ Terminé" retirée le 2026-09-02, le rattrapage court terme se fait via le fichier de session le plus récent, lu automatiquement en début de session)
5. **Sauvegarder un résumé de session** dans `.claude/sessions/` en fin de session
6. **Ne jamais sauter d'étape** sans validation explicite
7. **Demander confirmation** en cas de doute fonctionnel ou technique
8. **Demander confirmation explicite avant de démarrer le dev** d'une carte ou d'un sujet, même déjà cadré — ne pas enchaîner automatiquement après le merge d'une PR précédente (règle renforcée par rapport au défaut global, sur ce projet on redemande systématiquement, pas seulement en cas de doute sur la fraîcheur de l'accord)

Règles génériques valables sur tous les projets ("un sujet à la fois", ne pas présumer qu'un accord ancien tient toujours, continuité entre sessions) : voir `~/.claude/CLAUDE.md`.