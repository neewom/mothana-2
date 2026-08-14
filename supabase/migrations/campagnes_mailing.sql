-- Migration: campagnes_mailing.sql
-- Cadré 2026-08-13 (carte Trello "Campagnes de mailing d'information aux
-- adhérents via Brevo") : historique minimal des campagnes envoyées
-- (date, sujet, nombre de destinataires) — pas de suivi ouvertures/clics.
-- Écrite exclusivement par l'Edge Function send-mailing-brevo (service
-- role, après envoi effectif réussi) : aucune policy INSERT pour les
-- utilisateurs authentifiés, seule la lecture est ouverte à l'admin de
-- l'organisation. Même convention RLS que journal_modifications.sql.

CREATE TABLE campagnes_mailing (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,

  sujet text NOT NULL,
  corps_html text NOT NULL,

  nombre_destinataires int NOT NULL,
  nombre_exclus int NOT NULL DEFAULT 0,

  envoye_par uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_campagnes_mailing_organisation_id ON campagnes_mailing(organisation_id, created_at DESC);

-- RLS
ALTER TABLE campagnes_mailing ENABLE ROW LEVEL SECURITY;

-- Pattern (select ...) + bypass super-admin inline, même convention que journal_modifications.sql
CREATE POLICY campagnes_mailing_select ON campagnes_mailing
  FOR SELECT
  TO authenticated
  USING (
    organisation_id = (select current_effective_organisation_id())
    OR (((select auth.jwt()) -> 'app_metadata' ->> 'is_super_admin'))::boolean = true
  );

COMMENT ON TABLE campagnes_mailing IS 'Historique minimal des campagnes mailing envoyées via Brevo (sujet, nombre de destinataires) — écrite uniquement par l''Edge Function send-mailing-brevo, pas de policy INSERT client';
COMMENT ON COLUMN campagnes_mailing.nombre_exclus IS 'Nombre d''adhérents exclus de l''envoi faute d''email renseigné';
