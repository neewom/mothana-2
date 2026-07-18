# CLAUDE.md — Mothana (Gestion des dons)

Ce fichier est lu automatiquement par Claude Code à chaque session. Il contient le contexte du projet, les conventions à respecter, et l'état d'avancement.

---

## Session Continuity

### En début de session
- Chercher automatiquement le fichier de la dernière session dans `.claude/sessions/`
- Identifier où on s'est arrêté et les blockers en cours
- Résumer en 3 lignes avant de commencer
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

---

## Modèle d'authentification

**Super-Admin** : `is_super_admin = true` dans `app_metadata` auth.users → `/super-admin`
**Admin** : Supabase Auth email/password → dashboard organisation via `profils_organisation`
**Bénévole** : PIN → Edge Function `verify-pin` → `signInWithPassword` compte technique `benevole-{org_id}@mothana.internal`

⚠️ Pas de table `utilisateurs_app` — tout via `auth.users` Supabase
⚠️ JWT custom abandonné (RS256 incompatible HS256)

---

## Schéma de données — champs clés

**`organisations`** : nom, code_pin_benevole, modele_recu_pdf (JSONB), adresse, code_postal, ville, pays (colonnes directes ajoutées en priorité 1 Cerfa)

**`personnes`** : nom, prenom, nom2, prenom2, civilite (smallint : 1=Monsieur 2=Madame 3=Mademoiselle 4=Foyer 5=Société 6=Association 7=Famille — 0/255→NULL), adresse, code_postal, ville, pays, telephone, email

**`profils_participant`** : personne_id, organisation_id, id_externe (IDFideles)

**`activites`** : organisation_id, nom, id_externe, date_debut, date_fin

**`recus_fiscaux`** : profil_participant_id, organisation_id, annee, montant_total, fichier_url, numero_ordre, type_cerfa, template_id, snapshot_donateur, snapshot_organisation, email_envoye_at

**`templates_recu`** : organisation_id, nom, type_cerfa ('11580'|'16216'), html_template, css, is_active, is_archived

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

- Ne jamais merger une PR sans demander l'autorisation explicite à l'utilisateur, même si le code a déjà été testé/validé manuellement
- Quand l'utilisateur informe qu'une PR est mergée, `checkout main` puis `pull` pour mettre la branche locale à jour avant de démarrer les développements suivants
- Avant de démarrer un nouveau développement, toujours vérifier s'il y a des PR ouvertes (`gh pr list`). S'il y en a, et sauf si le nouveau développement est directement lié à cette PR en cours (modification, correction, suite directe), informer l'utilisateur et demander confirmation avant de continuer
- Si un problème bloquant est identifié en testant une PR ouverte — même dans des fichiers sans rapport direct avec cette PR — corriger le problème dans **cette même PR** plutôt que d'en ouvrir une séparée. La résolution des blocages rencontrés pendant le test fait partie de la validation de la PR

---

## État d'avancement

### ✅ MVP + Post-MVP terminés

- Étapes 0–9 : toutes complètes
- Gestion comptes admin (Edge Functions `create-admin`, `disable-admin`, `get_org_admins`)
- Nouveaux champs participant (civilite, adresse, nom2/prenom2) dans formulaires, fiches, reçus PDF
- Import 3336 participants réels (Wat Velouvanaram)
- Pagination UI + `fetchAllRows` (résout limite 1000 lignes PostgREST)
- `ParticipantAutocomplete` dans `DonModal`
- Accessibilité modales (`Modal.tsx`, `useFocusTrap.ts`, `modalStack.ts`)
- Mises à jour optimistes + toasts
- `vercel.json` SPA rewrite
- Suppression participant (policy RLS DELETE `profils_participant_delete.sql`)
- Activités : `id_externe` + `date_debut`/`date_fin`

### ⚠️ Actions manuelles requises
- Exécuter `supabase/migrations/super_admin_rls.sql` si pas encore fait
- Exécuter `supabase/migrations/get_org_admins.sql` si pas encore fait

### ✅ Priorité 1 : Refonte Cerfa — terminée (2026-07-18)

Voir `docs/brief-cerfa.md` pour le brief technique complet. Les 6 étapes sont en production. Détail de chaque étape :

1. ✅ **Migrations SQL** (brief §1) — exécutées en production le 2026-07-17 :
   - Colonnes adresse sur `organisations` (`organisations_adresse_fiscale.sql`)
   - Table `templates_recu` (`templates_recu.sql`) — trigger `updated_at` ajouté en plus du brief, cohérent avec les autres tables
   - Champs `numero_ordre`, `type_cerfa`, `snapshot_donateur`, `snapshot_organisation`, `template_id`, `email_envoye_at` sur `recus_fiscaux` (`recus_fiscaux_cerfa_fields.sql`)
   - Fonction SQL `next_numero_recu()` (`next_numero_recu.sql`), numérotation atomique par séquence PostgreSQL dédiée par org/année — testée sur Wat Velouvanaram (`2026-001`), séquence remise à zéro après le test (`is_called: false`) pour ne pas brûler le premier numéro réel
   - ✅ Chevauchement avec les données existantes de `modele_recu_pdf` résolu : seule `adresse` (chaîne combinée "rue, CP Ville") avait une vraie donnée (Wat Velouvanaram) — backfillée vers les colonnes structurées via `organisations_backfill_adresse.sql` (regex sur le CP à 5 chiffres). `siret` (valeur placeholder `"..."`) et `objet_association` (vide) n'avaient pas de donnée réelle exploitable : pas de backfill, seront simplement ressaisis en `rna`/`siren`/`objet_social` à l'étape 2

2. ✅ **Paramètres organisation** (brief §5) — mergé sur `main` le 2026-07-17 (PR #16 → `feat/cerfa-migrations`, puis PR #17 → `main`) :
   - Section "Informations fiscales" de `ParametresPage.tsx` refondue : adresse structurée (`organisations.adresse`/`code_postal`/`ville`/`pays`), RNA, SIREN, objet social, mention légale (pré-remplie), numéro du premier reçu, taux de réduction fiscale (défaut 66%, éditable pour les orgs à 75%) — tous dans `modele_recu_pdf` JSONB sauf l'adresse
   - Remplace l'ancien modèle `siret`/`objet_association`/`mentions_complementaires` (aucune donnée réelle en prod hors adresse déjà migrée en étape 1, confirmé par requête directe avant la refonte)
   - Bannière d'obligations légales affichée (conservation 6 ans, déclaration article 222 bis CGI, amende 66%)
   - Testé manuellement par l'utilisateur (saisie, sauvegarde, persistance DB) — confirmé OK

3. ✅ **Templates HTML par défaut** (brief §3) — code sur `feat/cerfa-templates-defaut`, migration RLS exécutée en production le 2026-07-17 :
   - Deux templates conformes Cerfa dans `src/lib/defaultCerfaTemplates.ts` (11580 particuliers articles 200/200 bis CGI, 16216 entreprises article 238 bis CGI) — placeholders `{{variable}}` selon liste du brief §2.2, CSS partagé A4 imprimable
   - Seedés automatiquement dans `SuperAdminPage.tsx` (`OrgModal.handleSubmit`) à la création d'une organisation : insert `organisations` avec `.select('id')` pour récupérer l'id, puis insert des 2 lignes `templates_recu` (`is_active: true`)
   - Migration `templates_recu_super_admin_bypass.sql` : la policy RLS `templates_recu_org` n'avait pas le bypass super-admin (table créée après `super_admin_rls.sql`) — sans elle le seed échouait car le super-admin n'est pas encore membre de l'organisation qu'il vient de créer (`current_effective_organisation_id()` renvoie NULL)
   - Rendu visuel vérifié via Playwright headless (screenshot des 2 templates avec données d'exemple) — pas de test de création d'organisation réelle en production pour éviter de polluer les données (à valider par l'utilisateur)
   - Bug bloquant trouvé par l'utilisateur en testant cette PR (génération de reçu Wat Strasbourg → erreur serveur), corrigé dans cette même PR plutôt qu'à part : `generate-recu` utilisait encore l'ancien `mode_paiement` texte alors qu'il est numérique depuis la PR #14 — `pdf-lib` recevait un nombre au lieu d'une chaîne et plantait. Corrigé, déployé en production, testé OK par l'utilisateur

4. ✅ **Refonte Edge Function `generate-recu`** (brief §2) — codée sur `feat/cerfa-generate-recu-gotenberg`, testée bout-en-bout en production le 2026-07-18 :
   - `pdf-lib` abandonné, remplacé par Gotenberg (déployé sur Railway, secret `GOTENBERG_URL` configuré) — conversion HTML→PDF via `POST /forms/chromium/convert/html`, un seul fichier `index.html` avec le CSS inliné en `<style>` (pas de fichiers séparés)
   - Nouveau flux complet (brief §2.3) : validation organisation → validation participant → détermination type_cerfa → template actif → `next_numero_recu()` (conservé si régénération) → snapshots donateur/organisation → placeholders → PDF → Storage (`{org}/{année}/{numero_ordre}.pdf`) → upsert `recus_fiscaux`
   - Validations `regles-recus-fiscaux.md` §2-3 implémentées côté serveur (source de vérité — l'étape 5 les rendra aussi visibles côté UI avant le clic) : organisation (adresse/CP/ville, RNA ou SIREN, objet social, mention légale) puis participant (nom/adresse/CP/ville/civilité, prénom selon civilité, blocage dur sur civilité Famille ou NULL). Réponses 422 avec message clair + `missing_fields`
   - Règles de formatage du nom du donateur (brief §4) implémentées et vérifiées (`M. Jean DUPONT`, `M. et Mme Jean DUPONT`, raison sociale seule pour société/association) — testées unitairement avec `deno run`
   - Taux de réduction : `taux_reduction` configurable de l'organisation (défaut 66%) pour le 11580, **60% fixe** pour le 16216 (régime IS entreprises, non configurable)
   - Backfill `templates_recu_backfill_orgs_existantes.sql` : Wat Velouvanaram/Strasbourg/Choisy créées avant l'étape 3 n'avaient aucun template, généré depuis les mêmes constantes que `defaultCerfaTemplates.ts` (évite toute divergence)
   - Bug trouvé et corrigé pendant le test réel : le template 11580 concaténait `{{donateur_civilite}}` et `{{donateur_nom_complet}}` (qui inclut déjà le titre de civilité) → "Monsieur M. Nicolas BOULOM" en double. Corrigé dans `defaultCerfaTemplates.ts` + migration `templates_recu_fix_donateur_civilite_duplication.sql` pour les templates déjà en base
   - Testé bout-en-bout par l'utilisateur sur Wat Strasbourg : blocage organisation incomplète ✅, champ retiré de la liste une fois rempli ✅, blocage participant incomplet ✅, génération réelle avec PDF vérifié (rendu, montant en chiffres/lettres, numéro d'ordre conservé en régénération) ✅

5. ✅ **Évolutions UI page Reçus fiscaux** (brief §6) — codée sur `feat/cerfa-recus-fiscaux-ui`, build/lint/typecheck OK, smoke test navigateur fait (pas d'identifiants admin pour tester le rendu réel avec données) :
   - `src/lib/cerfaValidation.ts` : logique de validation organisation/participant dupliquée côté client (mêmes règles que `generate-recu`, le backend reste la source de vérité) — `validateOrganisationCerfa()` et `validateParticipantCerfa()`
   - Bannière de blocage si paramètres organisation incomplets, avec lien direct vers `/admin/parametres`
   - Icône ⚠️ à côté du nom + message détaillé sous le statut, avec tooltip/texte listant les champs manquants ou la raison du blocage (civilité Famille/NULL)
   - Colonnes N° reçu et Type (libellé "11580 · Particuliers" / "16216 · Entreprises") ajoutées au tableau
   - CTA Générer/Regénérer **désactivé** quand l'organisation ou le participant est bloqué (décision utilisateur du 2026-07-18) — "Générer tous" filtre aussi les lignes bloquées plutôt que d'échouer dessus
   - Bouton "Modifier le participant" sous le message d'erreur, ouvre `ParticipantModal` directement depuis cette page (décision utilisateur du 2026-07-18) — réutilise le composant existant de `ParticipantsPage`
   - Confirmation avant regénération (modale réutilisant le composant `Modal` existant, même pattern que la suppression de participant), précise que le numéro d'ordre est conservé
   - Toast de succès après génération réussie (décision utilisateur du 2026-07-18), réutilise `useToast`/`Toast` déjà utilisés sur `ParticipantsPage`
   - `RecuFiscal` (types/index.ts) étendu avec `numero_ordre`/`type_cerfa`, présents en base depuis l'étape 1 mais jamais exposés côté frontend
   - Testé par l'utilisateur : bannière, icônes/tooltips, CTA désactivés, toast — tous OK. Bug UI trouvé sur `ParticipantModal` (bouton "Modifier le participant" ouvre une modale dont les boutons Annuler/Enregistrer n'étaient pas visibles sans scroll) : corrigé — corps scrollable + footer sticky avec ombre indicative et coins bas arrondis (`rounded-b-2xl`, sinon le fond opaque du footer recouvrait l'arrondi du conteneur `Modal`)

6. ✅ **Gestion des templates** dans Paramètres (brief §7) — mergé sur `main` le 2026-07-18 (PR #25), dernière étape de la refonte Cerfa (priorité 1) :
   - Nouvelle dépendance `@monaco-editor/react` (aucun éditeur de code n'existait dans le projet)
   - Nouvelle section "Modèles de reçus fiscaux" dans Paramètres (`TemplatesRecuSection.tsx`) : liste des templates groupés par type (11580/16216), badge Actif/Inactif/Archivé
   - `TemplateRecuEditorModal.tsx` : création **et modification** d'un template (nom, type, éditeur Monaco HTML/CSS avec onglets, aperçu iframe live) — création désactivée par défaut (à activer explicitement) ; modification ajoutée en cours de PR (sans elle, un template déjà utilisé pour générer un reçu ne pouvait plus jamais être ni corrigé ni supprimé)
   - Liste complète des 19 placeholders disponibles affichée sous l'éditeur (tags cliquables, copie presse-papier, exemple de valeur au survol) — ajoutée en cours de PR suite à un retour utilisateur
   - `TemplateRecuPreviewModal.tsx` : aperçu en lecture seule d'un template existant
   - `src/lib/cerfaPreview.ts` : données d'exemple + rendu HTML partagés entre les deux modales (mêmes placeholders que `generate-recu`)
   - Activer : désactive l'ancien template actif du même type puis active le nouveau (deux updates séquentiels, pas de transaction SQL — risque de concurrence jugé acceptable pour une action admin mono-utilisateur)
   - Archiver le template actif : confirmation spécifique avertissant que la génération sera bloquée pour ce type tant qu'un autre template n'est pas activé
   - Supprimer : vérifie d'abord qu'aucun `recus_fiscaux.template_id` ne référence le template (bloque avec message si utilisé), puis confirmation standard avant suppression définitive
   - Monaco testé et fonctionnel (coloration syntaxique HTML/CSS, onglets, aperçu live, mode édition pré-rempli) via une route de test temporaire ajoutée puis retirée avant chaque commit — testé et validé par l'utilisateur, PR mergée

**Suite à cette étape** : incident opérationnel identifié et corrigé — l'agent tuait par erreur l'instance `npm run dev` permanente de l'utilisateur (exposée réseau, utilisée pour piloter le travail à distance) via des `pkill -f vite` pendant les tests visuels. Règle ajoutée dans `CLAUDE.md` ("Environnement de développement") + mémoire persistante : ne plus jamais tuer de processus par pattern de nom, réutiliser l'instance existante sur le port 5173.

### ⏳ Roadmap post-Cerfa

**Priorité 2 — Export comptable**
- Export CSV dons (période configurable)
- Export CSV reçus annuels (déclaration article 222 bis CGI)
- Tableau de bord comptable (courbe mensuelle, répartition activité/paiement, N vs N-1)
- Rapprochement chèques/virements

**Priorité 3 — Wizard de template Cerfa**
- Upload PDF modèle → analyse Claude Vision → génération template HTML
- Prévisualisation iframe + chat ajustements (Claude Haiku) + éditeur Monaco

**Priorité 4 — Envoi email des reçus**
- PDF envoyé au participant après génération (Resend recommandé)
- Suivi `email_envoye_at` dans `recus_fiscaux`

**Priorité 5 — Roadmap lointaine**
- Export FEC, intégrations comptables
- Brique événements/coupons (Pagode Coupon)
- Gestion abonnements/plans

---

## Instructions pour Claude Code

1. **Lire ce fichier en entier** avant toute action
2. **Chercher le fichier de session du jour** dans `.claude/sessions/` avant de commencer
3. **Suivre `docs/brief-cerfa.md`** pour la priorité en cours
4. **Mettre à jour "État d'avancement"** après chaque étape complétée
5. **Sauvegarder un résumé de session** dans `.claude/sessions/` en fin de session
6. **Ne jamais sauter d'étape** sans validation explicite
7. **Demander confirmation** en cas de doute fonctionnel ou technique