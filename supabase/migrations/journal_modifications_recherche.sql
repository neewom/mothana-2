-- Migration: journal_modifications_recherche.sql
-- Gabarit de liste (2026-10) : tout tableau qui peut grossir a une recherche. Le journal
-- des adhérents est paginé côté serveur, la recherche passe donc par la RPC : paramètre
-- optionnel p_recherche (nom/prénom de l'adhérent ou de la demande, nom de l'auteur),
-- sans accents ni casse, 2 caractères minimum (en dessous, ignoré).
--
-- Comme pour journal_modifications_filtre_ligne.sql : ajouter un paramètre change la
-- signature, CREATE OR REPLACE créerait une seconde surcharge (appels ambigus). On DROP
-- donc explicitement l'ancienne signature avant de recréer la fonction.
--
-- Sécurité inchangée : fonction SECURITY INVOKER (défaut), la RLS de journal_modifications
-- (org-scopée + bypass super-admin) reste la garde. On retire au passage l'EXECUTE de
-- public/anon, jamais utile ici (appelée uniquement par un client authentifié).
DROP FUNCTION IF EXISTS list_journal_modifications(uuid, int, int, text, uuid);

CREATE OR REPLACE FUNCTION list_journal_modifications(
  p_organisation_id uuid,
  p_limit int DEFAULT 10,
  p_offset int DEFAULT 0,
  p_table_cible text DEFAULT NULL,
  p_ligne_id uuid DEFAULT NULL,
  p_recherche text DEFAULT NULL
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
SET search_path = public, extensions
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
    AND (
      p_recherche IS NULL
      OR length(trim(p_recherche)) < 2
      OR unaccent(lower(concat_ws(' ', jm.details->>'prenom', jm.details->>'nom', po.nom_affiche)))
         LIKE '%' || replace(replace(replace(unaccent(lower(trim(p_recherche))), '\', '\\'), '%', '\%'), '_', '\_') || '%'
    )
  ORDER BY jm.created_at DESC
  LIMIT p_limit OFFSET p_offset;
$$;

REVOKE EXECUTE ON FUNCTION list_journal_modifications(uuid, int, int, text, uuid, text) FROM public, anon;
GRANT EXECUTE ON FUNCTION list_journal_modifications(uuid, int, int, text, uuid, text) TO authenticated, service_role;
