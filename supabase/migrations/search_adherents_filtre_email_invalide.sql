-- Migration: search_adherents_filtre_email_invalide.sql
-- Cadré 2026-10-17 (carte Trello "Adhérents : filtrer ceux dont l'email est
-- invalide") : nouvelle valeur 'invalide' pour p_email_filter — ne garde que
-- les adhérents marqués par les rejets Brevo (email_invalide_at, posé par
-- brevo-bounce-webhook, remis à null quand l'email est corrigé).
--
-- Repart de la définition réellement en place sur staging (pg_get_functiondef,
-- 2026-10-17 : une seule surcharge à 11 paramètres, SECURITY INVOKER),
-- identique à search_adherents_filtres_email_localisation.sql. Même signature :
-- CREATE OR REPLACE, pas de DROP (droits et RLS inchangés).

CREATE OR REPLACE FUNCTION public.search_adherents(p_organisation_id uuid, p_search text DEFAULT NULL::text, p_statut text DEFAULT NULL::text, p_limit integer DEFAULT 50, p_offset integer DEFAULT 0, p_tag text DEFAULT NULL::text, p_exclude_tag text DEFAULT NULL::text, p_email_filter text DEFAULT NULL::text, p_code_postal text DEFAULT NULL::text, p_ville text DEFAULT NULL::text, p_pays text DEFAULT NULL::text)
 RETURNS TABLE(id uuid, id_externe text, civilite smallint, nom text, prenom text, date_naissance date, adresse text, code_postal text, ville text, telephone text, courriel text, statut text, statuts_acceptes boolean, consent_rgpd boolean, mailing_opt_out boolean, mailing_opt_out_at timestamp with time zone, tags text[], email_invalide_at timestamp with time zone, created_at timestamp with time zone, updated_at timestamp with time zone, total_count bigint)
 LANGUAGE sql
 STABLE
AS $function$
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
      or (p_email_filter = 'invalide' and a.email_invalide_at is not null)
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
$function$;

