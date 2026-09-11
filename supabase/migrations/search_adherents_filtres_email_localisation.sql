-- Migration: search_adherents_filtres_email_localisation.sql
-- Cadré 2026-09-11 (carte Trello "page adhérent : ajouter de nouveaux
-- filtres") : 4 nouveaux filtres pour AdherentsPage.tsx — présence/absence
-- d'email, code postal, ville, pays. Complète search_adherents.sql
-- (dernière modification : search_adherents_email_invalide.sql).
--
-- ⚠️ La signature réellement en place est celle à 7 paramètres (vérifié en
-- base avant d'écrire ce DROP, cf. bug déjà rencontré sur cette RPC —
-- carte "Détection bounces adhérents").

DROP FUNCTION IF EXISTS search_adherents(uuid, text, text, int, int, text, text);

CREATE FUNCTION search_adherents(
  p_organisation_id uuid,
  p_search text default null,
  p_statut text default null,
  p_limit int default 50,
  p_offset int default 0,
  p_tag text default null,
  p_exclude_tag text default null,
  p_email_filter text default null,
  p_code_postal text default null,
  p_ville text default null,
  p_pays text default null
)
RETURNS TABLE (
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
  tags text[],
  email_invalide_at timestamptz,
  created_at timestamptz,
  updated_at timestamptz,
  total_count bigint
)
LANGUAGE sql
STABLE
AS $$
  select
    a.id, a.id_externe, a.civilite, a.nom, a.prenom, a.date_naissance,
    a.adresse, a.code_postal, a.ville, a.telephone, a.courriel,
    a.statut, a.statuts_acceptes, a.consent_rgpd, a.mailing_opt_out, a.mailing_opt_out_at,
    a.tags, a.email_invalide_at, a.created_at, a.updated_at,
    count(*) over() as total_count
  from adherents a
  where a.organisation_id = p_organisation_id
    and (p_statut is null or a.statut = p_statut)
    and (p_tag is null or p_tag = any(a.tags))
    and (p_exclude_tag is null or not (p_exclude_tag = any(a.tags)))
    and (
      p_email_filter is null or p_email_filter = ''
      or (p_email_filter = 'avec' and a.courriel is not null and trim(a.courriel) <> '')
      or (p_email_filter = 'sans' and (a.courriel is null or trim(a.courriel) = ''))
    )
    and (p_code_postal is null or trim(p_code_postal) = '' or a.code_postal ilike '%' || trim(p_code_postal) || '%')
    and (p_ville is null or trim(p_ville) = '' or a.ville ilike '%' || trim(p_ville) || '%')
    and (p_pays is null or trim(p_pays) = '' or a.pays ilike '%' || trim(p_pays) || '%')
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
