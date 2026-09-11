-- Migration: search_adherents_email_invalide.sql
-- Complète bounce_detection_adherents.sql : même bug que celui corrigé par
-- search_adherents_mailing_opt_out.sql (la page liste des adhérents passe
-- par la RPC search_adherents, pas un select('*') direct) — sans cette
-- colonne au retour, AdherentModal ne recevait jamais email_invalide_at et
-- le badge "Email invalide" ne pouvait jamais s'afficher, constaté en
-- testant. CREATE OR REPLACE ne permet pas de changer la liste de colonnes
-- en sortie d'une fonction TABLE, d'où le DROP explicite.
--
-- ⚠️ La signature réellement en place est celle à 7 paramètres
-- d'adherents_tags.sql (p_tag/p_exclude_tag ajoutés après
-- search_adherents_mailing_opt_out.sql, malgré l'ordre des noms de
-- fichiers) — une première version de cette migration s'était trompée de
-- signature de DROP (5 paramètres, obsolète) et avait donc créé un second
-- overload au lieu de remplacer le bon, laissant email_invalide_at absent
-- du retour réellement utilisé par PostgREST. Corrigé ici : les deux DROP
-- ci-dessous couvrent la vraie signature actuelle et l'overload erroné
-- laissé par cette première tentative.

DROP FUNCTION IF EXISTS search_adherents(uuid, text, text, int, int, text, text);
DROP FUNCTION IF EXISTS search_adherents(uuid, text, text, int, int);

CREATE FUNCTION search_adherents(
  p_organisation_id uuid,
  p_search text default null,
  p_statut text default null,
  p_limit int default 50,
  p_offset int default 0,
  p_tag text default null,
  p_exclude_tag text default null
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
