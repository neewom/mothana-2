-- Migration: get_organisation_public_sans_id.sql
-- Cadré 2026-10-24 (audit sécurité) : la RPC publique du formulaire d'adhésion ne renvoie plus
-- l'identifiant de l'organisation (amorce de la chaîne d'attaque des comptes techniques
-- benevole-<id>@mothana.internal ; aucun usage côté front). Colonne retirée du RETURNS TABLE →
-- DROP + CREATE, repartie de la définition en place (2026-10-24), droits reposés à l'identique
-- (PUBLIC, anon, authenticated, service_role).
begin;

drop function if exists public.get_organisation_public(text);

CREATE FUNCTION public.get_organisation_public(p_slug text)
 RETURNS TABLE(nom text, statuts_url text, formulaire_adhesion_header_html text, formulaire_adhesion_footer_html text, formulaire_adhesion_css text, formulaire_adhesion_message_succes text, assets jsonb)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select
    o.nom,
    o.statuts_url,
    o.formulaire_adhesion_header_html,
    o.formulaire_adhesion_footer_html,
    o.formulaire_adhesion_css,
    o.formulaire_adhesion_message_succes,
    coalesce(
      (
        select jsonb_agg(jsonb_build_object('identifiant', a.identifiant, 'url', a.url))
        from organisation_assets a
        where a.organisation_id = o.id
      ),
      '[]'::jsonb
    ) as assets
  from organisations o
  where o.slug = p_slug;
$function$;

grant execute on function public.get_organisation_public(text) to public, anon, authenticated, service_role;

commit;
