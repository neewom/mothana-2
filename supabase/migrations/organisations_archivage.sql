-- Migration: organisations_archivage.sql
-- Cadré 2026-08-22 (carte Trello "Suppression d'organisation : étape
-- d'archivage intermédiaire") : le garde-fou de suppression existant
-- (PR #81/#86, stats + confirmation nominative) protège contre une faute de
-- frappe, mais pas contre une suppression volontaire mais prématurée. Ajout
-- d'un état intermédiaire "archivée" (réversible) permettant d'extraire les
-- données avant la suppression définitive.
-- Pas de policy RLS dédiée : org_select/org_update_admin (super_admin_rls.sql
-- / rls_auth_initplan_perf.sql) couvrent déjà lecture/écriture super-admin +
-- admin de l'organisation sur toute la table organisations. Le blocage de
-- connexion pour une organisation archivée est géré côté applicatif
-- (loginAdmin, verify-pin), pas via RLS.

ALTER TABLE organisations
  ADD COLUMN archived_at timestamptz;

COMMENT ON COLUMN organisations.archived_at IS 'null = organisation active. Renseigné = archivée (réversible) : connexion bloquée pour ses admins/bénévoles, masquée du tableau principal super-admin, en attente d''extraction/suppression définitive depuis l''onglet "Archivées"';
