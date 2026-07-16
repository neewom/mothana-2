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
- Étape 8 : dashboard super-admin (`/super-admin`) — stats globales (nb orgs, total dons, nb participants), liste organisations avec stats par org, CRUD organisations. `AuthState` étendu avec type `super_admin`, détecté via `app_metadata.is_super_admin`. Redirection automatique post-login. Consultation du dashboard d'une organisation depuis le super-admin : `viewingOrgId` dans `AuthContext`, hook `useOrganisationId()`, bannière de mode consultation dans `AdminLayout`, filtrage explicite par `organisation_id` dans toutes les requêtes admin. Migration RLS dans `supabase/migrations/super_admin_rls.sql`.

- Étape 9 : finitions & QA — redirection super-admin depuis HomePage, remplacement alert() par état d'erreur inline (RecusFiscauxPage), guide de déploiement (`docs/deploiement.md`).

- Post-MVP (corrections) :
  - Migration RLS étendue : bypass super-admin pour `personnes` (select), `activites` (select), `recus_fiscaux` (all), `profils_participant` (insert, update), `dons` (insert, update, delete)
  - `DonModal` : création de participant à la volée (nom/prénom/email inline), UUIDs générés côté client via `crypto.getRandomValues()` pour éviter l'issue de lecture-retour bloquée par RLS
  - `AuthContext` : `viewingOrgId` persisté dans `sessionStorage` pour survivre aux rechargements de page
  - ⚠️ Bug corrigé : `personnes_update` n'avait pas le bypass super-admin (contrairement à `personnes_select`) — en mode consultation super-admin, `current_effective_organisation_id()` renvoie `NULL` (pas de ligne `profils_organisation` pour le super-admin), donc l'UPDATE modifiait silencieusement 0 ligne (aucune erreur renvoyée par Supabase). Corrigé via `supabase/migrations/personnes_update_super_admin_bypass.sql`, appliqué en production.

### ✅ MVP terminé


- Post-MVP (gestion comptes admin) :
  - Edge Function `create-admin` : vérifie super-admin via JWT, crée le compte Auth, insère dans `profils_organisation` avec `role='admin'`, rollback Auth si l'insert échoue
  - Edge Function `disable-admin` : ban/unban via `admin.updateUserById` (`ban_duration: '876000h'` / `'none'`)
  - Fonction SQL `get_org_admins(org_id)` (security definer, réservée super-admin) : joint `profils_organisation` et `auth.users` pour retourner email + `is_banned` — à exécuter depuis `supabase/migrations/get_org_admins.sql`
  - `AdminsModal` dans `SuperAdminPage` : liste des admins par org (nom, email, badge désactivé, bouton Désactiver/Réactiver), formulaire d'ajout inline (nom, email, mot de passe), bouton "Admins" par ligne d'organisation

### ⚠️ Actions requises (déploiement)
- Exécuter `supabase/migrations/super_admin_rls.sql` dans Supabase SQL Editor
- Exécuter `supabase/migrations/get_org_admins.sql` dans Supabase SQL Editor
- Exécuter `supabase/migrations/profils_participant_delete.sql` dans Supabase SQL Editor (nécessaire pour la suppression de participant — sans elle, le bouton "Supprimer" semble fonctionner côté UI mais ne supprime aucune ligne en base, RLS bloquant silencieusement le DELETE)
- Déployer les Edge Functions : `create-admin`, `disable-admin` (en plus de `verify-pin`, `generate-recu`, `update-pin`)
- Promouvoir un compte super-admin :
  ```sql
  update auth.users set raw_app_meta_data = raw_app_meta_data || '{"is_super_admin": true}'::jsonb where email = 'email';
  ```

- Post-MVP (nouveaux champs participant) :
  - Table `personnes` en base : `civilite` (smallint, 1=Monsieur 2=Madame 3=Mademoiselle 4=Foyer 5=Société 6=Association 7=Famille), `adresse`, `code_postal`, `ville`, `pays`, `nom2`/`prenom2` (co-signataire foyer). Table `profils_participant` : `id_externe` (traçabilité imports). Ces colonnes existaient déjà en base (import participants réel) mais n'étaient pas exposées dans le frontend.
  - `src/types/index.ts` : `Personne` et `ProfilParticipant` étendus avec ces champs, type `Civilite`
  - `src/lib/civilite.ts` : labels et options de civilité partagés
  - `ParticipantModal` : formulaire étendu (select civilité, champs co-signataire affichés uniquement si civilité = Foyer, adresse/code postal/ville/pays)
  - `ParticipantsPage` (fiche détail participant) : affichage civilité, co-signataire (foyer), bloc adresse
  - Edge Function `generate-recu` : en-tête du PDF utilise `civilite`/`nom2`/`prenom2` — titre de civilité pour 1/2/3, "Monsieur X et Madame Y" pour Foyer (ou "Monsieur et Madame {nom}" si pas de co-signataire renseigné), libellé seul (Société/Association/Famille) sans titre personnel pour 5/6/7 — déployé en production
  - Ajustements formulaire `ParticipantModal` : labels "Nom 2"/"Prénom 2" (au lieu de "co-signataire"), champ Prénom masqué (et vidé) si civilité = Société/Association
  - `ParticipantsPage` : recherche combinée nom + prénom + civilité (tokenisée, ordre indifférent), tri par colonne cliquable (Civilité, Nom, Prénom, Total dons — défaut Nom croissant), colonnes Email/Téléphone retirées du tableau, Civilité en 1ère colonne, panneau détail `sticky`, fiche détail affichant toutes les infos (co-signataire indépendamment de la civilité, adresse complète, identifiant externe)
  - ⚠️ Bug corrigé : troncature silencieuse à 1000 lignes (limite par défaut PostgREST) sur les listes de `profils_participant`/`dons` pour les organisations à fort volume (Wat Velouvanaram : 3335 participants). Helper `src/lib/fetchAllRows.ts` (pagination `.range()` par blocs de 1000, tri stable par `id`) appliqué à `ParticipantsPage`, `DonsPage`, `RecusFiscauxPage`, `SuperAdminPage` (stats globales). Pagination UI (lignes par page + navigation) ajoutée sur les tableaux de `ParticipantsPage`, `DonsPage`, `RecusFiscauxPage`.
  - `DonModal` : le `<select>` de participant (impraticable avec 3335 participants) remplacé par `ParticipantAutocomplete` (nouveau composant) — champ de recherche texte + suggestions filtrées (nom/prénom/civilité, même logique que la recherche de `ParticipantsPage`), limitées à 20 résultats affichés. Logique de recherche extraite dans `src/lib/participantSearch.ts` (`filterParticipants`, `participantFullName`), partagée entre `ParticipantsPage` et `ParticipantAutocomplete`.
  - `DonModal` : formulaire rapide de création inline (nom/prénom/email) supprimé — le bouton "+ Nouveau participant" ouvre directement `ParticipantModal` (formulaire complet) en modale imbriquée. `ParticipantModal.onSaved` renvoie désormais le `ProfilParticipant` créé/modifié (au lieu de rien) pour permettre à `DonModal` de sélectionner immédiatement le participant tout juste créé (stocké dans un état local `extraParticipants`, en attendant le prochain refetch de la liste parente).
  - Passe accessibilité sur les modales : nouveau composant `src/components/Modal.tsx` (shell réutilisable — backdrop, carte, bouton de fermeture X avec `aria-label`, `role="dialog"` + `aria-modal` + `aria-labelledby`), hook `src/hooks/useFocusTrap.ts` (piège Tab/Shift+Tab, focus initial sur le bouton de fermeture, restauration du focus précédent à la fermeture, Echap → `onClose`), `src/lib/modalStack.ts` (pile globale : seule la modale la plus récemment ouverte réagit à Echap/Tab, nécessaire car `DonModal` imbrique `ParticipantModal`). Appliqué à `ParticipantModal`, `DonModal`, `ActiviteModal`, `OrgModal`, `AdminsModal` (son bouton de fermeture manuel retiré, doublon avec celui du shell), et aux confirmations de suppression (`ActivitesPage`, `SuperAdminPage`). `PinOverlay` (`BenevolePage`) : focus trap seul, volontairement sans Echap/fermeture (réauthentification obligatoire). Hors périmètre : panneaux de détail mobiles (`ParticipantsPage`/`DonsPage`, masqués en CSS `lg:hidden` donc un trap JS s'activerait aussi en desktop) et le tiroir de nav mobile (`AdminLayout`, chrome de navigation, pas un dialogue).
  - ✅ Vérifié manuellement par l'utilisateur : autocomplete participant dans "Ajouter un don" (recherche, sélection, soumission, cas imbriqué "+ Nouveau participant"), accessibilité des modales (focus initial, Tab, Echap), génération d'un reçu fiscal pour un participant Foyer avec co-signataire — tout fonctionne. Fiche BOULOM également corrigée manuellement.
  - `ParticipantsPage` : sauvegarde d'un participant (ajout/édition) ne déclenche plus de refetch complet (coûteux pour 3335 participants) — mise à jour optimiste locale via `upsertParticipant` (nouveau, exposé par `useParticipants`), plus un toast de confirmation affichant nom/prénom ("X modifié" / "X ajouté"). Nouveau système de toast réutilisable : `src/hooks/useToast.ts` + `src/components/Toast.tsx` (message unique, auto-dismiss ~3s, `role="status"` `aria-live="polite"`).
  - `vercel.json` ajouté (rewrite SPA `/(.*) → /index.html`) : sans lui, l'accès direct (rechargement, lien externe) à une route React Router (ex: `/login/admin`) renvoyait un 404 sur Vercel.
  - ⚠️ Bug corrigé : l'overlay des modales (`ParticipantsPage`, `DonsPage`, `ActivitesPage`, `SuperAdminPage`) ne couvrait pas toute la hauteur de l'écran — ces pages enveloppaient toute leur sortie JSX (y compris les modales `fixed`) dans un seul `div.space-y-6`/`space-y-8`, qui applique un `margin-top` aux enfants non-premiers via un sélecteur de frères ; un élément `fixed` reste soumis à son propre `margin` même hors du flux normal. Modales/overlays sortis du conteneur `space-y-*` via un Fragment.
  - Suppression d'un participant : CTA "Supprimer le participant" dans le panneau de détail (`DetailPanel`, `ParticipantsPage`), avec confirmation (`Modal` partagé). Bloquée si le participant a des dons liés (vérifié via l'array `dons` déjà chargé en mémoire, cohérent avec le pattern de blocage déjà utilisé pour les activités) — protège l'historique de dons et les reçus fiscaux, qui ne peuvent exister que s'il y a des dons. Nécessite la migration `supabase/migrations/profils_participant_delete.sql` (nouvelle policy RLS `delete`, absente jusqu'ici). La table `personnes` n'est pas supprimée (reste orpheline), volontairement, pour éviter tout risque lié au cascade delete si une `personne` venait à être partagée entre plusieurs organisations.

### ⏳ Post-MVP — Reste à implémenter
- Envoi automatique des identifiants par email à l'admin créé
- ⚠️ Règle métier rappel : la création de comptes admin passe obligatoirement par le dashboard super-admin (jamais manuellement via Supabase)

---

## Instructions pour Claude Code

1. **Toujours lire ce fichier en entier** avant de commencer à coder
2. **Suivre le plan** `docs/plan-dev-mothana.md` étape par étape, dans l'ordre
3. **Mettre à jour la section "État d'avancement"** de ce fichier après chaque étape complétée
4. **Ne jamais sauter d'étape** sans validation explicite
5. **Tester chaque étape** avant de passer à la suivante (résultat attendu décrit dans le plan)
6. En cas de doute sur une décision fonctionnelle ou technique, **demander confirmation** avant d'implémenter
