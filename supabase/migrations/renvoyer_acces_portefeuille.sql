-- Coupon 9 — renvoi d'un accès acheteur par un admin ou contributeur.
-- Cette migration remplace le premier cadrage public de la carte, brièvement
-- appliqué sur staging, et en nettoie les objets de base de données.
begin;

drop function if exists public.demander_lien_portefeuille(uuid, text, text);

delete from public.acces_portefeuille_rate_limits where scope = 'recuperation';
alter table public.acces_portefeuille_rate_limits
  drop constraint if exists acces_portefeuille_rate_limits_scope_check;
alter table public.acces_portefeuille_rate_limits
  add constraint acces_portefeuille_rate_limits_scope_check
  check (scope in ('etat', 'pdf', 'verify_pin'));

alter table public.secrets_portefeuille
  add column if not exists cree_par uuid;

alter table public.portefeuilles
  add column if not exists email_modifie_le timestamptz,
  add column if not exists email_modifie_par uuid;

comment on column public.secrets_portefeuille.cree_par is
  'Compte admin ou contributeur ayant généré cet accès ; null pour un accès créé à l''achat.';
comment on column public.portefeuilles.email_modifie_le is
  'Date de la dernière correction de l''adresse email par un compte authentifié.';
comment on column public.portefeuilles.email_modifie_par is
  'Compte admin ou contributeur ayant effectué la dernière correction de l''adresse email.';

create or replace function public.renvoyer_acces_portefeuille(
  p_portefeuille_id uuid,
  p_nouvel_email text default null,
  p_revoquer_anciens boolean default false
)
returns table (
  secret text,
  secret_id uuid,
  email text,
  evenement_nom text,
  organisation_nom text
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_wallet public.portefeuilles;
  v_email text;
  v_secret text;
  v_secret_id uuid;
  v_event_name text;
  v_org_name text;
begin
  if p_portefeuille_id is null or p_revoquer_anciens is null then
    raise exception 'REQUETE_INVALIDE';
  end if;

  select w.* into v_wallet
  from public.portefeuilles w
  where w.id = p_portefeuille_id
  for update;

  if not found then
    raise exception 'PORTEFEUILLE_INTROUVABLE';
  end if;

  if auth.uid() is null or not coalesce(
    public.is_current_user_super_admin()
      or v_wallet.organisation_id = public.current_user_organisation_id(),
    false
  ) then
    raise exception 'ACCES_INTERDIT' using errcode = '42501';
  end if;

  v_email := case
    when p_nouvel_email is null then v_wallet.email
    else lower(btrim(p_nouvel_email))
  end;

  if v_email !~ '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$'
    or length(v_email) > 254 then
    raise exception 'EMAIL_INVALIDE';
  end if;

  if v_email is distinct from v_wallet.email then
    if exists (
      select 1
      from public.portefeuilles w
      where w.evenement_id = v_wallet.evenement_id
        and lower(w.email) = v_email
        and w.id <> v_wallet.id
    ) then
      raise exception 'EMAIL_DEJA_UTILISE' using errcode = '23505';
    end if;

    update public.portefeuilles
    set email = v_email,
      email_modifie_le = clock_timestamp(),
      email_modifie_par = auth.uid()
    where id = v_wallet.id;
  end if;

  if p_revoquer_anciens then
    update public.secrets_portefeuille
    set revoque_le = clock_timestamp()
    where portefeuille_id = v_wallet.id
      and revoque_le is null;
  end if;

  v_secret := public.ajouter_secret_portefeuille(v_wallet.id);

  update public.secrets_portefeuille
  set cree_par = auth.uid()
  where portefeuille_id = v_wallet.id
    and secret_hash = encode(sha256(convert_to(v_secret, 'UTF8')), 'hex')
  returning id into v_secret_id;

  if v_secret_id is null then
    raise exception 'SECRET_INTROUVABLE';
  end if;

  select e.nom, o.nom into v_event_name, v_org_name
  from public.evenements e
  join public.organisations o on o.id = e.organisation_id
  where e.id = v_wallet.evenement_id;

  return query select v_secret, v_secret_id, v_email, v_event_name, v_org_name;
end;
$$;

revoke execute on function public.renvoyer_acces_portefeuille(uuid, text, boolean)
  from public, anon, authenticated;
grant execute on function public.renvoyer_acces_portefeuille(uuid, text, boolean)
  to authenticated;

commit;
