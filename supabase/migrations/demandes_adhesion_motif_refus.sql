-- Migration: demandes_adhesion_motif_refus.sql
-- Cadré 2026-08-08 (carte Trello "Champ observation en cas de refus") :
-- motif de refus saisi par l'admin, usage interne uniquement — pas d'email
-- envoyé au demandeur (aucun envoi d'email n'existe pour ce module, cf.
-- session 2026-08-05).

ALTER TABLE demandes_adhesion ADD COLUMN motif_refus text;

COMMENT ON COLUMN demandes_adhesion.motif_refus IS 'Motif de refus saisi par l''admin lors du refus, usage interne uniquement (non transmis au demandeur)';
