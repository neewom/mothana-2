-- Migration: adherents.sql
-- Création de la table adherents (module Adhérents, cadré le 2026-08-03)
-- Population distincte des profils_participant (donateurs) : pas de lien direct en base pour l'instant.

CREATE TABLE adherents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,

  id_externe text,

  -- Civilité réduite, distincte de l'enum civilité à 7 valeurs de `personnes` (pas de personne morale/famille adhérente)
  civilite smallint NOT NULL DEFAULT 0
    CONSTRAINT adherents_civilite_check CHECK (civilite IN (0, 1, 2)), -- 0=non défini, 1=Monsieur, 2=Madame

  nom text NOT NULL,
  prenom text,
  date_naissance date,

  adresse text,
  code_postal text,
  ville text,

  telephone text,
  courriel text,

  statut text NOT NULL DEFAULT 'actif'
    CONSTRAINT adherents_statut_check CHECK (statut IN ('actif', 'archive')),

  statuts_acceptes boolean NOT NULL DEFAULT true,
  consent_rgpd boolean NOT NULL DEFAULT false,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT adherents_id_externe_unique UNIQUE (organisation_id, id_externe)
);

CREATE INDEX idx_adherents_organisation_id ON adherents(organisation_id);
CREATE INDEX idx_adherents_statut ON adherents(organisation_id, statut);

-- Recherche nom/prénom (filtre "nom + prénom ou inversement" côté page liste)
-- Nécessite pg_trgm (vérifié 2026-08-03 : pas déjà installée ailleurs sur ce projet)
CREATE EXTENSION IF NOT EXISTS pg_trgm WITH SCHEMA extensions;

CREATE INDEX idx_adherents_nom_prenom ON adherents USING gin (
  (nom || ' ' || coalesce(prenom, '')) extensions.gin_trgm_ops
);

-- Trigger updated_at (même pattern que templates_recu)
CREATE OR REPLACE FUNCTION set_updated_at_adherents()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_adherents_updated_at
  BEFORE UPDATE ON adherents
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at_adherents();

-- RLS
ALTER TABLE adherents ENABLE ROW LEVEL SECURITY;

-- Pattern (select ...) recommandé Supabase (cf. migration rls_auth_initplan_perf.sql), pour éviter
-- la ré-évaluation de auth.jwt()/current_effective_organisation_id() ligne par ligne.
-- Bypass super-admin : pas de fonction is_super_admin() dans ce projet (vérifié 2026-08-03) —
-- même expression inline que rls_auth_initplan_perf.sql/super_admin_rls.sql.
CREATE POLICY adherents_select ON adherents
  FOR SELECT
  USING (
    organisation_id = (select current_effective_organisation_id())
    OR (((select auth.jwt()) -> 'app_metadata' ->> 'is_super_admin'))::boolean = true
  );

CREATE POLICY adherents_insert ON adherents
  FOR INSERT
  WITH CHECK (
    organisation_id = (select current_effective_organisation_id())
    OR (((select auth.jwt()) -> 'app_metadata' ->> 'is_super_admin'))::boolean = true
  );

CREATE POLICY adherents_update ON adherents
  FOR UPDATE
  USING (
    organisation_id = (select current_effective_organisation_id())
    OR (((select auth.jwt()) -> 'app_metadata' ->> 'is_super_admin'))::boolean = true
  )
  WITH CHECK (
    organisation_id = (select current_effective_organisation_id())
    OR (((select auth.jwt()) -> 'app_metadata' ->> 'is_super_admin'))::boolean = true
  );

CREATE POLICY adherents_delete ON adherents
  FOR DELETE
  USING (
    organisation_id = (select current_effective_organisation_id())
    OR (((select auth.jwt()) -> 'app_metadata' ->> 'is_super_admin'))::boolean = true
  );

COMMENT ON TABLE adherents IS 'Adhérents des organisations (module Adhérents, distinct des donateurs profils_participant)';
COMMENT ON COLUMN adherents.civilite IS '0=non défini, 1=Monsieur, 2=Madame — enum dédié, distinct de personnes.civilite';
COMMENT ON COLUMN adherents.statut IS 'Soft delete : actif ou archive (jamais de hard delete)';
