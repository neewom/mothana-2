-- Migration: adherents_demandes_adhesion_pays.sql
-- Ajout d'un champ Pays sur les formulaires adhérent (admin + public), select avec
-- valeur par défaut "France" côté frontend.

ALTER TABLE adherents ADD COLUMN pays text DEFAULT 'France';
ALTER TABLE demandes_adhesion ADD COLUMN pays text DEFAULT 'France';

COMMENT ON COLUMN adherents.pays IS 'Pays de résidence, saisi via select (défaut France)';
COMMENT ON COLUMN demandes_adhesion.pays IS 'Pays de résidence, saisi via select (défaut France)';
