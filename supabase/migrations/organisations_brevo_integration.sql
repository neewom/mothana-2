-- Migration: organisations_brevo_integration.sql
-- Cadré 2026-08-13 (carte Trello "Campagnes de mailing d'information aux
-- adhérents via Brevo") : intégration Brevo par organisation (chaque
-- organisation a son propre compte/clé, pas un secret partagé plateforme).
-- Visible/modifiable par l'admin de l'organisation, même logique que
-- code_pin_benevole (organisations.sql).

ALTER TABLE organisations
  ADD COLUMN brevo_api_key text,
  ADD COLUMN brevo_expediteur_nom text,
  ADD COLUMN brevo_expediteur_email text;

COMMENT ON COLUMN organisations.brevo_api_key IS 'Clé API Brevo propre à l''organisation, utilisée par l''Edge Function send-mailing-brevo (jamais exposée au-delà de l''admin de son organisation via RLS)';
COMMENT ON COLUMN organisations.brevo_expediteur_nom IS 'Nom d''expéditeur affiché dans les campagnes mailing Brevo';
COMMENT ON COLUMN organisations.brevo_expediteur_email IS 'Email d''expéditeur, doit être un expéditeur vérifié côté compte Brevo de l''organisation';
