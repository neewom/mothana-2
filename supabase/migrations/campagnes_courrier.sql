-- Migration: campagnes_courrier.sql
-- Cadré 2026-09-11 (carte Trello "Campagne courrier : impression de planches
-- d'étiquettes adhérents (14/A4)") : historique minimal des campagnes
-- courrier générées (date, activité concernée, sélection, nombre de
-- destinataires) — même convention que campagnes_mailing.sql. Écrite
-- exclusivement par l'Edge Function generate-campagne-courrier (service
-- role, après génération PDF réussie) : aucune policy INSERT pour les
-- utilisateurs authentifiés, seule la lecture est ouverte à l'admin de
-- l'organisation.

CREATE TABLE campagnes_courrier (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  activite_id uuid NOT NULL REFERENCES activites(id),

  -- Libellé de la sélection de destinataires au moment de la génération
  -- (ex. "Adhérents actifs", "Liste : Bénévoles") — texte figé, pas une
  -- référence recalculable (la sélection réelle peut changer après coup).
  selection_label text NOT NULL,

  nombre_destinataires int NOT NULL,
  nombre_exclus int NOT NULL DEFAULT 0,

  genere_par uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_campagnes_courrier_organisation_id ON campagnes_courrier(organisation_id, created_at DESC);

-- RLS (même pattern que campagnes_mailing.sql)
ALTER TABLE campagnes_courrier ENABLE ROW LEVEL SECURITY;

CREATE POLICY campagnes_courrier_select ON campagnes_courrier
  FOR SELECT
  TO authenticated
  USING (
    organisation_id = (select current_effective_organisation_id())
    OR (((select auth.jwt()) -> 'app_metadata' ->> 'is_super_admin'))::boolean = true
  );

COMMENT ON TABLE campagnes_courrier IS 'Historique minimal des campagnes courrier générées (planches d''étiquettes adhérents) — écrite uniquement par l''Edge Function generate-campagne-courrier, pas de policy INSERT client';
COMMENT ON COLUMN campagnes_courrier.nombre_exclus IS 'Nombre d''adhérents exclus de la génération faute d''adresse postale complète';
