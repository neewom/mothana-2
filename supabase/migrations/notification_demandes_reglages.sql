-- Migration: notification_demandes_reglages.sql
-- Cadré 2026-10-23 (retour utilisateur sur la carte « Demande d'adhésion : prévenir les
-- admins par email à la soumission ») : l'email « Nouvelle demande d'adhésion » peut être
-- coupé pour toute l'organisation et compte par compte.
--   - organisations.notif_demandes_adhesion (défaut true) : réglage de l'organisation, modifié
--     comme le reste de Paramètres → Adhésions (policy org_update_admin) ; le garde
--     trg_organisations_fonctionnalites_super_admin ne surveille que fonctionnalites_activees.
--   - réglage par compte : colonne existante profils_organisation.notif_demandes_adhesion
--     (contributeur_role.sql, interrupteur de « Mon compte »), réutilisée.
--   - get_org_admins renvoie ce réglage (colonne ajoutée au RETURNS TABLE → DROP + CREATE,
--     repartie de la définition en place sur staging le 2026-10-23, droits reposés à
--     l'identique : authenticated, service_role, pas PUBLIC).
--   - definir_notification_demandes : seule écriture du réglage d'un autre compte (pas d'UPDATE
--     direct ouvert sur profils_organisation, qui porte le rôle) — le compte lui-même, un admin
--     de la même organisation ou le super-admin.
--   - Gardes en coalesce(…, false) (audit 2026-10-24) : get_org_admins laissait une session
--     bénévole lire les comptes (emails) de toutes les organisations (défaut préexistant).
begin;

alter table public.organisations
  add column notif_demandes_adhesion boolean not null default true;

comment on column public.organisations.notif_demandes_adhesion is 'Prévenir les comptes de l''organisation par email à chaque nouvelle demande d''adhésion (soumettre-demande-adhesion).';

drop function if exists public.get_org_admins(uuid);

CREATE FUNCTION public.get_org_admins(org_id uuid)
 RETURNS TABLE(utilisateur_id uuid, nom_affiche text, email text, role text, created_at timestamp with time zone, is_banned boolean, notif_demandes_adhesion boolean)
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
begin
  -- coalesce (audit 2026-10-24) : sans profil d'organisation (session bénévole/vendeur), les
  -- helpers renvoient NULL et « if not NULL » laissait passer — fuite des comptes de toute org.
  if not coalesce(
    (auth.jwt() -> 'app_metadata' ->> 'is_super_admin')::boolean = true
    or (current_user_role() = 'admin' and current_user_organisation_id() = org_id),
    false
  ) then
    raise exception 'Unauthorized';
  end if;
  return query
    select
      po.utilisateur_id,
      po.nom_affiche,
      au.email::text,
      po.role,
      po.created_at,
      (au.banned_until is not null and au.banned_until > now()) as is_banned,
      po.notif_demandes_adhesion
    from profils_organisation po
    join auth.users au on au.id = po.utilisateur_id
    where po.organisation_id = org_id
      and po.role in ('admin', 'contributeur')
    order by po.created_at asc;
end;
$function$;

revoke all on function public.get_org_admins(uuid) from public, anon;
grant execute on function public.get_org_admins(uuid) to authenticated, service_role;

create or replace function public.definir_notification_demandes(
  p_utilisateur_id uuid,
  p_organisation_id uuid,
  p_actif boolean
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if p_actif is null then
    raise exception 'VALEUR_INVALIDE' using errcode = '22023';
  end if;
  -- coalesce : garde strictement booléenne (NULL pour une session sans profil d'organisation).
  if not coalesce(
    public.is_current_user_super_admin()
    or (auth.uid() = p_utilisateur_id and public.current_user_organisation_id() = p_organisation_id)
    or (public.current_user_role() = 'admin' and public.current_user_organisation_id() = p_organisation_id),
    false
  ) then
    raise exception 'ACCES_REFUSE' using errcode = '42501';
  end if;

  update public.profils_organisation
  set notif_demandes_adhesion = p_actif,
      notif_demandes_adhesion_updated_at = now()
  where utilisateur_id = p_utilisateur_id
    and organisation_id = p_organisation_id
    and role in ('admin', 'contributeur');
  if not found then
    raise exception 'COMPTE_INTROUVABLE' using errcode = 'P0002';
  end if;
end;
$$;

revoke all on function public.definir_notification_demandes(uuid, uuid, boolean) from public, anon;
grant execute on function public.definir_notification_demandes(uuid, uuid, boolean) to authenticated, service_role;

commit;
