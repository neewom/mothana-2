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
│       └── verify-pin/          # Edge Function auth bénévole (à refactorer, voir ci-dessous)
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

Deux types d'accès, choisis depuis la page d'accueil :

**Admin** (email/mot de passe via Supabase Auth)
- Accès complet au dashboard et tous les CRUDs
- Organisation déterminée via `profils_organisation`

**Bénévole** (code PIN partagé par organisation)
- ⚠️ L'approche JWT custom (Edge Function `verify-pin`) a été abandonnée : le projet Supabase utilise RS256 (clés asymétriques), incompatible avec la signature HS256 depuis une Edge Function.
- **Nouvelle approche : compte Supabase Auth technique partagé par organisation**
  - Un compte Auth est créé par organisation avec la convention : email = `benevole-[organisation_id]@mothana.internal`, mot de passe = le code PIN de l'organisation
  - Quand le bénévole saisit son PIN, l'app appelle une Edge Function qui :
    1. Recherche l'organisation correspondant au PIN dans la table `organisations`
    2. Appelle `signInWithPassword` avec l'email conventionnel et le PIN comme mot de passe (si le compte n'existe pas encore, le crée d'abord avec `admin.createUser`)
    3. Retourne la session Supabase Auth native (`access_token` + `refresh_token`) au frontend
  - Ce compte a `app_metadata: { role: 'benevole', organisation_id }` — les RLS utilisent `current_benevole_organisation_id()` qui lit ces claims JWT
  - Quand le PIN change (étape 7), le mot de passe du compte technique est mis à jour via `admin.updateUserById`

---

## État d'avancement

### ✅ Terminé
- Étape 0.a (utilisateur) : projet Supabase créé, SQL exécuté, compte admin créé, clés récupérées
- Étape 0.b (code) : projet React/Vite/Tailwind initialisé, client Supabase configuré, routes squelette en place
- Étape 1 : page d'accueil Admin/Bénévole, flux auth admin, gestion de session, routes protégées, déconnexion
- Étape 2 : dashboard dons complet (stats, tableau, filtres, panneau détail, CRUD don)
- Étape 3 : page Participants (liste + recherche + total dons), panneau détail (infos + historique + ajout don pré-sélectionné), modal ajout/édition (création simultanée `personnes` + `profils_participant`), `DonModal` accepte `defaultParticipantId`
- Étape 4 : page Activités (liste, ajout, édition, suppression avec vérification dons liés). Bug RLS `personnes` corrigé.
- Étape 5 : écran bénévole (layout minimaliste, autocomplete participant, création rapide inline, formulaire don, confirmation visuelle, overlay PIN en cas d'expiration de session). Auth bénévole refactorisée : compte Supabase Auth technique par organisation (`benevole-{org_id}@mothana.internal`, mot de passe = PIN), `signInWithPassword` via Edge Function `verify-pin`, vraie session Supabase via `setSession()`.


### ⏳ À venir
- Étape 6 — Reçus fiscaux
- Étape 7 — Paramètres organisation (inclut mise à jour du mot de passe bénévole lors du changement de PIN)
- Étape 8 — Finitions & QA

---

## Instructions pour Claude Code

1. **Toujours lire ce fichier en entier** avant de commencer à coder
2. **Suivre le plan** `docs/plan-dev-mothana.md` étape par étape, dans l'ordre
3. **Mettre à jour la section "État d'avancement"** de ce fichier après chaque étape complétée
4. **Ne jamais sauter d'étape** sans validation explicite
5. **Tester chaque étape** avant de passer à la suivante (résultat attendu décrit dans le plan)
6. En cas de doute sur une décision fonctionnelle ou technique, **demander confirmation** avant d'implémenter
