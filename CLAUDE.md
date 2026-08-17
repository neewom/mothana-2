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
- **Déplacement Trello Done ↔ résumé "Terminé" de ce fichier : action indissociable, jamais l'une sans l'autre.** Dès qu'une carte passe en Done (fin de sujet ou merge de PR), ajouter dans la même respiration l'entrée résumé correspondante dans "État d'avancement" ci-dessous — ne jamais différer à une session ultérieure (c'est exactement ce qui a créé une désynchro le 2026-08-15 : carte Trello "impeccable" en Done depuis le 2026-08-12 sans entrée correspondante dans ce fichier, découverte seulement au check bidirectionnel 3 jours après)

### Règles
- Toujours lire AVANT d'agir — ne pas redemander ce qui est déjà documenté
- Les blockers non résolus de la session précédente deviennent la priorité
- Quand un blocker est levé, le noter explicitement dans "Réalisé"
- **Avant toute action corrective sur une carte Trello jugée mal classée** (ex. carte en Done qui semble ne pas avoir été terminée, ou l'inverse) : `grep` l'URL/le nom de la carte sur **l'ensemble** de `.claude/sessions/*.md`, pas seulement le fichier de session le plus récent, pour reconstituer l'historique complet avant de conclure et d'agir — un sujet peut se refermer dans une session ultérieure à celle qui l'a initialement cadré

---

## Contexte du projet

Mothana est une application de gestion des dons pour associations. C'est un MVP fullstack (React + Supabase) construit à partir d'une maquette existante.

**Lire impérativement avant toute action :**
- `docs/cadrage-mothana.md` — spec fonctionnelle complète
- `docs/schema-mothana.sql` — schéma SQL de référence
- `docs/plan-dev-mothana.md` — plan de développement
- `docs/regles-recus-fiscaux.md` — règles métier reçus fiscaux (Cerfa)
- `docs/brief-cerfa.md` — brief technique complet refonte Cerfa (priorité en cours)

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
- Quand l'utilisateur informe qu'une PR est mergée, `checkout main` puis `pull` pour mettre la branche locale à jour avant de démarrer les développements suivants. Vérifier aussi à ce moment-là la liste "Todo" du board Trello "Mothana" (voir mémoire persistante) : identifier les cartes traitées par cette PR, les déplacer soi-même vers "Done" (le token a les droits d'écriture depuis le 2026-08-08), et signaler à l'utilisateur les cartes déplacées + toute nouvelle carte apparue depuis le dernier check, pour discuter d'éventuels nouveaux sujets — vérification **bidirectionnelle** (voir mémoire persistante), pas seulement un scan des nouvelles cartes
- **Branche `dev` (depuis le 2026-08-15, environnement de recette)** : les PR de features ciblent désormais `dev`, plus `main` directement. `main` ne reçoit que des promotions depuis `dev` (une feature à la fois, pas de lot) — c'est ce merge `dev → main`, pas le merge feature→`dev`, qui déclenche migrations Supabase + déploiement Edge Function en prod. Détail complet : `docs/environnement-recette.md`. Les commits de documentation pure (`CLAUDE.md`, résumés de session) restent une exception assumée, toujours directs sur `main` — **mais** doivent être immédiatement resynchronisés sur `dev` juste après (`git merge main` sur `dev`, pas de gating puisque c'est de la doc pure, pas de migration/déploiement déclenché), même règle que le cas "hotfix direct sur `main`" de `docs/environnement-recette.md` — évite que `dev` (branche de travail des features suivantes, relue en début de session) prenne du retard sur `CLAUDE.md`.
- **Promotion `dev` → `main` via PR GitHub (depuis le 2026-08-15)** : `git merge` direct bloqué par le classifier auto-mode sur des actions jugées sensibles sur `main` — la promotion passe donc par `gh pr create` (base `main`, head `dev`) puis `gh pr merge --merge` (commit de fusion, jamais `--squash`/`--rebase`, pour garder l'équivalent `--no-ff`). Exception scopée à *cette* PR de promotion : sur confirmation explicite de l'utilisateur pour démarrer la promotion, l'agent peut créer **et** merger cette PR sans redemander — pas de re-review de contenu à ce stade (déjà validé au merge feature→dev). Ne s'applique **pas** aux PR de feature classiques (feature→`dev`), qui restent soumises à la règle standard "jamais merger sans autorisation explicite" (`~/.claude/CLAUDE.md`).
  - ⚠️⚠️⚠️ **NE JAMAIS laisser `gh pr merge` supprimer la branche `dev`** (option par défaut sur une PR de feature, à désactiver explicitement ici — `--delete-branch=false` ou décocher dans le flux interactif). `dev` est une branche **permanente**, pas une branche de feature jetable : la recette (`test.samakan.fr`) et les variables d'environnement Vercel scopées y sont rattachées par son *nom*. Une suppression basculerait silencieusement la recette sur les identifiants **prod**, sans erreur visible. ⚠️⚠️⚠️

---

## État d'avancement

Historique complet des sujets terminés (détail des décisions techniques, bugs trouvés en testant, PR associées) : `docs/journal-avancement.md` — à lire seulement en cas de besoin d'archéologie sur une décision passée, pas systématiquement.

### ✅ Terminé (résumé — détail dans le journal)

- MVP + Post-MVP (étapes 0–9, comptes admin, imports, pagination, accessibilité modales…)
- **Priorité 1 — Refonte Cerfa** (terminée 2026-07-18) : migrations, paramètres organisation, templates HTML par défaut, edge function `generate-recu` (Gotenberg), UI reçus fiscaux, gestion des templates. Brief technique complet : `docs/brief-cerfa.md`
- **Priorité 3 — Wizard de template Cerfa** (terminée 2026-07-20) : upload PDF → Claude Vision → brouillon HTML/CSS dans l'éditeur Monaco. Assets par organisation (liste ouverte) + placeholders président (PR #35)
- **Priorité 2 — Export comptable** (partiel) : export CSV dons, tableau de bord `/admin/comptabilite`, récapitulatif déclaratif article 222 bis CGI. Reste : rapprochement chèques/virements (jamais cadré)
- Backlog 2026-07-25 (5 items, PR #31→#34) : affichage dons participant, perf Wat Velouvanaram (RLS `auth_rls_initplan`), recherche + pagination activités, réaffectation de don (blocage si reçu déjà émis)
- **Module Adhérents V1** (terminé 2026-08-04, PR #36→#39) : navigation (dashboard + section Adhérents), formulaire/liste/import, gabarit carte adhérent + planche A4. Item 6 (sélection d'un adhérent à la saisie d'un don) explicitement hors scope, backlog actif ci-dessous
- Recherche adhérents par email + `id_externe` auto-incrémenté (PR #47/#48)
- Log des modifications (`journal_modifications`) + motif de refus demande d'adhésion (PR #49)
- Marathon Trello 2026-08-08 : CTA ratifier/refuser (PR #50), lignes de tableau cliquables — **convention actée pour tout nouveau tableau du même type** (PR #51), validation date de naissance adhérent (PR #52), débordement impression cartes adhérent (PR #53), message de succès formulaire d'adhésion (PR #54)
- **Environnement staging Supabase** (terminé 2026-08-10) : projet `mothana-staging` séparé de prod, schéma/Edge Functions/secrets répliqués, comptes de test créés, workflow dump/restore par sujet documenté dans `docs/environnement-staging.md`. Bug corrigé au passage : création d'organisation cassée en prod depuis le 2026-08-05 (`organisations.slug` non renseigné)
- **Revue UI responsive admin** (terminée 2026-08-11, PR #57) : 6 débordements mobile corrigés (table SuperAdminPage, header dupliqué dans 5 modales/pages, champ slug Paramètres), audit Playwright systématique 3 largeurs + données de test réalistes injectées dans "Association Démo Staging" (staging, conservées pour les prochains audits). Skill design QA `impeccable` (pbakaus/impeccable) installé en scope utilisateur au passage
- **Revue UI responsive admin avec le skill impeccable** (terminée 2026-08-12, PR #58) : `PRODUCT.md`/`DESIGN.md` générés (init + document), extraction `SectionHeader.tsx` (5 fichiers dupliqués), balayage exhaustif Playwright (débordement 320/390/768/1440px sur 9 pages admin + super-admin + bénévole + 20+ modales + 3 pages publiques) et axe-core WCAG AA (0 violation après correctifs contraste texte 113 occurrences/38 fichiers + labels de formulaire manquants). Détail complet sur la [carte Trello](https://trello.com/c/0cgE88pI)
- **Campagnes de mailing Brevo** (terminée 2026-08-15, PR #62) : config Brevo par organisation (clé API + expéditeur), page `/admin/adherents/mailing` (composition TipTap gras/lien/placeholders `{{params.prenom}}`/`{{params.nom}}`, pièce jointe 10 Mo max transmise en base64, filtre destinataires actif/archivé/tous, confirmation avant envoi, brouillon persistant en localStorage, historique), Edge Function `send-mailing-brevo` (mode batch natif Brevo `messageVersions`, jusqu'à 1000 destinataires/appel)
- **Tooltip stylisé sur les placeholders** (terminée, PR #59) : remplace le `title` natif par `Tooltip.tsx` (prop `bare` ajouté) sur les 3 éditeurs de template (Cerfa, carte adhérent, formulaire d'adhésion)
- **Réorganisation Paramètres** (terminée, PR #60) : 4 sous-pages routées (`/admin/parametres`, `/fiscal`, `/adherents`, `/suivi`), composant partagé `ParametresSection.tsx`
- **Environnement de recette** (terminé 2026-08-15) : `test.samakan.fr` (branche `dev`, réutilise le projet Supabase `mothana-staging`, isolation par organisation dédiée par client), nouveau workflow git `dev`→`main` pour la promotion vers prod. Détail complet : `docs/environnement-recette.md`
- **Email d'invitation admin + mot de passe oublié via Resend** (terminé 2026-08-15, PR #63 dev, PR #64 promotion prod) : `create-admin` génère un lien d'invitation (`auth.admin.generateLink`) au lieu d'un mot de passe en clair, nouvelle Edge Function `request-password-reset` (réponse générique anti-énumération), les deux envoyées via Resend (template HTML Mothana). Un seul compte Resend pour dev/recette/prod (domaine `samakan.fr` vérifié). Validé de bout en bout sur la recette avant promotion

**Point de vigilance permanent** : les Edge Functions ne se déploient jamais automatiquement au push/merge sur ce projet — toujours `supabase functions deploy <nom>` explicitement après une édition de leur code (voir mémoire persistante).

**Limitation connue (non bloquante, décision utilisateur)** : les 4 fonctions RPC d'import échouent en mode super-admin "Consulter" (pas de `profils_organisation` dans ce contexte) — se connecter en admin normal pour tester les imports. Détail : `docs/journal-avancement.md`.

### ⏳ Backlog actif — ordre Trello (board "Mothana", voir mémoire persistante)

Le board Trello est la source de vérité unique du backlog (hors cartes "Action admin", gérées par l'utilisateur lui-même). Chaque carte cadrée a sa description Trello à jour avec le détail complet des décisions — vérifiée à chaque session, pas dupliquée ici. Confirmation explicite à redemander avant de démarrer le dev de l'une d'entre elles, même déjà cadrée.

1. **Rapprochement chèques/virements** — pas cadré. [Trello](https://trello.com/c/DwPzxngO)
2. **Vérification carte adhérent par nom/prénom** (espace bénévole) — cadré le 2026-08-08. [Trello](https://trello.com/c/HbOvv6Kx)
3. **Pièces jointes sur un don** (justificatifs) — cadré le 2026-08-09 : table `dons_fichiers`, bucket Storage privé + URL signée, images/PDF 10 Mo max, upload côté admin (`DonModal`) et bénévole (`BenevolePage`). [Trello](https://trello.com/c/G1MFP7Ao)
4. **Double opt-in email** avant ratification d'une demande d'adhésion — cadré le 2026-08-08. Prérequis Resend désormais levé (compte en place depuis le 2026-08-15). [Trello](https://trello.com/c/0gt0LIVU)
5. **Priorité 4 — Envoi email des reçus fiscaux** — pas cadré. Prérequis Resend désormais levé (compte en place depuis le 2026-08-15). [Trello](https://trello.com/c/Do9GVjOt)
6. **OCR scan de carte adhérent** — pas encore cadré, discussion préliminaire seulement. [Trello](https://trello.com/c/zVBOjAWk)
7. **Sélection d'un adhérent à la saisie d'un don + doublonnement** — prio basse, hors scope V1 du module Adhérents, pas cadré. [Trello](https://trello.com/c/RtRY8ltX)
8. **Priorité 5 — Export FEC / intégrations comptables** — roadmap lointaine, pas cadrée. [Trello](https://trello.com/c/W3GCYUOt)
9. **Priorité 5 — Brique événements/coupons** (Pagode Coupon) — roadmap lointaine, pas cadrée. [Trello](https://trello.com/c/C9A5B9jr)
10. **Priorité 5 — Gestion abonnements/plans** — roadmap lointaine, pas cadrée. [Trello](https://trello.com/c/cfKF8BNw)
11. **Contrainte d'unicité `id_externe` par organisation sur les activités** — point non bloquant, pas cadré. [Trello](https://trello.com/c/WkPAb7K7)
12. **Nettoyer la dette lint** (32 erreurs/avertissements pré-existants, +5 depuis, cf. `react-hooks/set-state-in-effect`) — pas cadré. [Trello](https://trello.com/c/dep6US2K)
13. **Mire de connexion personnalisée par organisation** (admin + bénévole) — cadré le 2026-08-10, même mécanique que le formulaire d'adhésion (header/footer/css éditables, URL `/connexion/{slug}` et `/login/benevole/{slug}` réutilisant le slug existant). [Trello](https://trello.com/c/gkOuH3uh)
14. **Ajouter samakan.fr (apex + www) comme domaine personnalisé de la prod sur Vercel** — cadré le 2026-08-17 : action manuelle (Vercel Settings→Domains puis DNS OVH, comme `test.samakan.fr`), apex+www servent la prod directement, `mothana.vercel.app` coexiste sans redirection. Débloque le renommage Samakan ci-dessous. [Trello](https://trello.com/c/sphiwiCT)
15. **Renommage public en "Samakan"** (nom de projet Mothana inchangé) — cadré, détail à vérifier dans la carte. [Trello](https://trello.com/c/pmLDyy2t)
16. **Modèles réutilisables pour les campagnes mailing** — évoqué le 2026-08-14, pas cadré. [Trello](https://trello.com/c/BfHOUb3v)
17. **Aspect légal du mailing** (RGPD, opt-out, page de désinscription) — nouvelle carte détectée le 2026-08-15, pas cadrée. [Trello](https://trello.com/c/e3aJfN3l)
18. **Bandeau visuel distinguant l'environnement recette de la prod** — créée le 2026-08-15 (idée annexe au cadrage de l'environnement de recette), pas cadrée. [Trello](https://trello.com/c/hSogRI1Y)
19. **Configurer le contenu des mails de création de compte / reset password** — nouvelle carte détectée le 2026-08-15, pas cadrée. [Trello](https://trello.com/c/Qf8mdFTz)

---

## Instructions pour Claude Code

1. **Lire ce fichier en entier** avant toute action
2. **Chercher le fichier de session du jour** dans `.claude/sessions/` avant de commencer
3. **Suivre `docs/brief-cerfa.md`** pour la priorité en cours
4. **Mettre à jour "État d'avancement"** après chaque étape complétée — un résumé court dans `CLAUDE.md` (un item de la liste "✅ Terminé"), le détail complet (décisions, bugs trouvés en testant) va dans `docs/journal-avancement.md` plutôt que dans `CLAUDE.md`, pour garder ce fichier léger
5. **Sauvegarder un résumé de session** dans `.claude/sessions/` en fin de session
6. **Ne jamais sauter d'étape** sans validation explicite
7. **Demander confirmation** en cas de doute fonctionnel ou technique
8. **Demander confirmation explicite avant de démarrer le dev** d'une carte ou d'un sujet, même déjà cadré — ne pas enchaîner automatiquement après le merge d'une PR précédente (règle renforcée par rapport au défaut global, sur ce projet on redemande systématiquement, pas seulement en cas de doute sur la fraîcheur de l'accord)

Règles génériques valables sur tous les projets ("un sujet à la fois", ne pas présumer qu'un accord ancien tient toujours, continuité entre sessions) : voir `~/.claude/CLAUDE.md`.