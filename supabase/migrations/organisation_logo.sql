-- Migration: organisation_logo.sql
-- Carte « Logo 3/3 : logo de l'association dans l'en-tête (admin et bénévole) »
-- (https://trello.com/c/AkmkFZOs).
--
-- Un visuel de la bibliothèque (organisation_assets) peut être désigné comme logo de
-- l'organisation ; il s'affiche dans l'en-tête de l'espace admin et de l'espace bénévole.
--
-- Choix : référence organisations.logo_asset_id + RPC de lecture, plutôt qu'une URL recopiée
-- sur organisations. « Remplacer » un visuel change son URL (nouveau fichier) : une copie
-- deviendrait périmée sans trigger de synchronisation, alors que la référence suit le visuel
-- et la clé étrangère « on delete set null » retire le logo quand le visuel est supprimé.
-- Le bénévole n'a pas accès à organisation_assets (rls_benevole_restreint.sql) et n'en reçoit
-- aucun : get_organisation_logo_url (SECURITY DEFINER) ne renvoie que l'URL du logo de son
-- organisation.
--
-- Écriture : la policy org_update_admin existante (parametres_admin_seulement.sql) réserve déjà
-- la mise à jour d'organisations à l'admin et au super-admin ; le trigger ci-dessous garantit en
-- plus que le visuel désigné appartient à l'organisation et est une image (PNG/JPEG).

begin;

alter table public.organisations
  add column if not exists logo_asset_id uuid
  references public.organisation_assets(id) on delete set null;

grant update (logo_asset_id) on public.organisations to authenticated;

create or replace function public.organisations_verifier_logo()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.logo_asset_id is not null
     and (tg_op = 'INSERT' or new.logo_asset_id is distinct from old.logo_asset_id) then
    if not exists (
      select 1 from public.organisation_assets a
      where a.id = new.logo_asset_id
        and a.organisation_id = new.id
        and a.url ~* '\.(png|jpe?g)$'
    ) then
      raise exception 'Ce visuel ne peut pas servir de logo à cette organisation'
        using errcode = 'check_violation';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists organisations_verifier_logo on public.organisations;
create trigger organisations_verifier_logo
  before insert or update of logo_asset_id on public.organisations
  for each row execute function public.organisations_verifier_logo();

-- URL du logo d'une organisation : membre (admin, contributeur), bénévole de l'organisation ou
-- super-admin. NULL si aucun logo. Les helpers valent NULL pour une session sans organisation :
-- coalesce(..., false) refuse.
create or replace function public.get_organisation_logo_url(p_organisation_id uuid)
returns text
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_url text;
begin
  if not coalesce(
    ((select auth.jwt()) -> 'app_metadata' ->> 'is_super_admin')::boolean = true
      or p_organisation_id = (select current_effective_organisation_id()),
    false
  ) then
    raise exception 'Accès refusé' using errcode = 'insufficient_privilege';
  end if;

  select a.url into v_url
  from public.organisations o
  join public.organisation_assets a on a.id = o.logo_asset_id
  where o.id = p_organisation_id;

  return v_url;
end;
$$;

revoke all on function public.get_organisation_logo_url(uuid) from public, anon;
grant execute on function public.get_organisation_logo_url(uuid) to authenticated;

revoke all on function public.organisations_verifier_logo() from public, anon, authenticated;

commit;
