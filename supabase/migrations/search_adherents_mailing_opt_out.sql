-- Migration: search_adherents_mailing_opt_out.sql
-- Complète mailing_opt_out.sql : la page liste des adhérents passe par la
-- RPC search_adherents (pas un select('*') direct), qui ne renvoyait pas
-- mailing_opt_out/mailing_opt_out_at — la modale d'édition recevait donc
-- toujours `undefined` pour ces champs (checkbox "Ne pas contacter par
-- email" jamais initialisée à son état réel). CREATE OR REPLACE ne permet
-- pas de changer la liste de colonnes en sortie d'une fonction TABLE, d'où
-- le DROP explicite.

drop function if exists search_adherents(uuid, text, text, int, int);

create function search_adherents(
  p_organisation_id uuid,
  p_search text default null,
  p_statut text default null,
  p_limit int default 50,
  p_offset int default 0
)
returns table (
  id uuid,
  id_externe text,
  civilite smallint,
  nom text,
  prenom text,
  date_naissance date,
  adresse text,
  code_postal text,
  ville text,
  telephone text,
  courriel text,
  statut text,
  statuts_acceptes boolean,
  consent_rgpd boolean,
  mailing_opt_out boolean,
  mailing_opt_out_at timestamptz,
  created_at timestamptz,
  updated_at timestamptz,
  total_count bigint
)
language sql
stable
as $$
  select
    a.id, a.id_externe, a.civilite, a.nom, a.prenom, a.date_naissance,
    a.adresse, a.code_postal, a.ville, a.telephone, a.courriel,
    a.statut, a.statuts_acceptes, a.consent_rgpd, a.mailing_opt_out, a.mailing_opt_out_at,
    a.created_at, a.updated_at,
    count(*) over() as total_count
  from adherents a
  where a.organisation_id = p_organisation_id
    and (p_statut is null or a.statut = p_statut)
    and (
      p_search is null or trim(p_search) = ''
      or (a.nom || ' ' || coalesce(a.prenom, '')) ilike all (
        array(
          select '%' || tok || '%'
          from unnest(string_to_array(trim(p_search), ' ')) as tok
          where tok <> ''
        )
      )
      or a.courriel ilike '%' || trim(p_search) || '%'
    )
  order by a.nom asc, a.prenom asc
  limit p_limit offset p_offset;
$$;
