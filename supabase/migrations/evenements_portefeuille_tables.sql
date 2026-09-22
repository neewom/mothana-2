-- Coupon 1 — Fondations du porte-monnaie par événement (ticket v3.3).
-- Rejouable ; exécuter avant evenements_portefeuille_rpc.sql.
begin;

create table if not exists public.evenements (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  slug text not null check (btrim(slug) <> ''),
  nom text not null check (btrim(nom) <> ''),
  date_evenement date not null,
  statut text not null default 'brouillon' check (statut in ('brouillon', 'ouvert', 'clos')),
  montants_credit_centimes integer[] not null default '{500,1000,2000,5000}'
    check (cardinality(montants_credit_centimes) > 0
      and array_ndims(montants_credit_centimes) = 1
      and array_position(montants_credit_centimes, null) is null
      and 0 < all(montants_credit_centimes)),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, organisation_id),
  unique (organisation_id, slug)
);

create table if not exists public.portefeuilles (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  evenement_id uuid not null,
  email text not null check (email = lower(btrim(email)) and email ~ '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$'),
  -- 32 caractères, 122 bits aléatoires ; sans 0/O ni 1/I/L.
  code_public text not null default translate(upper(replace(gen_random_uuid()::text, '-', '')), '01', 'GH')
    unique check (code_public ~ '^[2-9A-H]{10,}$'),
  solde_centimes integer not null default 0 check (solde_centimes >= 0),
  gele boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, organisation_id),
  unique (id, evenement_id, organisation_id),
  foreign key (evenement_id, organisation_id) references public.evenements(id, organisation_id)
);
create unique index if not exists idx_portefeuilles_evenement_email
  on public.portefeuilles(evenement_id, lower(email));

create table if not exists public.commandes (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  evenement_id uuid not null,
  email text not null check (email = lower(btrim(email)) and email ~ '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$'),
  montant_centimes integer not null check (montant_centimes > 0),
  moyen_paiement text not null default 'en_ligne' check (moyen_paiement in ('en_ligne', 'manuel')),
  statut text not null default 'en_attente_paiement'
    check (statut in ('en_attente_paiement', 'payee', 'annulee', 'expiree', 'remboursee')),
  reference_paiement text unique,
  cle_idempotence text unique,
  expire_le timestamptz not null default (now() + interval '30 minutes'),
  payee_le timestamptz,
  portefeuille_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, organisation_id),
  unique (id, portefeuille_id, organisation_id),
  foreign key (evenement_id, organisation_id) references public.evenements(id, organisation_id),
  foreign key (portefeuille_id, evenement_id, organisation_id)
    references public.portefeuilles(id, evenement_id, organisation_id)
);

create table if not exists public.secrets_portefeuille (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  portefeuille_id uuid not null,
  secret_hash text not null unique check (secret_hash ~ '^[0-9a-f]{64}$'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  revoque_le timestamptz,
  foreign key (portefeuille_id, organisation_id) references public.portefeuilles(id, organisation_id)
);

create table if not exists public.demandes_paiement (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  portefeuille_id uuid not null,
  montant_centimes integer not null check (montant_centimes > 0),
  statut text not null default 'en_attente'
    check (statut in ('en_attente', 'validee', 'refusee', 'expiree', 'annulee')),
  expire_le timestamptz not null default (now() + interval '90 seconds'),
  cree_par uuid not null,
  decidee_le timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, organisation_id),
  unique (id, portefeuille_id, organisation_id),
  foreign key (portefeuille_id, organisation_id) references public.portefeuilles(id, organisation_id)
);
create unique index if not exists idx_demandes_paiement_attente
  on public.demandes_paiement(portefeuille_id) where statut = 'en_attente';

create table if not exists public.mouvements_portefeuille (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  portefeuille_id uuid not null,
  type text not null check (type in ('credit_initial', 'credit_recharge', 'debit')),
  montant_centimes integer not null check (montant_centimes > 0),
  solde_apres_centimes integer not null check (solde_apres_centimes >= 0),
  commande_id uuid unique,
  demande_paiement_id uuid unique,
  acteur_id uuid,
  created_at timestamptz not null default now(),
  check ((type in ('credit_initial', 'credit_recharge') and commande_id is not null and demande_paiement_id is null)
    or (type = 'debit' and commande_id is null and demande_paiement_id is not null)),
  foreign key (portefeuille_id, organisation_id) references public.portefeuilles(id, organisation_id),
  foreign key (commande_id, portefeuille_id, organisation_id)
    references public.commandes(id, portefeuille_id, organisation_id),
  foreign key (demande_paiement_id, portefeuille_id, organisation_id)
    references public.demandes_paiement(id, portefeuille_id, organisation_id)
);

-- Une organisation ne peut pas déplacer un événement vers un autre tenant.
create or replace function public.evenements_organisation_immuable()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if new.organisation_id is distinct from old.organisation_id then
    raise exception 'ORGANISATION_IMMUABLE';
  end if;
  return new;
end;
$$;
revoke execute on function public.evenements_organisation_immuable() from public, anon, authenticated;
drop trigger if exists trg_evenements_organisation_immuable on public.evenements;
create trigger trg_evenements_organisation_immuable before update on public.evenements
  for each row execute function public.evenements_organisation_immuable();

-- Conservation absolue du journal : bloque aussi les suppressions en cascade
-- d'une organisation ayant des mouvements. Sa purge nécessitera un cadrage dédié.
create or replace function public.mouvements_portefeuille_immuables()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
begin
  raise exception 'JOURNAL_IMMUABLE';
end;
$$;
revoke execute on function public.mouvements_portefeuille_immuables() from public, anon, authenticated;
drop trigger if exists trg_mouvements_portefeuille_immuables on public.mouvements_portefeuille;
create trigger trg_mouvements_portefeuille_immuables before update or delete on public.mouvements_portefeuille
  for each row execute function public.mouvements_portefeuille_immuables();

create index if not exists idx_evenements_organisation on public.evenements(organisation_id);
drop trigger if exists trg_evenements_updated_at on public.evenements;
create trigger trg_evenements_updated_at before update on public.evenements
  for each row execute function public.set_updated_at();
alter table public.evenements enable row level security;
revoke all on public.evenements from public, anon, authenticated;
grant select on public.evenements to authenticated;
grant select, insert, update, delete on public.evenements to service_role;
drop policy if exists evenements_select on public.evenements;
create policy evenements_select on public.evenements for select to authenticated
  using ((((select auth.jwt()) -> 'app_metadata' ->> 'is_super_admin')::boolean = true
    or organisation_id = (select current_user_organisation_id())));

create index if not exists idx_commandes_organisation on public.commandes(organisation_id);
drop trigger if exists trg_commandes_updated_at on public.commandes;
create trigger trg_commandes_updated_at before update on public.commandes
  for each row execute function public.set_updated_at();
alter table public.commandes enable row level security;
revoke all on public.commandes from public, anon, authenticated;
grant select on public.commandes to authenticated;
grant select, insert, update, delete on public.commandes to service_role;
drop policy if exists commandes_select on public.commandes;
create policy commandes_select on public.commandes for select to authenticated
  using ((((select auth.jwt()) -> 'app_metadata' ->> 'is_super_admin')::boolean = true
    or organisation_id = (select current_user_organisation_id())));

create index if not exists idx_portefeuilles_organisation on public.portefeuilles(organisation_id);
drop trigger if exists trg_portefeuilles_updated_at on public.portefeuilles;
create trigger trg_portefeuilles_updated_at before update on public.portefeuilles
  for each row execute function public.set_updated_at();
alter table public.portefeuilles enable row level security;
revoke all on public.portefeuilles from public, anon, authenticated;
grant select on public.portefeuilles to authenticated;
grant select, insert, update, delete on public.portefeuilles to service_role;
drop policy if exists portefeuilles_select on public.portefeuilles;
create policy portefeuilles_select on public.portefeuilles for select to authenticated
  using ((((select auth.jwt()) -> 'app_metadata' ->> 'is_super_admin')::boolean = true
    or organisation_id = (select current_user_organisation_id())));

create index if not exists idx_secrets_portefeuille_organisation on public.secrets_portefeuille(organisation_id);
drop trigger if exists trg_secrets_portefeuille_updated_at on public.secrets_portefeuille;
create trigger trg_secrets_portefeuille_updated_at before update on public.secrets_portefeuille
  for each row execute function public.set_updated_at();
alter table public.secrets_portefeuille enable row level security;
revoke all on public.secrets_portefeuille from public, anon, authenticated;
grant select on public.secrets_portefeuille to authenticated;
grant select, insert, update, delete on public.secrets_portefeuille to service_role;
drop policy if exists secrets_portefeuille_select on public.secrets_portefeuille;
create policy secrets_portefeuille_select on public.secrets_portefeuille for select to authenticated
  using ((((select auth.jwt()) -> 'app_metadata' ->> 'is_super_admin')::boolean = true
    or organisation_id = (select current_user_organisation_id())));

create index if not exists idx_demandes_paiement_organisation on public.demandes_paiement(organisation_id);
drop trigger if exists trg_demandes_paiement_updated_at on public.demandes_paiement;
create trigger trg_demandes_paiement_updated_at before update on public.demandes_paiement
  for each row execute function public.set_updated_at();
alter table public.demandes_paiement enable row level security;
revoke all on public.demandes_paiement from public, anon, authenticated;
grant select on public.demandes_paiement to authenticated;
grant select, insert, update, delete on public.demandes_paiement to service_role;
drop policy if exists demandes_paiement_select on public.demandes_paiement;
create policy demandes_paiement_select on public.demandes_paiement for select to authenticated
  using ((((select auth.jwt()) -> 'app_metadata' ->> 'is_super_admin')::boolean = true
    or organisation_id = (select current_user_organisation_id())));

create index if not exists idx_mouvements_portefeuille_organisation on public.mouvements_portefeuille(organisation_id);
alter table public.mouvements_portefeuille enable row level security;
revoke all on public.mouvements_portefeuille from public, anon, authenticated;
grant select on public.mouvements_portefeuille to authenticated;
grant select, insert, update, delete on public.mouvements_portefeuille to service_role;
drop policy if exists mouvements_portefeuille_select on public.mouvements_portefeuille;
create policy mouvements_portefeuille_select on public.mouvements_portefeuille for select to authenticated
  using ((((select auth.jwt()) -> 'app_metadata' ->> 'is_super_admin')::boolean = true
    or organisation_id = (select current_user_organisation_id())));

drop policy if exists evenements_insert on public.evenements;
create policy evenements_insert on public.evenements for insert to authenticated
  with check ((((select auth.jwt()) -> 'app_metadata' ->> 'is_super_admin')::boolean = true
    or organisation_id = (select current_user_organisation_id())))
;
drop policy if exists evenements_update on public.evenements;
create policy evenements_update on public.evenements for update to authenticated
  using ((((select auth.jwt()) -> 'app_metadata' ->> 'is_super_admin')::boolean = true
    or organisation_id = (select current_user_organisation_id())))
  with check ((((select auth.jwt()) -> 'app_metadata' ->> 'is_super_admin')::boolean = true
    or organisation_id = (select current_user_organisation_id())))
;
drop policy if exists evenements_delete on public.evenements;
create policy evenements_delete on public.evenements for delete to authenticated
  using ((((select auth.jwt()) -> 'app_metadata' ->> 'is_super_admin')::boolean = true
    or organisation_id = (select current_user_organisation_id())))
;
grant insert, update, delete on public.evenements to authenticated;
drop policy if exists evenements_benevole_select on public.evenements;
create policy evenements_benevole_select on public.evenements for select to authenticated
  using (((select auth.jwt()) -> 'app_metadata' ->> 'is_super_admin')::boolean = true
    or (organisation_id = (select current_benevole_organisation_id()) and statut <> 'brouillon'));
drop policy if exists demandes_paiement_benevole_select on public.demandes_paiement;
create policy demandes_paiement_benevole_select on public.demandes_paiement for select to authenticated
  using (((select auth.jwt()) -> 'app_metadata' ->> 'is_super_admin')::boolean = true
    or (organisation_id = (select current_benevole_organisation_id())));

create index if not exists idx_commandes_evenement_statut on public.commandes(evenement_id, statut);
create index if not exists idx_commandes_portefeuille on public.commandes(portefeuille_id);
create index if not exists idx_secrets_portefeuille_portefeuille on public.secrets_portefeuille(portefeuille_id);
create index if not exists idx_demandes_paiement_portefeuille_statut on public.demandes_paiement(portefeuille_id, statut);
create index if not exists idx_mouvements_portefeuille_portefeuille on public.mouvements_portefeuille(portefeuille_id);
revoke truncate on public.mouvements_portefeuille from public, anon, authenticated, service_role;

-- Les organisations existantes restent désactivées par défaut (clé absente = false).
-- Ne pas réécrire les objets existants, ni écraser un flag déjà activé au rejeu.
alter table public.organisations alter column fonctionnalites_activees
  set default '{"dons": true, "adherents": true, "evenements": false}'::jsonb;
commit;
