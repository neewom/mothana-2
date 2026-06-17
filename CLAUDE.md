# CLAUDE.md — Mothana (Gestion des dons)

Ce fichier est lu automatiquement par Claude Code à chaque session. Il contient le contexte du projet, les conventions à respecter, et l'état d'avancement.

---

## Contexte du projet

Mothana est une application de gestion des dons pour associations. C'est un MVP fullstack (React + Supabase) construit à partir d'une maquette existante.

**Lire impérativement avant toute action :**
- `docs/cadrage-mothana.md` — spec fonctionnelle complète (écrans, modèle de données, auth, règles métier)
- `docs/schema-mothana.sql` — schéma SQL de référence (déjà exécuté sur Supabase)
- `docs/plan-dev-mothana.md` — plan de développement en 9 étapes, à suivre dans l'ordre

---

## Stack technique

- **Frontend** : React + TypeScript + Vite
- **Style** : Tailwind CSS (style shadcn/ui, cohérent avec la maquette)
- **Routing** : React Router
- **Backend / BDD** : Supabase (PostgreSQL + Auth + Storage + Edge Functions)
- **Client JS** : `@supabase/supabase-js`

---

## Structure du projet

```
mothana-app/
├── docs/                        # Documents de cadrage (ne pas modifier)
│   ├── cadrage-mothana.md
│   ├── schema-mothana.sql
│   └── plan-dev-mothana.md
├── supabase/
│   └── functions/
│       └── verify-pin/          # Edge Function auth bénévole (déployée)
├── src/
│   ├── lib/
│   │   └── supabaseClient.ts    # Client Supabase initialisé
│   ├── components/              # Composants réutilisables
│   ├── pages/                   # Pages principales (une par route)
│   └── main.tsx
├── .env                         # Variables d'environnement (jamais commité)
├── .env.example                 # Template sans valeurs sensibles
└── CLAUDE.md                    # Ce fichier
```

---

## Variables d'environnement

Le fichier `.env` à la racine contient :
```
VITE_SUPABASE_URL=https://bocqfdhmxmleracrwvbu.supabase.co
VITE_SUPABASE_ANON_KEY=<clé publishable>
```

La clé `service_role` (Secret) n'est **jamais** dans le code — elle est configurée directement comme secret Supabase Edge Function.

---

## Conventions de code

- **Langue** : code en anglais (noms de variables, fonctions, commentaires), UI en français
- **Composants** : PascalCase, un fichier par composant
- **Hooks custom** : préfixe `use`, dans `src/hooks/`
- **Types TypeScript** : dans `src/types/`, toujours typer les réponses Supabase
- **Pas de `any`** sauf cas exceptionnel justifié en commentaire
- **Réutilisation** : le formulaire de saisie de don est un composant unique réutilisé dans le dashboard, la fiche participant, et l'écran bénévole

---

## Sécurité — règles absolues

- La sécurité repose sur les **RLS Supabase** (Row Level Security), pas uniquement sur des vérifications côté frontend
- Ne jamais exposer la clé `service_role` côté client
- Ne jamais commiter `.env` (vérifier que `.gitignore` l'exclut)

---

## Modèle d'authentification

Trois niveaux d'accès, choisis depuis la page d'accueil :

**Super-Admin** (email/mot de passe via Supabase Auth)
- Identifié par `is_super_admin = true` dans `app_metadata` de `auth.users` (pas de table custom)
- Accès au dashboard super-admin (`/super-admin`) : vue globale toutes organisations, CRUD organisations, gestion des comptes admin
- Bypass total des RLS — voit toutes les données de toutes les organisations
- Rôle réservé à l'éditeur de la plateforme (Mothana)
- Après connexion, redirigé vers `/super-admin` au lieu du dashboard organisation
- SQL pour promouvoir un super-admin :
  ```sql
  update auth.users set raw_app_meta_data = raw_app_meta_data || '{"is_super_admin": true}'::jsonb where email = 'email';
  ```
- Lisible dans les RLS via : `(auth.jwt() -> 'app_metadata' ->> 'is_super_admin')::boolean = true`
- ⚠️ Pas de table `utilisateurs_app` — les comptes sont gérés directement via `auth.users` Supabase

**Admin** (email/mot de passe via Supabase Auth)
- Accès complet au dashboard et tous les CRUDs de son organisation uniquement
- Organisation déterminée via `profils_organisation`

**Bénévole** (code PIN partagé par organisation)
- ⚠️ L'approche JWT custom a été abandonnée : le projet Supabase utilise RS256, incompatible avec HS256.
- **Approche actuelle : compte Supabase Auth technique par organisation**
  - Email : `benevole-[organisation_id]@mothana.internal`, mot de passe = le PIN
  - `verify-pin` Edge Function : vérifie le PIN → `signInWithPassword` → retourne la session native
  - `app_metadata: { role: 'benevole', organisation_id }` — utilisé par `current_benevole_organisation_id()` dans les RLS
  - Quand le PIN change (étape 7), le mot de passe du compte est mis à jour via `admin.updateUserById`

---

## État d'avancement

### ✅ Terminé
- Étape 0.a (utilisateur) : projet Supabase créé, SQL exécuté, compte admin créé, clés récupérées
- Étape 0.b (code) : projet React/Vite/Tailwind initialisé, client Supabase configuré, routes squelette en place
- Étape 1 : page d'accueil Admin/Bénévole, flux auth admin, gestion de session, routes protégées, déconnexion
- Étape 2 : dashboard dons complet (stats, tableau, filtres, panneau détail, CRUD don)
- Étape 3 : page Participants (liste + recherche + total dons), panneau détail (infos + historique + ajout don pré-sélectionné), modal ajout/édition (création simultanée `personnes` + `profils_participant`), `DonModal` accepte `defaultParticipantId`
- Étape 4 : page Activités (liste, ajout, édition, suppression avec vérification dons liés). Bug RLS `personnes` corrigé.
- Étape 5 : écran bénévole (layout minimaliste, autocomplete participant, création rapide inline, formulaire don, confirmation visuelle, overlay PIN). Auth bénévole refactorisée : compte Auth technique `benevole-{org_id}@mothana.internal`, `signInWithPassword` via Edge Function, session via `setSession()`.
- Étape 6 : page Reçus fiscaux (sélecteur d'année, liste participants avec total dons, génération PDF via Edge Function `generate-recu` avec pdf-lib, upload bucket `recus-fiscaux`, upsert `recus_fiscaux`, téléchargement signed URL, "Générer tous").
- Étape 7 : page Paramètres (nom organisation, PIN bénévole avec révélation/régénération via Edge Function `update-pin` — met à jour DB + mot de passe compte Auth technique, modèle de reçu fiscal avec 4 champs stockés dans `modele_recu_pdf` JSONB).
- Étape 8 : dashboard super-admin (`/super-admin`) — stats globales (nb orgs, total dons, nb participants), liste organisations avec stats par org, CRUD organisations. `AuthState` étendu avec type `super_admin`, détecté via `app_metadata.is_super_admin`. Redirection automatique post-login. Migration RLS dans `supabase/migrations/super_admin_rls.sql` (à exécuter dans Supabase SQL Editor).

### ⚠️ Action requise (super-admin)
Exécuter `supabase/migrations/super_admin_rls.sql` dans Supabase SQL Editor pour activer le bypass RLS super-admin.
Promouvoir un compte super-admin :
```sql
update auth.users set raw_app_meta_data = raw_app_meta_data || '{"is_super_admin": true}'::jsonb where email = 'email';
```

### ⏳ À venir
- Étape 9 — Finitions & QA

---

## Instructions pour Claude Code

1. **Toujours lire ce fichier en entier** avant de commencer à coder
2. **Suivre le plan** `docs/plan-dev-mothana.md` étape par étape, dans l'ordre
3. **Mettre à jour la section "État d'avancement"** de ce fichier après chaque étape complétée
4. **Ne jamais sauter d'étape** sans validation explicite
5. **Tester chaque étape** avant de passer à la suivante (résultat attendu décrit dans le plan)
6. En cas de doute sur une décision fonctionnelle ou technique, **demander confirmation** avant d'implémenter
