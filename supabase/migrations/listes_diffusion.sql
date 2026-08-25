-- Migration: listes_diffusion.sql
-- Revient sur la décision initiale de adherents_tags.sql (pas de table dédiée,
-- les tags émergent de l'usage) : l'utilisateur veut pouvoir créer une liste
-- avant qu'elle ne soit portée par un adhérent (ex. préparer une liste vide,
-- l'alimenter plus tard). adherents.tags reste la source de vérité de
-- l'appartenance (pas de refonte du filtrage/mailing déjà en place) —
-- listes_diffusion n'est qu'un registre des noms de liste qui existent pour
-- l'organisation, alimenté automatiquement par trigger dès qu'un tag est
-- utilisé sur un adhérent (RPC add_adherents_tag ou édition individuelle),
-- pour ne pas dupliquer cette logique côté client à plusieurs endroits.

CREATE TABLE listes_diffusion (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  nom text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT listes_diffusion_nom_unique UNIQUE (organisation_id, nom)
);

CREATE INDEX idx_listes_diffusion_organisation_id ON listes_diffusion(organisation_id);

-- RLS (même pattern que adherents.sql)
ALTER TABLE listes_diffusion ENABLE ROW LEVEL SECURITY;

CREATE POLICY listes_diffusion_select ON listes_diffusion
  FOR SELECT
  USING (
    organisation_id = (select current_effective_organisation_id())
    OR (((select auth.jwt()) -> 'app_metadata' ->> 'is_super_admin'))::boolean = true
  );

CREATE POLICY listes_diffusion_insert ON listes_diffusion
  FOR INSERT
  WITH CHECK (
    organisation_id = (select current_effective_organisation_id())
    OR (((select auth.jwt()) -> 'app_metadata' ->> 'is_super_admin'))::boolean = true
  );

CREATE POLICY listes_diffusion_update ON listes_diffusion
  FOR UPDATE
  USING (
    organisation_id = (select current_effective_organisation_id())
    OR (((select auth.jwt()) -> 'app_metadata' ->> 'is_super_admin'))::boolean = true
  )
  WITH CHECK (
    organisation_id = (select current_effective_organisation_id())
    OR (((select auth.jwt()) -> 'app_metadata' ->> 'is_super_admin'))::boolean = true
  );

CREATE POLICY listes_diffusion_delete ON listes_diffusion
  FOR DELETE
  USING (
    organisation_id = (select current_effective_organisation_id())
    OR (((select auth.jwt()) -> 'app_metadata' ->> 'is_super_admin'))::boolean = true
  );

COMMENT ON TABLE listes_diffusion IS 'Registre des listes de diffusion existantes par organisation (nom) — indépendant de adherents.tags, qui reste la source de vérité de l''appartenance. Permet à une liste d''exister avec 0 adhérent.';

-- ---------------------------------------------------------------------------
-- Backfill : enregistrer les tags déjà en usage (créés avant cette migration)
-- ---------------------------------------------------------------------------

INSERT INTO listes_diffusion (organisation_id, nom)
SELECT DISTINCT a.organisation_id, t
FROM adherents a, unnest(a.tags) AS t
ON CONFLICT (organisation_id, nom) DO NOTHING;

-- ---------------------------------------------------------------------------
-- Trigger : dès qu'un tag apparaît sur adherents.tags (insert ou update),
-- l'enregistrer automatiquement dans listes_diffusion s'il n'y est pas déjà.
-- Couvre tous les chemins d'écriture (RPC add_adherents_tag, édition
-- individuelle depuis AdherentModal, futur import) sans dupliquer la logique
-- côté client.
-- ---------------------------------------------------------------------------

-- Pas de SECURITY DEFINER : l'insert dans listes_diffusion passe par sa
-- propre policy RLS (organisation_id = current_effective_organisation_id()),
-- déjà satisfaite pour un admin qui modifie un adhérent de sa propre
-- organisation — inutile d'élargir les privilèges du trigger.
CREATE OR REPLACE FUNCTION sync_listes_diffusion_from_tags()
RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'INSERT' OR NEW.tags IS DISTINCT FROM OLD.tags THEN
    INSERT INTO listes_diffusion (organisation_id, nom)
    SELECT NEW.organisation_id, t
    FROM unnest(NEW.tags) AS t
    ON CONFLICT (organisation_id, nom) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_adherents_sync_listes_diffusion
  AFTER INSERT OR UPDATE OF tags ON adherents
  FOR EACH ROW
  EXECUTE FUNCTION sync_listes_diffusion_from_tags();

-- ---------------------------------------------------------------------------
-- list_adherent_tags devient inutile : les 3 sélecteurs (AdherentsPage,
-- AdherentModal, CampagneMailingPage) lisent désormais listes_diffusion
-- directement (table simple, RLS déjà suffisante — pas besoin de RPC).
-- ---------------------------------------------------------------------------

DROP FUNCTION IF EXISTS list_adherent_tags(uuid);
