-- Migration: journal_modifications_filtre_ligne.sql
-- Cadré 2026-08-08 : ajout d'un filtre optionnel table_cible/ligne_id à
-- list_journal_modifications, pour afficher l'historique d'un adhérent
-- précis dans la modale de détail (AdherentModal), en plus de la vue
-- globale par organisation déjà utilisée dans Paramètres.
-- CREATE OR REPLACE avec nouveaux paramètres en fin de liste, tous avec
-- valeur par défaut : compatible avec les appels existants sans filtre.

CREATE OR REPLACE FUNCTION list_journal_modifications(
  p_organisation_id uuid,
  p_limit int DEFAULT 10,
  p_offset int DEFAULT 0,
  p_table_cible text DEFAULT NULL,
  p_ligne_id uuid DEFAULT NULL
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
    AND (p_table_cible IS NULL OR jm.table_cible = p_table_cible)
    AND (p_ligne_id IS NULL OR jm.ligne_id = p_ligne_id)
  ORDER BY jm.created_at DESC
  LIMIT p_limit OFFSET p_offset;
$$;
