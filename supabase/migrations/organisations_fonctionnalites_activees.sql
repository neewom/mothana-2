-- Migration: organisations_fonctionnalites_activees.sql
-- Cadré 2026-08-21 (carte Trello "Switches d'activation de fonctionnalités par
-- organisation") : le super-admin peut activer/désactiver certaines
-- fonctionnalités par organisation (Dons, Adhérents — Coupon Pagode viendra
-- s'ajouter plus tard). Stockage jsonb extensible sans nouvelle migration à
-- chaque feature ajoutée. Pas de policy RLS dédiée : org_select/org_update_admin
-- (super_admin_rls.sql / rls_auth_initplan_perf.sql) couvrent déjà lecture/
-- écriture super-admin + admin de l'organisation sur toute la table organisations.

ALTER TABLE organisations
  ADD COLUMN fonctionnalites_activees jsonb NOT NULL DEFAULT '{"dons": true, "adherents": true}'::jsonb;

COMMENT ON COLUMN organisations.fonctionnalites_activees IS 'Fonctionnalités activées pour l''organisation ({"dons": bool, "adherents": bool}, extensible) — contrôle UI/navigation uniquement, pas une frontière de sécurité RLS';
