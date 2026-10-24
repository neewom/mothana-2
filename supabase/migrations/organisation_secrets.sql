-- Migration: organisation_secrets.sql (1/2)
-- Cadré 2026-10-24 (audit sécurité, carte Trello « Droits RLS du bénévole, secrets hors de
-- organisations, reçus protégés »). La clé API Brevo et les codes PIN quittent `organisations`
-- (lisible par tous les membres, et par la session bénévole) pour une table dédiée sans aucune
-- policy : seules les Edge Functions (service_role) et les RPC SECURITY DEFINER ci-dessous y
-- accèdent. Stratégie validée par le lead tech (table dédiée plutôt que REVOKE colonne).
--
-- Déploiement en 3 temps, sans coupure :
--   1. cette migration : table, copie, trigger de synchronisation depuis organisations (les
--      anciennes fonctions et l'ancien front continuent d'écrire là), RPC ;
--   2. Edge Functions + front lisant la nouvelle table ;
--   3. organisation_secrets_retrait_colonnes.sql : suppression des colonnes et de la synchro.
begin;

create table public.organisation_secrets (
  organisation_id uuid primary key references public.organisations(id) on delete cascade,
  brevo_api_key text,
  code_pin_benevole text unique,
  code_pin_vendeur_evenement text unique,
  updated_at timestamptz not null default now()
);

comment on table public.organisation_secrets is 'Secrets d''organisation (clé API Brevo, codes PIN bénévole/vendeur). RLS sans policy : service_role et RPC SECURITY DEFINER uniquement.';

alter table public.organisation_secrets enable row level security;
revoke all on public.organisation_secrets from public, anon, authenticated;

insert into public.organisation_secrets (organisation_id, brevo_api_key, code_pin_benevole, code_pin_vendeur_evenement)
select id, brevo_api_key, code_pin_benevole, code_pin_vendeur_evenement
from public.organisations
on conflict (organisation_id) do update
set brevo_api_key = excluded.brevo_api_key,
    code_pin_benevole = excluded.code_pin_benevole,
    code_pin_vendeur_evenement = excluded.code_pin_vendeur_evenement,
    updated_at = now();

-- PIN à 6 chiffres tiré par gen_random_bytes, unique sur la colonne demandée.
create or replace function public.generer_pin_unique(p_colonne text)
returns text
language plpgsql
volatile
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_pin text;
  v_existe boolean;
begin
  if p_colonne not in ('code_pin_benevole', 'code_pin_vendeur_evenement') then
    raise exception 'COLONNE_INVALIDE' using errcode = '22023';
  end if;
  loop
    v_pin := (100000 + (('x' || encode(gen_random_bytes(4), 'hex'))::bit(32)::bigint % 900000))::text;
    execute format('select exists (select 1 from public.organisation_secrets where %I = $1)', p_colonne)
      into v_existe using v_pin;
    exit when not v_existe;
  end loop;
  return v_pin;
end;
$$;

revoke all on function public.generer_pin_unique(text) from public, anon, authenticated;
grant execute on function public.generer_pin_unique(text) to service_role;

-- Toute nouvelle organisation reçoit sa ligne de secrets et un PIN bénévole (permanent).
create or replace function public.creer_secrets_organisation()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  insert into public.organisation_secrets (organisation_id, code_pin_benevole)
  values (new.id, public.generer_pin_unique('code_pin_benevole'))
  on conflict (organisation_id) do nothing;
  return new;
end;
$$;

create trigger trg_organisations_creer_secrets
  after insert on public.organisations
  for each row execute function public.creer_secrets_organisation();

-- Transition (supprimé à l'étape 3) : les écritures encore faites dans organisations sont
-- recopiées. Nommé pour s'exécuter après trg_organisations_creer_secrets (ordre alphabétique).
create or replace function public.synchroniser_secrets_organisation()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  insert into public.organisation_secrets (organisation_id, brevo_api_key, code_pin_benevole, code_pin_vendeur_evenement)
  values (new.id, new.brevo_api_key, new.code_pin_benevole, new.code_pin_vendeur_evenement)
  on conflict (organisation_id) do update
  set brevo_api_key = excluded.brevo_api_key,
      code_pin_benevole = coalesce(excluded.code_pin_benevole, public.organisation_secrets.code_pin_benevole),
      code_pin_vendeur_evenement = excluded.code_pin_vendeur_evenement,
      updated_at = now();
  return new;
end;
$$;

create trigger trg_organisations_synchroniser_secrets
  after insert or update of brevo_api_key, code_pin_benevole, code_pin_vendeur_evenement on public.organisations
  for each row execute function public.synchroniser_secrets_organisation();

-- Droits partagés par les RPC : super-admin, ou compte (admin/contributeur) de l'organisation ;
-- `admin_seulement` exige en plus le rôle admin.
create or replace function public.peut_gerer_secrets(p_organisation_id uuid, p_admin_seulement boolean)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select public.is_current_user_super_admin()
    or (
      p_organisation_id = public.current_user_organisation_id()
      and (not p_admin_seulement or public.current_user_role() = 'admin')
    );
$$;

revoke all on function public.peut_gerer_secrets(uuid, boolean) from public, anon;
grant execute on function public.peut_gerer_secrets(uuid, boolean) to authenticated, service_role;

-- Brevo : état de la configuration (jamais la clé) — membres de l'organisation.
create or replace function public.etat_config_brevo(p_organisation_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
begin
  if not public.peut_gerer_secrets(p_organisation_id, false) then
    raise exception 'ACCES_REFUSE' using errcode = '42501';
  end if;
  return (
    select jsonb_build_object(
      'cle_configuree', coalesce(nullif(trim(s.brevo_api_key), ''), null) is not null,
      'expediteur_nom', o.brevo_expediteur_nom,
      'expediteur_email', o.brevo_expediteur_email
    )
    from public.organisations o
    left join public.organisation_secrets s on s.organisation_id = o.id
    where o.id = p_organisation_id
  );
end;
$$;

-- Brevo : enregistrement — admin de l'organisation ou super-admin. p_cle vide = clé inchangée.
create or replace function public.definir_config_brevo(
  p_organisation_id uuid,
  p_cle text,
  p_expediteur_nom text,
  p_expediteur_email text
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if not public.peut_gerer_secrets(p_organisation_id, true) then
    raise exception 'ACCES_REFUSE' using errcode = '42501';
  end if;
  update public.organisations
  set brevo_expediteur_nom = nullif(trim(p_expediteur_nom), ''),
      brevo_expediteur_email = nullif(trim(p_expediteur_email), '')
  where id = p_organisation_id;
  if nullif(trim(coalesce(p_cle, '')), '') is not null then
    insert into public.organisation_secrets (organisation_id, brevo_api_key)
    values (p_organisation_id, trim(p_cle))
    on conflict (organisation_id) do update set brevo_api_key = excluded.brevo_api_key, updated_at = now();
  end if;
end;
$$;

-- Codes PIN (affichage) — admin de l'organisation ou super-admin.
create or replace function public.codes_pin(p_organisation_id uuid)
returns table (code_pin_benevole text, code_pin_vendeur_evenement text)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
begin
  if not public.peut_gerer_secrets(p_organisation_id, true) then
    raise exception 'ACCES_REFUSE' using errcode = '42501';
  end if;
  return query
    select s.code_pin_benevole, s.code_pin_vendeur_evenement
    from public.organisation_secrets s
    where s.organisation_id = p_organisation_id;
end;
$$;

-- PIN bénévole de toutes les organisations (espace super-admin : affichage et recherche).
create or replace function public.codes_pin_benevole_organisations()
returns table (organisation_id uuid, code_pin_benevole text)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
begin
  if not public.is_current_user_super_admin() then
    raise exception 'ACCES_REFUSE' using errcode = '42501';
  end if;
  return query select s.organisation_id, s.code_pin_benevole from public.organisation_secrets s;
end;
$$;

revoke all on function public.etat_config_brevo(uuid) from public, anon;
revoke all on function public.definir_config_brevo(uuid, text, text, text) from public, anon;
revoke all on function public.codes_pin(uuid) from public, anon;
revoke all on function public.codes_pin_benevole_organisations() from public, anon;
grant execute on function public.etat_config_brevo(uuid) to authenticated, service_role;
grant execute on function public.definir_config_brevo(uuid, text, text, text) to authenticated, service_role;
grant execute on function public.codes_pin(uuid) to authenticated, service_role;
grant execute on function public.codes_pin_benevole_organisations() to authenticated, service_role;

commit;
