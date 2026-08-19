-- Migration: mailing_opt_out.sql
-- Cadré 2026-08-17 (carte Trello "Désinscription mailing (RGPD)") : opt-out
-- par lien dans chaque email + toggle admin manuel. Portée limitée aux
-- campagnes mailing (Brevo) — aucun impact sur les emails transactionnels
-- (reset password, invitation admin) ni sur consent_rgpd (consentement
-- d'adhésion, notion distincte).
--
-- mailing_unsubscribe_token a un DEFAULT volatile (gen_random_uuid()) :
-- Postgres calcule une valeur distincte par ligne existante au moment de
-- l'ALTER TABLE, pas de backfill manuel nécessaire.

ALTER TABLE adherents
  ADD COLUMN mailing_opt_out boolean NOT NULL DEFAULT false,
  ADD COLUMN mailing_opt_out_at timestamptz,
  ADD COLUMN mailing_unsubscribe_token uuid NOT NULL DEFAULT gen_random_uuid();

CREATE UNIQUE INDEX idx_adherents_mailing_unsubscribe_token ON adherents(mailing_unsubscribe_token);

COMMENT ON COLUMN adherents.mailing_opt_out IS 'Désinscription des campagnes mailing (Brevo) — distinct de consent_rgpd (consentement d''adhésion)';
COMMENT ON COLUMN adherents.mailing_unsubscribe_token IS 'Token public utilisé dans le lien de désinscription des emails mailing (route /desinscription)';
