# 2026-10-21 — Session dev (Claude Code dev) : batch « Adhésions & campagnes »

Go utilisateur transmis par le lead tech pour le batch « Batch — Adhésions & campagnes » (8 cartes, non empilé : chaque branche part de `origin/dev`, chaque PR cible `dev`, merges en fin de batch par le lead tech). Tickets rédigés sur `origin/dev` à 2adb5ed.

## Réalisé
- **Carte 1 — Durée d'adhésion réglable** (https://trello.com/c/cDM66MAZ) — PR #265, ready for review. Migration `adhesion_duree_reglable.sql` (staging) : colonnes `organisations.adhesion_regle_fin` / `adhesion_mois_bascule`, `calculer_date_fin_adhesion` + trigger `trg_adhesions_poser_date_fin` (source de vérité, refuse une date nulle), `apercu_recalage_adhesions` / `recalculer_dates_fin_adhesions` (super-admin ou utilisateur de l'org via profils_organisation, journalisé), `import_upsert_adherents` sur la même règle. Garde `organisations_fonctionnalites_super_admin` : ne couvre que `fonctionnalites_activees`, pas de conflit. Tests SQL `supabase/tests/adhesion_duree_reglable.sql` (10 cas OK). Front : miroir `computeDateFin` (29/02 → 28/02 comme PostgreSQL, l'ancien JS donnait 01/03), « Valable jusqu'au … » sous la date d'adhésion (création, renouvellement), date de fin relue depuis la base après insertion, section « Durée des adhésions » + confirmation du recalage, journal lisible, FAQ. Bug trouvé en test : renouvellement sans `organisation_id` (lignes de search_adherents) → corrigé via `useOrganisationId`. Org démo remise à l'identique après test (empreinte des dates identique) ; 2 entrées « Recalcul des dates de fin » restent au journal (immuable).
- **Retour utilisateur sur #265** (via le lead tech) : avec la règle du 31/12, les fins se ressemblent → afficher la date d'adhésion. Ajouté sur #265 : colonne optionnelle « Date d'adhésion » (dernière adhésion, JJ/MM/AAAA) dans « Colonnes », reprise dans l'export (après « Adhésion ») ; section « Adhésions » en lecture seule dans la fiche (cycles du plus récent au plus ancien : date d'adhésion, fin, cotisation, mode de paiement, renouvellement). Vérifié à 375 px.

## Reste à faire
- Cartes 2 à 8.
- Promotion carte 1 : vérifier en prod qu'aucune adhésion ne s'écarte de « + 1 an » avant de proposer un recalage (staging : 0).

## Blockers
- Aucun.
