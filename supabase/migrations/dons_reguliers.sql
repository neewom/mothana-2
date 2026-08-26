-- Dons réguliers : engagement de don récurrent (ex. prélèvement mensuel), distinct
-- des dons eux-mêmes. La génération des dons reste semi-automatique (validée par
-- l'admin), voir Trello qx3uEDA1.

create table dons_reguliers (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references organisations(id) on delete cascade,
  profil_participant_id uuid not null references profils_participant(id) on delete cascade,
  activite_id uuid references activites(id) on delete set null,
  montant numeric(10,2) not null check (montant > 0),
  jour_prelevement smallint not null check (jour_prelevement between 1 and 28),
  date_debut date not null,
  date_fin date,
  statut text not null default 'actif' check (statut in ('actif', 'arrete')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger trg_dons_reguliers_updated_at
before update on dons_reguliers
for each row execute function set_updated_at();

create index idx_dons_reguliers_organisation on dons_reguliers(organisation_id);

alter table dons_reguliers enable row level security;

create policy "dons_reguliers_select" on dons_reguliers
  for select using (
    (((select auth.jwt()) -> 'app_metadata' ->> 'is_super_admin'))::boolean = true
    or organisation_id = (select current_user_organisation_id())
  );

create policy "dons_reguliers_insert" on dons_reguliers
  for insert with check (
    (((select auth.jwt()) -> 'app_metadata' ->> 'is_super_admin'))::boolean = true
    or organisation_id = (select current_user_organisation_id())
  );

create policy "dons_reguliers_update" on dons_reguliers
  for update using (
    (((select auth.jwt()) -> 'app_metadata' ->> 'is_super_admin'))::boolean = true
    or organisation_id = (select current_user_organisation_id())
  );

create policy "dons_reguliers_delete" on dons_reguliers
  for delete using (
    (((select auth.jwt()) -> 'app_metadata' ->> 'is_super_admin'))::boolean = true
    or organisation_id = (select current_user_organisation_id())
  );

-- Relie chaque don généré à son engagement d'origine, pour savoir sans ambiguïté
-- quels mois ont déjà été confirmés (et alimenter le regroupement Cerfa, carte hKEOqJ5z).
alter table dons add column don_regulier_id uuid references dons_reguliers(id) on delete set null;
create index idx_dons_don_regulier on dons(don_regulier_id);
