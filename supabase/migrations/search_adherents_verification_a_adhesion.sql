-- Migration: search_adherents_verification_a_adhesion.sql
-- Carte Trello « [M] Renouvellements : état « À renouveler » et vocabulaire unique »
-- (https://trello.com/c/lpFg4vvc, correctifs de relecture PR #371, 2026-11-09).
--
-- search_adherents_verification (vérification bénévole) renvoyait date_fin = NULL dans deux cas
-- que le front ne pouvait pas distinguer : aucune adhésion (→ « Expiré », comme search_adherents)
-- et dernière adhésion sans date de fin (→ « À jour », comme search_adherents). Ajout d'une
-- colonne `a_adhesion` (booléen) ; la dernière adhésion est choisie comme dans search_adherents
-- (date_debut la plus récente, puis date_fin la plus tardive, vide en premier).
--
-- Repart de la définition en place sur staging (pg_get_functiondef, 2026-11-09 : identique à
-- rls_benevole_restreint.sql). Garde d'organisation inchangée (dans le WHERE, coalesce pour le
-- super-admin, helper NULL = aucune ligne). Le type de retour change : DROP puis CREATE, et les
-- droits d'exécution sont reposés à l'identique.

BEGIN;

DROP FUNCTION IF EXISTS public.search_adherents_verification(uuid, text, int);

CREATE FUNCTION public.search_adherents_verification(
  p_organisation_id uuid,
  p_search text,
  p_limit int DEFAULT 20
)
RETURNS TABLE (
  nom text,
  prenom text,
  id_externe text,
  statut text,
  date_fin date,
  a_adhesion boolean
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  select
    a.nom, a.prenom, a.id_externe, a.statut, ad.date_fin, ad.adherent_id is not null
  from adherents a
  left join lateral (
    select h.adherent_id, h.date_fin
    from adhesions h
    where h.adherent_id = a.id
    order by h.date_debut desc, h.date_fin desc nulls first
    limit 1
  ) ad on true
  where a.organisation_id = p_organisation_id
    and (
      coalesce(is_current_user_super_admin(), false)
      or p_organisation_id = current_effective_organisation_id()
    )
    and trim(coalesce(p_search, '')) <> ''
    and (a.nom || ' ' || coalesce(a.prenom, '')) ilike all (
      array(
        select '%' || tok || '%'
        from unnest(string_to_array(trim(p_search), ' ')) as tok
        where tok <> ''
      )
    )
  order by a.nom asc, a.prenom asc
  limit p_limit;
$$;

REVOKE EXECUTE ON FUNCTION public.search_adherents_verification(uuid, text, int) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.search_adherents_verification(uuid, text, int) TO authenticated, service_role;

COMMIT;
