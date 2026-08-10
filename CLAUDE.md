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

### Règles
- Toujours lire AVANT d'agir — ne pas redemander ce qui est déjà documenté
- Les blockers non résolus de la session précédente deviennent la priorité
- Quand un blocker est levé, le noter explicitement dans "Réalisé"

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
- Quand l'utilisateur informe qu'une PR est mergée, `checkout main` puis `pull` pour mettre la branche locale à jour avant de démarrer les développements suivants. Vérifier aussi à ce moment-là la liste "Todo" du board Trello "Mothana" (voir mémoire persistante) : identifier les cartes traitées par cette PR, les déplacer soi-même vers "Done" (le token a les droits d'écriture depuis le 2026-08-08), et signaler à l'utilisateur les cartes déplacées + toute nouvelle carte apparue depuis le dernier check, pour discuter d'éventuels nouveaux sujets

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

**Point de vigilance permanent** : les Edge Functions ne se déploient jamais automatiquement au push/merge sur ce projet — toujours `supabase functions deploy <nom>` explicitement après une édition de leur code (voir mémoire persistante).

**Limitation connue (non bloquante, décision utilisateur)** : les 4 fonctions RPC d'import échouent en mode super-admin "Consulter" (pas de `profils_organisation` dans ce contexte) — se connecter en admin normal pour tester les imports. Détail : `docs/journal-avancement.md`.

### ⏳ Backlog actif — ordre Trello (board "Mothana", voir mémoire persistante)

Le board Trello est la source de vérité unique du backlog (hors cartes "Action admin", gérées par l'utilisateur lui-même). Chaque carte cadrée a sa description Trello à jour avec le détail complet des décisions — vérifiée à chaque session, pas dupliquée ici. Confirmation explicite à redemander avant de démarrer le dev de l'une d'entre elles, même déjà cadrée.

1. **Revue UI responsive admin** (super admin + panel org, desktop/mobile) — cadré le 2026-08-08, débloqué par l'environnement staging (identifiants super admin dédiés disponibles). [Trello](https://trello.com/c/IeMDIOCx)
2. **Tooltip stylisé sur les placeholders** (templates Cerfa/carte adhérent/formulaire d'adhésion) — cadré le 2026-08-10, remplace le `title` natif par le composant `Tooltip.tsx` existant (adapté : pas de `<button>` imbriqué). [Trello](https://trello.com/c/SfQW9a3o)
3. **Réorganisation Paramètres** en sous-pages routées (même pattern que Dons/Adhérents) — cadré le 2026-08-08. [Trello](https://trello.com/c/p3FrYi70)
4. **Mire de connexion personnalisée par organisation** (admin + bénévole) — cadré le 2026-08-10, même mécanique que le formulaire d'adhésion (header/footer/css éditables, URL `/connexion/{slug}` et `/login/benevole/{slug}` réutilisant le slug existant). [Trello](https://trello.com/c/gkOuH3uh)
5. **Rapprochement chèques/virements** — pas cadré. [Trello](https://trello.com/c/DwPzxngO)
6. **Vérification carte adhérent par nom/prénom** (espace bénévole) — cadré le 2026-08-08. [Trello](https://trello.com/c/HbOvv6Kx)
7. **Pièces jointes sur un don** (justificatifs) — cadré le 2026-08-09 : table `dons_fichiers`, bucket Storage privé + URL signée, images/PDF 10 Mo max, upload côté admin (`DonModal`) et bénévole (`BenevolePage`). [Trello](https://trello.com/c/G1MFP7Ao)
8. **Double opt-in email** avant ratification d'une demande d'adhésion — cadré le 2026-08-08, nécessite un compte Resend (action utilisateur, prérequis externe). [Trello](https://trello.com/c/0gt0LIVU)
9. **Mailing Brevo** aux adhérents — cadré le 2026-08-08, nécessite un compte Brevo (action utilisateur, prérequis externe). [Trello](https://trello.com/c/bAaUGHj7)
10. **Priorité 4 — Envoi email des reçus fiscaux** — pas cadré, même dépendance Resend que le double opt-in ci-dessus. [Trello](https://trello.com/c/Do9GVjOt)
11. **OCR scan de carte adhérent** — pas encore cadré, discussion préliminaire seulement. [Trello](https://trello.com/c/zVBOjAWk)
12. **Sélection d'un adhérent à la saisie d'un don + doublonnement** — prio basse, hors scope V1 du module Adhérents, pas cadré. [Trello](https://trello.com/c/RtRY8ltX)
13. **Priorité 5 — Export FEC / intégrations comptables** — roadmap lointaine, pas cadrée. [Trello](https://trello.com/c/W3GCYUOt)
14. **Priorité 5 — Brique événements/coupons** (Pagode Coupon) — roadmap lointaine, pas cadrée. [Trello](https://trello.com/c/C9A5B9jr)
15. **Priorité 5 — Gestion abonnements/plans** — roadmap lointaine, pas cadrée. [Trello](https://trello.com/c/cfKF8BNw)
16. **Contrainte d'unicité `id_externe` par organisation sur les activités** — point non bloquant, pas cadré. [Trello](https://trello.com/c/WkPAb7K7)

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