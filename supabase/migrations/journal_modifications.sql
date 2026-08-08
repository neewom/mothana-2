-- Migration: journal_modifications.sql
-- Cadré 2026-08-08 (carte Trello "Log des modifications") : journal
-- d'audit générique (table/ligne/action/auteur/horodatage), conçu pour
-- être étendu progressivement à tous les modules. Périmètre de départ :
-- adhérents (création/modification/archivage/réactivation) et demandes
-- d'adhésion (ratification/refus) uniquement — décision utilisateur.
-- Append-only : aucune policy UPDATE/DELETE, le journal est immuable.

CREATE TABLE journal_modifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,

  -- Nom de table cible (pas de FK générique possible sur plusieurs tables)
  table_cible text NOT NULL,
  ligne_id uuid NOT NULL,

  action text NOT NULL,
  details jsonb,

  auteur_id uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_journal_modifications_organisation_id ON journal_modifications(organisation_id, created_at DESC);
CREATE INDEX idx_journal_modifications_ligne ON journal_modifications(table_cible, ligne_id);

-- RLS
ALTER TABLE journal_modifications ENABLE ROW LEVEL SECURITY;

-- Pattern (select ...) + bypass super-admin inline, même convention que adherents.sql/demandes_adhesion.sql
CREATE POLICY journal_modifications_select ON journal_modifications
  FOR SELECT
  TO authenticated
  USING (
    organisation_id = (select current_effective_organisation_id())
    OR (((select auth.jwt()) -> 'app_metadata' ->> 'is_super_admin'))::boolean = true
  );

CREATE POLICY journal_modifications_insert ON journal_modifications
  FOR INSERT
  TO authenticated
  WITH CHECK (
    organisation_id = (select current_effective_organisation_id())
    OR (((select auth.jwt()) -> 'app_metadata' ->> 'is_super_admin'))::boolean = true
  );

COMMENT ON TABLE journal_modifications IS 'Journal d''audit générique (append-only) : table cible, ligne, action, auteur, horodatage. Périmètre de départ : adherents + demandes_adhesion (2026-08-08)';
COMMENT ON COLUMN journal_modifications.table_cible IS 'Nom de la table concernée par la modification (ex: adherents, demandes_adhesion)';
COMMENT ON COLUMN journal_modifications.action IS 'Nature de la modification (ex: creation, modification, archivage, reactivation, ratification, refus)';
COMMENT ON COLUMN journal_modifications.details IS 'Contexte optionnel de l''action (ex: motif de refus, nom/prénom pour affichage) — libre, non structuré';

-- RPC paginée pour la section "Historique des modifications" (Paramètres) —
-- même convention que search_adherents (total_count via window function,
-- security invoker, filtre organisation_id redondant avec la RLS mais
-- volontaire). Jointure profils_organisation pour afficher le nom de
-- l'auteur (nom_affiche, peut être NULL si jamais renseigné par l'admin) ;
-- profils_organisation est lisible par les admins de leur propre
-- organisation (policy profils_org_select), donc la jointure fonctionne
-- sous security invoker sans avoir besoin de security definer.
CREATE OR REPLACE FUNCTION list_journal_modifications(
  p_organisation_id uuid,
  p_limit int DEFAULT 10,
  p_offset int DEFAULT 0
)
RETURNS TABLE (
  id uuid,
  table_cible text,
  ligne_id uuid,
  action text,
  details jsonb,
  auteur_id uuid,
  auteur_nom text,
  created_at timestamptz,
  total_count bigint
)
LANGUAGE sql
STABLE
AS $$
  SELECT
    jm.id, jm.table_cible, jm.ligne_id, jm.action, jm.details,
    jm.auteur_id, po.nom_affiche AS auteur_nom, jm.created_at,
    count(*) OVER() AS total_count
  FROM journal_modifications jm
  LEFT JOIN profils_organisation po
    ON po.utilisateur_id = jm.auteur_id AND po.organisation_id = jm.organisation_id
  WHERE jm.organisation_id = p_organisation_id
  ORDER BY jm.created_at DESC
  LIMIT p_limit OFFSET p_offset;
$$;
