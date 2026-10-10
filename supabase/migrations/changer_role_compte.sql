-- Rôle d'un compte d'organisation choisi et modifiable par le super-admin.
--
-- Invariant serveur : une organisation garde toujours au moins un
-- administrateur actif (non désactivé). Vérifié ici pour le changement de
-- rôle, et par l'Edge Function disable-admin (via est_dernier_admin_actif)
-- pour la désactivation.
--
-- Aucune policy RLS modifiée : profils_organisation reste en lecture
-- org-scopée + bypass super-admin, et sans grant UPDATE sur role pour
-- authenticated. Seule cette fonction (security definer, réservée au
-- super-admin) écrit le rôle d'un compte existant.

-- ---------------------------------------------------------
-- 1. Le compte est-il le dernier administrateur actif de son organisation ?
--    Appelée par changer_role_compte et par disable-admin (service_role).
-- ---------------------------------------------------------
create or replace function public.est_dernier_admin_actif(p_utilisateur_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
  select exists (
    select 1
    from profils_organisation cible
    join auth.users cu on cu.id = cible.utilisateur_id
    where cible.utilisateur_id = p_utilisateur_id
      and cible.role = 'admin'
      and (cu.banned_until is null or cu.banned_until <= now())
      and not exists (
        select 1
        from profils_organisation autre
        join auth.users au on au.id = autre.utilisateur_id
        where autre.organisation_id = cible.organisation_id
          and autre.role = 'admin'
          and autre.utilisateur_id <> cible.utilisateur_id
          and (au.banned_until is null or au.banned_until <= now())
      )
  );
$$;

revoke execute on function public.est_dernier_admin_actif(uuid) from public, anon, authenticated;
grant execute on function public.est_dernier_admin_actif(uuid) to service_role;

-- ---------------------------------------------------------
-- 2. Changer le rôle d'un compte (super-admin uniquement)
-- ---------------------------------------------------------
create or replace function public.changer_role_compte(p_utilisateur_id uuid, p_role text)
returns text
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_organisation_id uuid;
  v_role_actuel text;
begin
  if coalesce((auth.jwt() -> 'app_metadata' ->> 'is_super_admin')::boolean, false) is not true then
    raise exception 'Accès refusé — réservé aux super-admins' using errcode = '42501';
  end if;

  if p_role not in ('admin', 'contributeur') then
    raise exception 'Rôle inconnu : %', p_role using errcode = '22023';
  end if;

  select organisation_id, role into v_organisation_id, v_role_actuel
  from profils_organisation
  where utilisateur_id = p_utilisateur_id;

  if v_organisation_id is null then
    raise exception 'Compte introuvable' using errcode = 'P0002';
  end if;

  if v_role_actuel = p_role then
    return p_role;
  end if;

  -- Verrouille les comptes de l'organisation : deux rétrogradations
  -- simultanées ne peuvent pas laisser l'organisation sans administrateur.
  perform 1 from profils_organisation
  where organisation_id = v_organisation_id
  for update;

  if v_role_actuel = 'admin' and public.est_dernier_admin_actif(p_utilisateur_id) then
    raise exception 'Impossible : c''est le dernier administrateur actif de l''organisation. Nommez d''abord un autre administrateur.'
      using errcode = 'P0001';
  end if;

  update profils_organisation
  set role = p_role
  where utilisateur_id = p_utilisateur_id;

  return p_role;
end;
$$;

revoke execute on function public.changer_role_compte(uuid, text) from public, anon;
grant execute on function public.changer_role_compte(uuid, text) to authenticated, service_role;
