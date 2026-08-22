-- Migration: search_adherents_verification_id_externe.sql
-- Cadré 2026-08-20 (carte Trello "Afficher le numéro d'adhérent dans la
-- vérification bénévole") : ajoute id_externe au retour de
-- search_adherents_verification.sql pour affichage dans
-- BenevoleVerificationAdherent.tsx. Pas une donnée sensible comme
-- adresse/téléphone/email, ajout sans risque à cette RPC volontairement
-- restreinte. CREATE OR REPLACE ne permet pas de changer la liste de
-- colonnes en sortie d'une fonction TABLE, d'où le DROP explicite.

drop function if exists search_adherents_verification(uuid, text, int);

create function search_adherents_verification(
  p_organisation_id uuid,
  p_search text,
  p_limit int default 20
)
returns table (
  nom text,
  prenom text,
  id_externe text,
  statut text,
  date_fin date
)
language sql
stable
as $$
  select
    a.nom, a.prenom, a.id_externe, a.statut, ad.date_fin
  from adherents a
  left join lateral (
    select date_fin from adhesions where adherent_id = a.id order by date_debut desc limit 1
  ) ad on true
  where a.organisation_id = p_organisation_id
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
