-- Migration: gardes_null_rpc.sql
-- Cadré 2026-10-24 (audit sécurité, trouvé en testant la carte « Droits RLS du bénévole,
-- secrets… ») : pour une session sans profil d'organisation (bénévole/vendeur),
-- current_user_organisation_id() vaut NULL ; « if not (… = NULL) » vaut NULL et ne refuse
-- rien. Les gardes des RPC de recalage des adhésions (adhesion_duree_reglable.sql) sont
-- reprises de leur définition en place (2026-10-24) avec coalesce(…, false). Même signature :
-- CREATE OR REPLACE, droits inchangés. (get_org_admins et definir_notification_demandes sont
-- corrigées dans notification_demandes_reglages.sql, qui les recrée.)
begin;

CREATE OR REPLACE FUNCTION public.apercu_recalage_adhesions(p_organisation_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE
 SET search_path TO 'public', 'pg_temp'
AS $function$
begin
  if not coalesce(public.is_current_user_super_admin() or p_organisation_id = public.current_user_organisation_id(), false) then
    raise exception 'ACCES_REFUSE' using errcode = '42501';
  end if;
  return (
    select jsonb_build_object(
      'total', count(*),
      'a_modifier', count(*) filter (
        where h.date_fin is distinct from public.calculer_date_fin_adhesion(p_organisation_id, h.date_debut)
      )
    )
    from public.adhesions h
    join public.adherents a on a.id = h.adherent_id
    where a.organisation_id = p_organisation_id
  );
end;
$function$;

CREATE OR REPLACE FUNCTION public.recalculer_dates_fin_adhesions(p_organisation_id uuid)
 RETURNS integer
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_modifiees integer;
  v_regle text;
  v_mois smallint;
begin
  if not coalesce(public.is_current_user_super_admin() or p_organisation_id = public.current_user_organisation_id(), false) then
    raise exception 'ACCES_REFUSE' using errcode = '42501';
  end if;

  select adhesion_regle_fin, adhesion_mois_bascule into v_regle, v_mois
  from public.organisations where id = p_organisation_id;
  if v_regle is null then
    raise exception 'ORGANISATION_INTROUVABLE' using errcode = '42501';
  end if;

  update public.adhesions h
  set date_fin = public.calculer_date_fin_adhesion(p_organisation_id, h.date_debut)
  from public.adherents a
  where a.id = h.adherent_id
    and a.organisation_id = p_organisation_id
    and h.date_fin is distinct from public.calculer_date_fin_adhesion(p_organisation_id, h.date_debut);
  get diagnostics v_modifiees = row_count;

  insert into public.journal_modifications (organisation_id, table_cible, ligne_id, action, details, auteur_id)
  values (
    p_organisation_id, 'organisations', p_organisation_id, 'recalage_adhesions',
    jsonb_build_object('adhesions_modifiees', v_modifiees, 'regle_fin', v_regle, 'mois_bascule', v_mois),
    auth.uid()
  );

  return v_modifiees;
end;
$function$;

commit;
