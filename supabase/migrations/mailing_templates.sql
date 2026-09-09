-- Migration: mailing_templates.sql
-- Cadré 2026-08-20 (carte Trello "Modèles réutilisables pour les campagnes
-- mailing", évoqué le 2026-08-14 pendant le dev de campagnes_mailing.sql,
-- volontairement gardé hors scope à l'époque) : sauvegarder un message de
-- campagne (sujet + corps) comme modèle réutilisable, en base par
-- organisation — même pattern que templates_recu / templates_carte_adherent,
-- pas du localStorage (le brouillon courant reste en localStorage, mécanisme
-- distinct et complémentaire, cf. CampagneMailingPage.tsx).
-- Pièce jointe volontairement exclue du modèle (comme le brouillon).

CREATE TABLE mailing_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  nom text NOT NULL,
  sujet text NOT NULL,
  corps_html text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT mailing_templates_nom_unique UNIQUE (organisation_id, nom)
);

CREATE INDEX idx_mailing_templates_organisation_id ON mailing_templates(organisation_id);

-- RLS (même pattern que listes_diffusion.sql)
ALTER TABLE mailing_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY mailing_templates_select ON mailing_templates
  FOR SELECT
  USING (
    organisation_id = (select current_effective_organisation_id())
    OR (((select auth.jwt()) -> 'app_metadata' ->> 'is_super_admin'))::boolean = true
  );

CREATE POLICY mailing_templates_insert ON mailing_templates
  FOR INSERT
  WITH CHECK (
    organisation_id = (select current_effective_organisation_id())
    OR (((select auth.jwt()) -> 'app_metadata' ->> 'is_super_admin'))::boolean = true
  );

CREATE POLICY mailing_templates_update ON mailing_templates
  FOR UPDATE
  USING (
    organisation_id = (select current_effective_organisation_id())
    OR (((select auth.jwt()) -> 'app_metadata' ->> 'is_super_admin'))::boolean = true
  )
  WITH CHECK (
    organisation_id = (select current_effective_organisation_id())
    OR (((select auth.jwt()) -> 'app_metadata' ->> 'is_super_admin'))::boolean = true
  );

CREATE POLICY mailing_templates_delete ON mailing_templates
  FOR DELETE
  USING (
    organisation_id = (select current_effective_organisation_id())
    OR (((select auth.jwt()) -> 'app_metadata' ->> 'is_super_admin'))::boolean = true
  );

COMMENT ON TABLE mailing_templates IS 'Modèles de campagnes mailing réutilisables (sujet + corps HTML) par organisation, distincts du brouillon localStorage de CampagneMailingPage.';
