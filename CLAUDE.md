# CLAUDE.md — Mothana (Gestion des dons)

Ce fichier est lu automatiquement par Claude Code à chaque session. Il contient le contexte du projet, les conventions à respecter, et l'état d'avancement.

---

## Session Continuity

### En début de session
- Chercher automatiquement le fichier de la dernière session dans `.claude/sessions/`
- Identifier où on s'est arrêté et les blockers en cours
- Résumer en 3 lignes avant de commencer

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

### 🔄 En cours — Priorité 1 : Refonte Cerfa

Voir `docs/brief-cerfa.md` pour le brief technique complet. Ordre d'implémentation :

1. ✅ **Migrations SQL** (brief §1) — exécutées en production le 2026-07-17 :
   - Colonnes adresse sur `organisations` (`organisations_adresse_fiscale.sql`)
   - Table `templates_recu` (`templates_recu.sql`) — trigger `updated_at` ajouté en plus du brief, cohérent avec les autres tables
   - Champs `numero_ordre`, `type_cerfa`, `snapshot_donateur`, `snapshot_organisation`, `template_id`, `email_envoye_at` sur `recus_fiscaux` (`recus_fiscaux_cerfa_fields.sql`)
   - Fonction SQL `next_numero_recu()` (`next_numero_recu.sql`), numérotation atomique par séquence PostgreSQL dédiée par org/année — testée sur Wat Velouvanaram (`2026-001`), séquence remise à zéro après le test (`is_called: false`) pour ne pas brûler le premier numéro réel
   - ✅ Chevauchement avec les données existantes de `modele_recu_pdf` résolu : seule `adresse` (chaîne combinée "rue, CP Ville") avait une vraie donnée (Wat Velouvanaram) — backfillée vers les colonnes structurées via `organisations_backfill_adresse.sql` (regex sur le CP à 5 chiffres). `siret` (valeur placeholder `"..."`) et `objet_association` (vide) n'avaient pas de donnée réelle exploitable : pas de backfill, seront simplement ressaisis en `rna`/`siren`/`objet_social` à l'étape 2

2. 🔄 **Paramètres organisation** (brief §5) — code prêt sur `feat/cerfa-parametres-organisation` (commit local, PR pas encore ouverte : utilisateur teste manuellement avant push, cf. "Décisions") :
   - Section "Informations fiscales" de `ParametresPage.tsx` refondue : adresse structurée (`organisations.adresse`/`code_postal`/`ville`/`pays`), RNA, SIREN, objet social, mention légale (pré-remplie), numéro du premier reçu, taux de réduction fiscale (défaut 66%, éditable pour les orgs à 75%) — tous dans `modele_recu_pdf` JSONB sauf l'adresse
   - Remplace l'ancien modèle `siret`/`objet_association`/`mentions_complementaires` (aucune donnée réelle en prod hors adresse déjà migrée en étape 1, confirmé par requête directe avant la refonte)
   - Bannière d'obligations légales affichée (conservation 6 ans, déclaration article 222 bis CGI, amende 66%)
   - Build/lint/typecheck OK ; app testée au chargement (aucune erreur console) — test complet du formulaire (saisie/sauvegarde/persistance DB) laissé à la charge de l'utilisateur, pas d'identifiants admin disponibles pour l'agent

3. **Templates HTML par défaut** (brief §3) :
   - Deux templates conformes Cerfa (11580 particuliers + 16216 entreprises/personnes morales)
   - Seedés automatiquement à la création d'une organisation
   - Placeholders `{{variable}}` selon liste du brief §2.2

4. **Refonte Edge Function `generate-recu`** (brief §2) :
   - Abandonner pdf-lib
   - Intégrer Gotenberg (service HTML→PDF, à déployer sur Railway ou Render)
   - Nouveau flux complet (brief §2.3)
   - Règles de formatage du nom du donateur (brief §4)

5. **Évolutions UI page Reçus fiscaux** (brief §6) :
   - Bannière de blocage si paramètres incomplets
   - Icônes ⚠️ par ligne participant avec tooltip champs manquants
   - Colonnes N° reçu et Type dans la liste
   - Bouton Regénérer avec confirmation

6. **Gestion des templates** dans Paramètres (brief §7) :
   - Liste templates par type, éditeur Monaco, prévisualisation iframe
   - Activation, archivage, suppression (si jamais utilisé)

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