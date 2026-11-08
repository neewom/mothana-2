-- Migration: search_adherents_a_renouveler.sql
-- Carte Trello « [M] Renouvellements : état « À renouveler » et vocabulaire unique »
-- (https://trello.com/c/lpFg4vvc, 2026-11-09) : nouvel état d'adhésion « à renouveler »
-- dans le filtre de statut de search_adherents (p_statut = 'a_renouveler').
--
-- Repart de la définition en place sur staging (pg_get_functiondef, 2026-11-09 : identique à
-- search_adherents_tri.sql). Signature inchangée → CREATE OR REPLACE, droits d'exécution
-- conservés. Toujours SECURITY INVOKER, sans garde explicite : la RLS de `adherents` borne les
-- lignes à l'organisation de la session (bénévole : aucune ligne, cf. rls_benevole_restreint.sql).
--
-- États d'adhésion d'un adhérent non archivé (statut = 'actif'), d'après sa DERNIÈRE adhésion
-- (date_debut la plus récente, puis date_fin la plus tardive, vide en premier) — trois états
-- exclusifs, dont l'union est la liste des non-archivés :
--   a_jour       : date de fin vide, ou après current_date + 30 jours ;
--   a_renouveler : date de fin entre current_date et current_date + 30 jours inclus (même seuil
--                  que la tuile « Adhésions à renouveler (30 j) » de l'accueil) ;
--   expire       : date de fin passée, ou aucune adhésion (décision utilisateur : une fiche sans
--                  adhésion reste comptée dans « Expirés »).
-- Changement de sens : `a_jour` n'inclut plus les adhésions qui finissent dans les 30 jours.
-- Seul lecteur de p_statut = 'a_jour' : AdherentsPage (filtre « À jour »), cf. PR.
-- Les autres valeurs (archive, actif, NULL) sont inchangées.

BEGIN;

CREATE OR REPLACE FUNCTION public.search_adherents(p_organisation_id uuid, p_search text DEFAULT NULL::text, p_statut text DEFAULT NULL::text, p_limit integer DEFAULT 50, p_offset integer DEFAULT 0, p_tag text DEFAULT NULL::text, p_exclude_tag text DEFAULT NULL::text, p_email_filter text DEFAULT NULL::text, p_code_postal text DEFAULT NULL::text, p_ville text DEFAULT NULL::text, p_pays text DEFAULT NULL::text, p_tri text DEFAULT NULL::text, p_sens text DEFAULT NULL::text)
 RETURNS TABLE(id uuid, id_externe text, civilite smallint, nom text, prenom text, date_naissance date, adresse text, code_postal text, ville text, pays text, telephone text, courriel text, statut text, statuts_acceptes boolean, consent_rgpd boolean, mailing_opt_out boolean, mailing_opt_out_at timestamp with time zone, tags text[], email_invalide_at timestamp with time zone, created_at timestamp with time zone, updated_at timestamp with time zone, total_count bigint)
 LANGUAGE sql
 STABLE
AS $function$
  with tri as (
    select
      case when p_tri in ('nom', 'prenom', 'statut', 'date_adhesion', 'date_fin', 'code_postal', 'ville')
        then p_tri else 'nom' end as cle,
      coalesce(lower(p_sens) = 'desc', false) as desc_
  )
  select
    a.id, a.id_externe, a.civilite, a.nom, a.prenom, a.date_naissance,
    a.adresse, a.code_postal, a.ville, a.pays, a.telephone, a.courriel,
    a.statut, a.statuts_acceptes, a.consent_rgpd, a.mailing_opt_out, a.mailing_opt_out_at,
    a.tags, a.email_invalide_at, a.created_at, a.updated_at,
    count(*) over() as total_count
  from adherents a
  cross join tri t
  left join lateral (
    select h.date_debut, h.date_fin
    from adhesions h
    where h.adherent_id = a.id
    order by h.date_debut desc, h.date_fin desc nulls first
    limit 1
  ) d on t.cle in ('date_adhesion', 'date_fin')
  where a.organisation_id = p_organisation_id
    and (
      p_statut is null
      or (p_statut not in ('a_jour', 'a_renouveler', 'expire') and a.statut = p_statut)
      or (
        p_statut in ('a_jour', 'a_renouveler', 'expire') and a.statut = 'actif'
        and coalesce((
          select case
            when h.date_fin is null or h.date_fin > current_date + 30 then 'a_jour'
            when h.date_fin >= current_date then 'a_renouveler'
            else 'expire'
          end
          from adhesions h
          where h.adherent_id = a.id
          order by h.date_debut desc, h.date_fin desc nulls first
          limit 1
        ), 'expire') = p_statut
      )
    )
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
  order by
    -- Clé choisie (texte), dans le sens choisi ; une expression NULL pour toutes les lignes est neutre.
    case when not t.desc_ then case t.cle
      when 'nom' then a.nom
      when 'prenom' then nullif(trim(a.prenom), '')
      when 'statut' then a.statut
      when 'code_postal' then nullif(trim(a.code_postal), '')
      when 'ville' then nullif(trim(a.ville), '')
    end end asc nulls last,
    case when t.desc_ then case t.cle
      when 'nom' then a.nom
      when 'prenom' then nullif(trim(a.prenom), '')
      when 'statut' then a.statut
      when 'code_postal' then nullif(trim(a.code_postal), '')
      when 'ville' then nullif(trim(a.ville), '')
    end end desc nulls last,
    -- Clé choisie (date de la dernière adhésion).
    case when not t.desc_ then case t.cle
      when 'date_adhesion' then d.date_debut
      when 'date_fin' then d.date_fin
    end end asc nulls last,
    case when t.desc_ then case t.cle
      when 'date_adhesion' then d.date_debut
      when 'date_fin' then d.date_fin
    end end desc nulls last,
    -- Second critère dans le même sens : nom → prénom, prénom → nom, code postal → ville.
    case when not t.desc_ then case t.cle
      when 'nom' then nullif(trim(a.prenom), '')
      when 'prenom' then a.nom
      when 'code_postal' then nullif(trim(a.ville), '')
    end end asc nulls last,
    case when t.desc_ then case t.cle
      when 'nom' then nullif(trim(a.prenom), '')
      when 'prenom' then a.nom
      when 'code_postal' then nullif(trim(a.ville), '')
    end end desc nulls last,
    -- Départage indépendant du sens : ordre par défaut, puis id.
    a.nom asc, a.prenom asc, a.id
  limit p_limit offset p_offset;
$function$;


COMMIT;
