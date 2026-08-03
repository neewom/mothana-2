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
- Skill `.claude/skills/webapp-testing/` disponible pour les vérifications navigateur (Playwright Python) — son propre helper `scripts/with_server.py` sait démarrer/arrêter un serveur, mais **ne pas l'utiliser dans ce projet** puisqu'une instance tourne déjà en permanence : suivre la branche "serveur déjà en cours → reconnaissance puis action" de son arbre de décision, jamais la branche "démarrer un serveur"

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

**`adherents`** *(module cadré le 2026-08-03, migration exécutée en prod le 2026-08-03 — voir backlog pour la suite)* : organisation_id, id_externe (UNIQUE(organisation_id, id_externe)), civilite (smallint réduit : 0=non défini, 1=Monsieur, 2=Madame — distinct de l'enum civilité participants), nom, prenom, date_naissance, adresse, code_postal, ville, telephone, courriel, statut (actif/archivé — soft delete), statuts_acceptes (boolean, default true), consent_rgpd (boolean, default false)

**`adhesions`** *(idem, migration exécutée en prod le 2026-08-03)* : adherent_id, date_debut, date_fin, montant_cotisation (nullable), date_paiement_cotisation, mode_paiement (enum réutilisé de Mothana, CHECK [1,2,3,4]), renouvellement (boolean, calculé — true si l'adhérent a déjà une adhésion antérieure, pas saisi), droit_vote_ag (boolean, default true), bulletin_signe (boolean, default true)

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
- ✅ Export CSV dons (2026-07-22) — bouton "Exporter" sur `DonsPage`, exporte `filteredDons` (période/participant/activité/mode déjà filtrés à l'écran), délimiteur `;` + BOM UTF-8 pour Excel FR (`src/lib/csvExport.ts`, réutilisable pour les prochains exports). Au passage : filtre "Participant" remplacé par `ParticipantAutocomplete` (recherche nom/prénom, même composant que `DonModal`)
- ✅ Tableau de bord comptable (2026-07-23) — nouvelle page `/admin/comptabilite` (`ComptabilitePage.tsx`) : courbe mensuelle N vs N-1, répartition par activité, répartition par mode de paiement, cartes de stats. Recharts (nouvelle dépendance), palette/formes conformes au skill `dataviz` (validée via `scripts/validate_palette.js`)
- ✅ Récapitulatif déclaratif article 222 bis CGI (2026-07-25) — mergé sur `main` (PR #30), après clarification réglementaire : la déclaration ne nécessite pas de format d'export vers un portail externe, seulement deux chiffres agrégés par organisation/année (nombre de reçus émis + montant total) à recopier manuellement dans la télédéclaration officielle. Carte "Récapitulatif déclaratif" sur `ComptabilitePage.tsx` (`DeclarationCerfaCard.tsx`), une ligne par année, bouton copier + export CSV, agrégation directe sur `recus_fiscaux` (`GROUP BY annee`). Checkpoint agrégation validé en prod avant codage UI : `recus_fiscaux` a une contrainte `UNIQUE (profil_participant_id, annee)` et `generate-recu` fait un upsert dessus — pas de double-comptage possible sur les reçus régénérés. Au passage : extraction de `src/lib/clipboard.ts` (pattern `execCommand('copy')` déjà dupliqué dans `TemplateRecuEditorModal.tsx`)
- Rapprochement chèques/virements — jamais cadré, le moins défini des 4 items

**Import des dons — rapport d'erreurs écarté (2026-07-23)** : discuté (export CSV des lignes en erreur de `ImportWizard.tsx`), mais décision finale de l'utilisateur de ne rien construire — les lignes incorrectes restent simplement ignorées lors de l'import

### ✅ Priorité 3 : Wizard de template Cerfa — terminée (2026-07-20)

- Upload PDF modèle → analyse Claude Vision (`generate-template-from-pdf`, modèle `claude-haiku-4-5` — coût/qualité jugés équivalents à Sonnet 5 sur cette tâche par l'utilisateur) → brouillon HTML/CSS via tool use forcé → toujours ouvert dans l'éditeur Monaco existant, jamais activé automatiquement
- Placeholders obligatoires mis en avant dans l'éditeur (`src/lib/cerfaPreview.ts` : `CERFA_MANDATORY_KEYS`, `CERFA_RNA_SIREN_GROUP`, `getMissingMandatoryPlaceholders()`) — activation d'un template bloquée tant qu'ils ne sont pas tous présents
- CTA "Placeholders" en popover (zone Annuler/Enregistrer), copie au clic (avec repli `execCommand('copy')` car `navigator.clipboard` est indisponible sur l'URL réseau HTTP utilisée pour piloter l'instance de dev à distance)
- Confort d'édition ajouté au passage : plein écran (`Modal.tsx` — prop `fullScreen` générique + `heightClassName`), sélecteur Les deux/Éditeur/Aperçu, Ctrl/Cmd+S
- Éditeur WYSIWYG (GrapesJS pressenti) volontairement écarté pour l'instant — à reconsidérer seulement si l'édition Monaco devient une vraie friction
- ✅ **Assets par organisation (liste ouverte, n assets) + placeholders président** — cadré le 2026-08-01, redesigné et mergé le 2026-08-03 (**PR #35**). Version initiale codée avec 3 slots fixes (`logo_url`/`tampon_url`/`signature_url`) ; retravaillée à la demande de l'utilisateur en une liste extensible avant merge. Décisions : bucket Storage `organisation-assets` **public** (ces images finissent de toute façon sur un PDF remis au donateur, évite les URLs signées pour l'aperçu Monaco et pour Gotenberg) ; les 2 templates Cerfa par défaut (11580/16216) **non modifiés**. Nouvelle table `organisation_assets` (`organisation_id`, `identifiant` slug unique par org, `libelle`, `url`) — chaque asset devient un placeholder `{{asset_<identifiant>}}` résolu dynamiquement par organisation (éditeur/aperçu Monaco, `generate-recu`, `snapshot_organisation.assets`). Sous-section "Identité visuelle" dans `ParametresPage.tsx` : ajout/remplacement/suppression d'un nombre illimité d'assets (libellé + fichier PNG/JPEG 2 Mo max, upload + sauvegarde DB immédiats), plus nom/titre du président (`{{president_nom}}`/`{{president_titre}}`, désormais résolus avec la vraie valeur de l'organisation dans l'aperçu de template, pas une donnée d'exemple générique — bug trouvé et corrigé pendant le test). **Bug bloquant trouvé et corrigé pendant le test** : le code de `generate-recu` avait été mis à jour dans le repo mais jamais redéployé sur Supabase (dernier déploiement du 2026-07-18) — les placeholders fonctionnaient dans l'aperçu (calculé côté frontend) mais pas dans le PDF réellement généré (edge function obsolète). Redéployé (`supabase functions deploy generate-recu`, version 9). ⚠️ Point de vigilance pour la suite : penser à redéployer les edge functions après tout changement de leur code, le déploiement n'est pas automatique au push/merge sur ce projet

**Backlog non priorisé (ajouté 2026-07-25) — les 5 items terminés le 2026-07-25**
- ✅ **Affichage cassé des dons d'un participant** (page Participants) — PR #31 mergée. Cause réelle du "cassage" : `h-full` ne se résout pas quand le parent n'a qu'un `max-height` sans `height` explicite (panneau latéral + modale) — repris le pattern `flex-1 overflow-hidden` + footer `shrink-0` déjà validé dans `ParticipantModal.tsx`. Décision finale après itération : pas de modale séparée "voir plus", la petite fenêtre sticky d'origine suffit une fois le scroll interne corrigé — tous les dons y restent listés directement. Bascule desktop/mobile abaissée de `lg` (1024px) à `md` (768px), le seuil `lg` faisait passer en tiroir plein écran une simple fenêtre de navigateur non maximisée
- ✅ **Lenteur de chargement sur Wat Velouvanaram** — PR #32 mergée, cause identifiée avec certitude (pas de simple hypothèse) via `supabase db advisors --linked` : `auth_rls_initplan` sur ~20 policies (auth.jwt()/auth.uid() ré-évalués à chaque ligne scannée plutôt qu'une fois par requête — piège RLS documenté par Supabase). Chiffres réels vérifiés en prod avant tout correctif : Wat Velouvanaram = 3335 participants / **15632 dons** / 314 activités, les 2 autres organisations n'ont qu'1 ligne de test chacune (l'hypothèse initiale d'index manquant sur `activites`/`profils_participant` a été invalidée par l'advisor + `pg_indexes` — un index composite couvrant existait déjà via les contraintes uniques `id_externe`). Policies RLS + fonctions helper réécrites avec le pattern `(select ...)` recommandé par Supabase (migration `rls_auth_initplan_perf.sql`, exécutée directement en prod via `supabase db query --linked` après confirmation explicite, vérifiée par re-run de l'advisor : 0 warning restant, aucune régression de policy, aucune nouvelle alerte sécurité). Complété par la parallélisation de `fetchAllRows` (pagination par lots de 4 requêtes en parallèle au lieu d'une par une — 16 pages séquentielles → 4 vagues pour les dons). Résultat confirmé par l'utilisateur : Activités instantané, Participants/Dons nettement plus courts (Dons reste un peu plus long, cohérent avec son volume de lignes)
- ✅ **Champ de recherche pour les activités** — PR #33 mergée, `ActiviteAutocomplete.tsx` (même pattern que `ParticipantAutocomplete`) remplace le `<select>` dans `DonModal`, le filtre de `DonsPage`, et `BenevolePage`
- ✅ **Page Activités : filtre + pagination** — PR #33 mergée (même PR que le point précédent, même surface de code), recherche + pagination (50/page) ajoutées, en-tête aligné sur `ParticipantsPage`. Fetch passé à `fetchAllRows` (protection contre une troncature silencieuse au-delà de 1000 activités)
- ✅ **Réaffectation de don à un autre participant** — cadré puis codé le 2026-07-25. Décision produit finale : blocage total (pas d'avertissement + régénération manuelle) dès qu'un reçu fiscal a déjà été émis pour l'année du don, côté source **ou** destination — l'utilisateur a tranché en cours de cadrage pour la simplicité/sécurité plutôt que le palier intermédiaire initialement envisagé. Implémenté dans `DonModal.tsx` : champ participant déverrouillé en mode édition (`disabled={isEdit}` retiré), check `recus_fiscaux` (organisation_id + annee + profil_participant_id in [source, destination]) exécuté avant le submit si le participant a changé, message d'erreur explicite listant qui bloque si un reçu existe déjà. Validation uniquement côté client (pas d'Edge Function pour les dons, cohérent avec le reste du flux `DonModal`/`DonsPage`)

**Nouveau backlog (ajouté 2026-07-25, fin de session)**
- **Repenser le bypass** — toujours non clarifié (reporté deux sessions de suite, la session du 2026-08-03 a été consacrée aux assets à la place). Noté par l'utilisateur sans plus de précision, à clarifier en tout premier lieu en début de prochaine session, ne pas deviner. Hypothèse la plus probable (contexte immédiat : PR #34 réaffectation de don venait d'être mergée) : le blocage total de réaffectation quand un reçu fiscal existe déjà pourrait avoir besoin d'un mécanisme de bypass pour des cas légitimes (ex. super-admin, ou admin qui a supprimé/regénérera le reçu manuellement) — mais pourrait aussi concerner le bypass super-admin RLS (`is_super_admin` dans les policies, cf. `super_admin_rls.sql`) revu la veille dans la migration perf RLS. Ne pas assumer avant confirmation de l'utilisateur

- **Module Adhérents — cadré le 2026-08-03, prêt pour développement.** Contexte : besoin remonté par un tiers à l'utilisateur, distinct des participants/donateurs (`profils_participant`). Un adhérent n'est **pas** un rôle sur un profil existant mais une population à part entière, sans lien direct en base pour l'instant. Cadrage complet réalisé en une session dédiée (aucune reprise du cadrage précédent, celui-ci était vide).

  **Décisions structurantes actées :**
  - **Refonte navigation** : l'accueil (aujourd'hui hub admin/bénévole) devient un vrai **dashboard organisation** post-connexion admin (stats dons/évènements récents, adhérents proches d'expiration, etc.), alimenté par les deux grandes sections. La mire de connexion devient la page d'accueil de l'app, avec lien vers l'espace bénévole
  - **Regroupement** : dons, participants, évènements/activités, reçus fiscaux → section **"Dons"**. Nouvelle section **"Adhérents"** au même niveau, pas en sous-section
  - **Historisation** : une adhésion = un cycle annuel dans une table `adhesions` séparée de `adherents` (même pattern qu'un don rattaché à un participant), pour permettre le suivi actif/expiré par année sans perdre l'historique
  - **Civilité simplifiée** : enum dédié à 3 valeurs (0 non défini / 1 M. / 2 Mme), volontairement distinct de l'enum civilité à 7 valeurs des participants (pas de personne morale/famille adhérente pour l'instant)
  - **Suppression** : soft delete (statut archivé) plutôt que hard delete, pour anticiper un futur lien avec les dons
  - **Champs fournis par la base source existante**, arbitrés un par un entre `adherents` (propriétés stables de la personne) et `adhesions` (propriétés du cycle annuel) :
    - `Statuts_Acceptés` → `adherents.statuts_acceptes` (accepté une fois, stable dans le temps)
    - `Consent_RGPD` → `adherents.consent_rgpd` (concerne la personne, pas le cycle annuel)
    - `Bulletin_signé` → `adhesions.bulletin_signe` (peut être redemandé à chaque renouvellement)
    - `AG_Droit_vote` → `adhesions.droit_vote_ag` (conditionné à la cotisation de l'année en cours)
    - `Cotisation_annuelle` → `adhesions.montant_cotisation` (nullable, l'association n'a pas de montant fixe actuellement)
    - `Date_paie_cotisation` → `adhesions.date_paiement_cotisation`
    - `Mode_paie_Cotis` → `adhesions.mode_paiement` (enum Mothana existant réutilisé)
    - `Renouvellement` → `adhesions.renouvellement`, **calculé** (déduit d'une adhésion antérieure existante) plutôt que saisi, pour éviter une incohérence déclarative
    - `Recu_délivré` → **écarté**, champ vide sur toutes les lignes de la base source, aucun usage identifiable, pas de génération de document de reçu de cotisation prévue pour l'instant (à reconsidérer si le besoin émerge, réutiliserait l'infra Gotenberg comme les Cerfa)
  - **Lien avec les participants/donateurs** : aucun lien direct en base pour la V1. Un adhérent peut être donateur ou non et inversement. Mécanisme futur envisagé (**prio basse, non développé**) : à la saisie d'un don, recherche par nom/prénom d'abord côté participants, puis fallback sur la base adhérents si pas de match — risque de doublonnement entre les deux populations à traiter à ce moment-là, pas avant
  - **Import** : réutilisation et généralisation du système d'import participants existant (mapping colonnes piloté par config plutôt que codé en dur). `id_externe` inclus dans l'import, avec la même question de contrainte d'unicité par organisation que celle déjà ouverte sur les activités
  - **Carte d'adhérent** : gabarit HTML/CSS éditable réutilisant l'infra existante (Gotenberg + éditeur Monaco de la refonte Cerfa), format **planche A4** avec plusieurs cartes positionnées pour faciliter la découpe (pas une carte par page) — sélection multiple d'adhérents pour impression par lot

  **Formulaire d'adhésion (champs V1)** : date d'adhésion, civilité, nom, prénom, date de naissance, adresse, code postal, ville, téléphone, courriel — plus les champs de cycle listés ci-dessus

  **Page liste** : filtrage par nom+prénom ou prénom+nom, actions modifier/supprimer (archiver) avec alertes appropriées

  **Séquencement de développement proposé :**
  1. ✅ Migrations SQL `adherents` + `adhesions` (RLS, contraintes, `id_externe`) — exécutées en prod le 2026-08-03
  2. ✅ Restructuration navigation (accueil → dashboard, regroupement section Dons, stub section Adhérents) — PR #36 mergée le 2026-08-03
  3. ✅ Formulaire + page liste + filtre + modifier/archiver — PR #37 mergée le 2026-08-03. Pagination volontairement différente de Dons/Participants (`fetchAllRows` + `.slice()` client) : ici côté serveur via RPC `search_adherents` (`LIMIT`/`OFFSET`), pour ne pas reproduire la lenteur Wat Velouvanaram (PR #32) — décision confirmée avec l'utilisateur après une question sur la cohérence entre pages
  4. ✅ Import — PR #38 mergée le 2026-08-04. Système d'import déjà générique, juste une config `adherentsImportConfig` de plus. Point résolu : la contrainte d'unicité `id_externe` par organisation, notée "ouverte" au cadrage, existait déjà (`import_id_externe_unique_constraints.sql` pour participants/activités, incluse dès l'étape 1 pour `adherents`). Décision clé : les champs de cycle (`adhesions`) ne passent jamais par l'écran de conflits du wizard, la décision "nouveau cycle ou non" est calculée côté client par comparaison au dernier cycle existant. **`date_fin` calculée automatiquement** (cycle glissant d'1 an depuis `date_debut`, `lib/adhesion.ts` `computeDateFin`) — gap découvert en session (rien ne la renseignait nulle part, le statut Actif/Expiré et la carte dashboard restaient inopérants), corrigé pour la création, le renouvellement et l'import
  5. ⏳ Gabarit carte adhérent + impression planche A4 — **codée, PR #39 ouverte, en attente de test utilisateur** (format carte de crédit ISO/IEC 7810 85,6×54mm, contenu identité+validité+logo — décisions confirmées avant codage). Nouvelle table `templates_carte_adherent` (bypass super-admin inclus dès le départ, contrairement à `templates_recu` qui avait dû être corrigé après coup), nouvelle edge function `generate-cartes-adherents` (grille 2×5 par page A4, un seul appel Gotenberg, PDF binaire direct sans persistance), sélection multiple sur `AdherentsPage.tsx` conçue de zéro (aucun pattern existant). Migrations + déploiement + requêtes de données + rendu HTML vérifiés en prod ; génération PDF réelle non testable côté agent
  6. *(Prio basse, hors scope V1)* Mécanisme de sélection d'un adhérent à la saisie d'un don + gestion du doublonnement

**Bugs trouvés en testant la PR #38, corrigés dans cette même PR :**
- Cotisation d'import à `0` rejetée à tort (validation calquée sur celle des dons, où 0 n'a pas de sens) — corrigé, 0 est légitime pour une adhésion (organisation qui ne fait pas payer de cotisation)
- Mode de paiement toujours validé même sans cotisation — corrigé via un nouveau hook générique `ImportConfig.postProcessRow`, ignore l'erreur sur `mode_paiement` quand `montant_cotisation` est nul/à 0
- Mojibake UTF-8 relu en Windows-1252 sur les données source ("PHENG MÃ©lanie" au lieu de "Mélanie") — réparation automatique ajoutée dans `parseFile.ts`, générique à tous les imports (pas seulement adhérents)

**Limitation découverte (non corrigée, décision utilisateur) :** les 4 fonctions RPC d'import (`import_upsert_participants`/`activites`/`dons`/`adherents`) échouent avec "Unauthorized: no organisation context" en mode super-admin "Consulter" — `current_user_organisation_id()` cherche une ligne `profils_organisation` pour l'utilisateur connecté, qu'un super-admin en consultation n'a pas. Pré-existante à ces 3 premières fonctions, jamais remarquée avant le test adhérents. Décision : se connecter en admin normal pour tester les imports plutôt que de modifier les fonctions (qui touchent des imports déjà en prod) — à reconsidérer seulement si le besoin d'importer "pour le compte d'une organisation" en tant que super-admin émerge un jour.

  **Point resté ouvert, non bloquant** : contrainte d'unicité `id_externe` par organisation, à trancher en même temps que celle déjà en attente sur les activités

  **✅ Étape 1 terminée (2026-08-03)** — migrations `adherents.sql`/`adhesions.sql` exécutées en prod via `supabase db query --linked` après vérification des 3 points en attente :
  - `is_super_admin()` **n'existe pas** comme fonction dans ce projet (seule `current_effective_organisation_id()` existe, uuid sans argument) — les policies rédigées initialement avec `(select is_super_admin())` ont été corrigées avant exécution pour utiliser l'expression inline `((select auth.jwt()) -> 'app_metadata' ->> 'is_super_admin')::boolean = true`, le même pattern que `super_admin_rls.sql`/`rls_auth_initplan_perf.sql`
  - `pg_trgm` : confirmé non installée ailleurs sur ce projet, schéma `extensions` existant — activée sans souci
  - `mode_paiement` : confirmé `smallint` côté `dons`, contrainte `CHECK` à `[1,2,3,4]` (1=Espèces, 2=Chèque, 3=Prélèvement-virement, 4=Autres, cf. `src/lib/modePaiement.ts`) — la même contrainte CHECK a été ajoutée sur `adhesions.mode_paiement` (absente du brouillon initial) pour rester cohérente
  - Aucune PR ouverte au démarrage de cette étape

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