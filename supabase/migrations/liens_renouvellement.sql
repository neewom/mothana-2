-- Liens personnels de renouvellement d'adhésion (épique Renouvellement, carte 1/3, 2026-10-30).
-- Un lien par adhérent et par envoi de campagne emailing contenant {{params.lien_renouvellement}}.
-- Modèle de secret repris du porte-monnaie (secrets_portefeuille) : 32 octets aléatoires (64 hex)
-- générés par send-mailing-brevo, transmis uniquement dans l'email (fragment d'URL
-- /adhesion/<slug>/renouveler#<secret>) ; seule l'empreinte SHA-256 (hex) est stockée ici.
--
-- Un lien est valide tant que : revoque_le is null and utilise_le is null and expire_le > now().
-- Un nouvel envoi au même adhérent révoque ses liens encore actifs (remplacer_liens_renouvellement).
-- Lecteurs prévus : page publique de renouvellement (carte 2/3, par empreinte, via une RPC
-- security definer à créer), traitement admin (carte 3/3).
begin;

create table if not exists public.liens_renouvellement (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  adherent_id uuid not null references public.adherents(id) on delete cascade,
  secret_hash text not null unique check (secret_hash ~ '^[0-9a-f]{64}$'),
  cree_le timestamptz not null default now(),
  expire_le timestamptz not null default (now() + interval '90 days'),
  utilise_le timestamptz,
  revoque_le timestamptz
);

comment on table public.liens_renouvellement is
  'Liens personnels de renouvellement envoyés par emailing : empreinte SHA-256 du secret uniquement (jamais le secret), valable 90 jours, à usage unique, révoqué par un envoi plus récent.';

create index if not exists idx_liens_renouvellement_organisation on public.liens_renouvellement(organisation_id);
create index if not exists idx_liens_renouvellement_adherent_actif on public.liens_renouvellement(adherent_id)
  where revoque_le is null and utilise_le is null;

-- L'adhérent doit appartenir à l'organisation du lien (adherents n'a pas d'unique (id, organisation_id)).
create or replace function public.liens_renouvellement_verifier_organisation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not coalesce(exists (
    select 1 from public.adherents a where a.id = new.adherent_id and a.organisation_id = new.organisation_id
  ), false) then
    raise exception 'Adhérent hors organisation' using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_liens_renouvellement_organisation on public.liens_renouvellement;
create trigger trg_liens_renouvellement_organisation
  before insert or update of adherent_id, organisation_id on public.liens_renouvellement
  for each row execute function public.liens_renouvellement_verifier_organisation();

alter table public.liens_renouvellement enable row level security;
revoke all on public.liens_renouvellement from public, anon, authenticated;
grant select, insert, update, delete on public.liens_renouvellement to authenticated;
grant select, insert, update, delete on public.liens_renouvellement to service_role;

drop policy if exists liens_renouvellement_select on public.liens_renouvellement;
create policy liens_renouvellement_select on public.liens_renouvellement for select to authenticated
  using ((((select auth.jwt()) -> 'app_metadata' ->> 'is_super_admin')::boolean = true
    or organisation_id = (select current_user_organisation_id())));

drop policy if exists liens_renouvellement_insert on public.liens_renouvellement;
create policy liens_renouvellement_insert on public.liens_renouvellement for insert to authenticated
  with check ((((select auth.jwt()) -> 'app_metadata' ->> 'is_super_admin')::boolean = true
    or organisation_id = (select current_user_organisation_id())));

drop policy if exists liens_renouvellement_update on public.liens_renouvellement;
create policy liens_renouvellement_update on public.liens_renouvellement for update to authenticated
  using ((((select auth.jwt()) -> 'app_metadata' ->> 'is_super_admin')::boolean = true
    or organisation_id = (select current_user_organisation_id())))
  with check ((((select auth.jwt()) -> 'app_metadata' ->> 'is_super_admin')::boolean = true
    or organisation_id = (select current_user_organisation_id())));

drop policy if exists liens_renouvellement_delete on public.liens_renouvellement;
create policy liens_renouvellement_delete on public.liens_renouvellement for delete to authenticated
  using ((((select auth.jwt()) -> 'app_metadata' ->> 'is_super_admin')::boolean = true
    or organisation_id = (select current_user_organisation_id())));

-- Remplacement après un envoi réussi : révoque les liens encore actifs des mêmes adhérents,
-- sauf ceux qui viennent d'être envoyés. Appelée par send-mailing-brevo (service_role) seulement :
-- un tableau d'identifiants dans le corps de la requête, pas dans l'URL (lots de 1000).
create or replace function public.remplacer_liens_renouvellement(p_nouveaux uuid[])
returns integer
language sql
security definer
set search_path = public
as $$
  with revoques as (
    update public.liens_renouvellement l
       set revoque_le = now()
     where l.revoque_le is null
       and l.utilise_le is null
       and l.id <> all (p_nouveaux)
       and (l.adherent_id, l.organisation_id) in (
         select n.adherent_id, n.organisation_id from public.liens_renouvellement n where n.id = any (p_nouveaux)
       )
    returning 1
  )
  select count(*)::integer from revoques;
$$;

-- Annulation des liens d'un lot dont l'envoi Brevo a échoué (les liens précédents restent valides).
create or replace function public.revoquer_liens_renouvellement(p_ids uuid[])
returns integer
language sql
security definer
set search_path = public
as $$
  with revoques as (
    update public.liens_renouvellement set revoque_le = now()
     where id = any (p_ids) and revoque_le is null
    returning 1
  )
  select count(*)::integer from revoques;
$$;

revoke all on function public.remplacer_liens_renouvellement(uuid[]) from public, anon, authenticated;
revoke all on function public.revoquer_liens_renouvellement(uuid[]) from public, anon, authenticated;
grant execute on function public.remplacer_liens_renouvellement(uuid[]) to service_role;
grant execute on function public.revoquer_liens_renouvellement(uuid[]) to service_role;
revoke all on function public.liens_renouvellement_verifier_organisation() from public, anon, authenticated;

commit;
