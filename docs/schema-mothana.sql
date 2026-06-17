-- =========================================================
-- MOTHANA - Schéma de base de données (Supabase / PostgreSQL)
-- =========================================================
-- Ce script crée :
--   1. Les tables principales
--   2. Les triggers utilitaires (updated_at)
--   3. L'activation de RLS + policies
--   4. Un jeu de données de démo (seed)
-- =========================================================

-- ---------------------------------------------------------
-- EXTENSIONS
-- ---------------------------------------------------------
create extension if not exists "uuid-ossp";

-- ---------------------------------------------------------
-- FONCTION UTILITAIRE : updated_at automatique
-- ---------------------------------------------------------
create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

-- =========================================================
-- 1. TABLES
-- =========================================================

-- ---------------------------------------------------------
-- organisations
-- ---------------------------------------------------------
create table organisations (
  id uuid primary key default uuid_generate_v4(),
  nom text not null,
  modele_recu_pdf jsonb default '{}'::jsonb,
  code_pin_benevole text unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger trg_organisations_updated_at
before update on organisations
for each row execute function set_updated_at();

-- ---------------------------------------------------------
-- profils_organisation (admins liés à une organisation)
-- ---------------------------------------------------------
create table profils_organisation (
  id uuid primary key default uuid_generate_v4(),
  utilisateur_id uuid not null references auth.users(id) on delete cascade,
  organisation_id uuid not null references organisations(id) on delete cascade,
  nom_affiche text,
  role text not null default 'admin' check (role in ('admin')),
  created_at timestamptz not null default now(),
  unique (utilisateur_id, organisation_id)
);

-- ---------------------------------------------------------
-- personnes (identité globale d'un participant)
-- ---------------------------------------------------------
create table personnes (
  id uuid primary key default uuid_generate_v4(),
  nom text not null,
  prenom text,
  email text,
  telephone text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger trg_personnes_updated_at
before update on personnes
for each row execute function set_updated_at();

-- ---------------------------------------------------------
-- profils_participant (profil d'une personne dans une organisation)
-- ---------------------------------------------------------
create table profils_participant (
  id uuid primary key default uuid_generate_v4(),
  personne_id uuid not null references personnes(id) on delete cascade,
  organisation_id uuid not null references organisations(id) on delete cascade,
  notes text,
  created_at timestamptz not null default now(),
  unique (personne_id, organisation_id)
);

-- ---------------------------------------------------------
-- activites
-- ---------------------------------------------------------
create table activites (
  id uuid primary key default uuid_generate_v4(),
  organisation_id uuid not null references organisations(id) on delete cascade,
  nom text not null,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------
-- dons
-- ---------------------------------------------------------
create table dons (
  id uuid primary key default uuid_generate_v4(),
  profil_participant_id uuid not null references profils_participant(id) on delete cascade,
  organisation_id uuid not null references organisations(id) on delete cascade,
  activite_id uuid references activites(id) on delete set null,
  montant numeric(10,2) not null check (montant > 0),
  date date not null default current_date,
  mode_paiement text not null check (mode_paiement in ('virement', 'cheque', 'especes')),
  created_by_role text not null default 'admin' check (created_by_role in ('admin', 'benevole')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger trg_dons_updated_at
before update on dons
for each row execute function set_updated_at();

create index idx_dons_organisation on dons(organisation_id);
create index idx_dons_profil_participant on dons(profil_participant_id);
create index idx_dons_date on dons(date);

-- ---------------------------------------------------------
-- recus_fiscaux
-- ---------------------------------------------------------
create table recus_fiscaux (
  id uuid primary key default uuid_generate_v4(),
  profil_participant_id uuid not null references profils_participant(id) on delete cascade,
  organisation_id uuid not null references organisations(id) on delete cascade,
  annee integer not null,
  montant_total numeric(10,2) not null,
  fichier_url text,
  date_generation timestamptz not null default now(),
  unique (profil_participant_id, annee)
);

create index idx_recus_organisation on recus_fiscaux(organisation_id);


-- =========================================================
-- 2. ROW LEVEL SECURITY (RLS)
-- =========================================================
-- Principe :
--  - Un admin (auth.users) accède uniquement aux données de SON organisation,
--    déterminée via profils_organisation.
--  - L'accès "bénévole" se fait via un compte technique partagé : on utilise
--    un JWT custom claim "organisation_id" + "role" = 'benevole'
--    (à injecter via une Edge Function de login PIN, voir plan de dev).
--  - On définit une fonction helper pour récupérer l'organisation_id du
--    contexte courant, qu'il s'agisse d'un admin ou d'un bénévole.

-- ---------------------------------------------------------
-- Fonction helper : organisation_id courant (admin)
-- ---------------------------------------------------------
create or replace function current_user_organisation_id()
returns uuid as $$
  select organisation_id
  from profils_organisation
  where utilisateur_id = auth.uid()
  limit 1;
$$ language sql stable security definer;

-- ---------------------------------------------------------
-- Fonction helper : organisation_id courant (bénévole, via JWT claim)
-- ---------------------------------------------------------
create or replace function current_benevole_organisation_id()
returns uuid as $$
  select (auth.jwt() -> 'app_metadata' ->> 'organisation_id')::uuid
  where (auth.jwt() -> 'app_metadata' ->> 'role') = 'benevole';
$$ language sql stable;

-- ---------------------------------------------------------
-- Fonction helper : organisation_id effectif (admin OU bénévole)
-- ---------------------------------------------------------
create or replace function current_effective_organisation_id()
returns uuid as $$
  select coalesce(
    current_user_organisation_id(),
    current_benevole_organisation_id()
  );
$$ language sql stable;

-- ---------------------------------------------------------
-- Activation RLS
-- ---------------------------------------------------------
alter table organisations enable row level security;
alter table profils_organisation enable row level security;
alter table personnes enable row level security;
alter table profils_participant enable row level security;
alter table activites enable row level security;
alter table dons enable row level security;
alter table recus_fiscaux enable row level security;

-- ---------------------------------------------------------
-- organisations : lecture/écriture uniquement sur sa propre organisation
-- ---------------------------------------------------------
create policy "org_select" on organisations
  for select using (id = current_effective_organisation_id());

create policy "org_update_admin" on organisations
  for update using (id = current_user_organisation_id());

-- ---------------------------------------------------------
-- profils_organisation : visible uniquement par les admins de l'organisation
-- ---------------------------------------------------------
create policy "profils_org_select" on profils_organisation
  for select using (organisation_id = current_user_organisation_id());

create policy "profils_org_all_admin" on profils_organisation
  for all using (organisation_id = current_user_organisation_id());

-- ---------------------------------------------------------
-- personnes : accès via profils_participant de l'organisation courante
-- (table sans organisation_id direct -> on passe par une sous-requête)
-- ---------------------------------------------------------
create policy "personnes_select" on personnes
  for select using (
    exists (
      select 1 from profils_participant pp
      where pp.personne_id = personnes.id
        and pp.organisation_id = current_effective_organisation_id()
    )
  );

create policy "personnes_insert" on personnes
  for insert with check (true); -- création libre, le profil associé est restreint par ailleurs

create policy "personnes_update" on personnes
  for update using (
    exists (
      select 1 from profils_participant pp
      where pp.personne_id = personnes.id
        and pp.organisation_id = current_effective_organisation_id()
    )
  );

-- ---------------------------------------------------------
-- profils_participant : segmenté par organisation
-- ---------------------------------------------------------
create policy "profils_participant_select" on profils_participant
  for select using (organisation_id = current_effective_organisation_id());

create policy "profils_participant_insert" on profils_participant
  for insert with check (organisation_id = current_effective_organisation_id());

create policy "profils_participant_update_admin" on profils_participant
  for update using (organisation_id = current_user_organisation_id());

-- ---------------------------------------------------------
-- activites : lecture pour admin + bénévole, écriture admin uniquement
-- ---------------------------------------------------------
create policy "activites_select" on activites
  for select using (organisation_id = current_effective_organisation_id());

create policy "activites_write_admin" on activites
  for all using (organisation_id = current_user_organisation_id());

-- ---------------------------------------------------------
-- dons : lecture admin uniquement (le bénévole ne consulte pas la liste),
-- insertion admin + bénévole, modification/suppression admin uniquement
-- ---------------------------------------------------------
create policy "dons_select_admin" on dons
  for select using (organisation_id = current_user_organisation_id());

create policy "dons_insert" on dons
  for insert with check (organisation_id = current_effective_organisation_id());

create policy "dons_update_admin" on dons
  for update using (organisation_id = current_user_organisation_id());

create policy "dons_delete_admin" on dons
  for delete using (organisation_id = current_user_organisation_id());

-- ---------------------------------------------------------
-- recus_fiscaux : admin uniquement
-- ---------------------------------------------------------
create policy "recus_all_admin" on recus_fiscaux
  for all using (organisation_id = current_user_organisation_id());


-- =========================================================
-- 3. SEED DE DEMO
-- =========================================================
-- Reprend les données visibles dans la maquette (organisation Mothana)

insert into organisations (id, nom, code_pin_benevole)
values ('00000000-0000-0000-0000-000000000001', 'Mothana', '1234');

-- Activités
insert into activites (id, organisation_id, nom) values
  ('00000000-0000-0000-0000-000000000101', '00000000-0000-0000-0000-000000000001', 'Nouvel An Lao 2025'),
  ('00000000-0000-0000-0000-000000000102', '00000000-0000-0000-0000-000000000001', 'Cours de Laotien'),
  ('00000000-0000-0000-0000-000000000103', '00000000-0000-0000-0000-000000000001', 'Repas communautaire');

-- Personnes
insert into personnes (id, nom, prenom) values
  ('00000000-0000-0000-0000-000000000201', 'PHOMMAVONG', 'Bounsong'),
  ('00000000-0000-0000-0000-000000000202', 'KEOVICHITH', 'Chanthanom'),
  ('00000000-0000-0000-0000-000000000203', 'SENGMANY', 'Phonesavanh'),
  ('00000000-0000-0000-0000-000000000204', 'LUANGPHAXAY', 'Dalavanh'),
  ('00000000-0000-0000-0000-000000000205', 'VONGKHAMPHANH', 'Sisouphanh'),
  ('00000000-0000-0000-0000-000000000206', 'BOUNMIXAY', 'Nampheung');

-- Profils participant (rattachement à l'organisation Mothana)
insert into profils_participant (id, personne_id, organisation_id) values
  ('00000000-0000-0000-0000-000000000301', '00000000-0000-0000-0000-000000000201', '00000000-0000-0000-0000-000000000001'),
  ('00000000-0000-0000-0000-000000000302', '00000000-0000-0000-0000-000000000202', '00000000-0000-0000-0000-000000000001'),
  ('00000000-0000-0000-0000-000000000303', '00000000-0000-0000-0000-000000000203', '00000000-0000-0000-0000-000000000001'),
  ('00000000-0000-0000-0000-000000000304', '00000000-0000-0000-0000-000000000204', '00000000-0000-0000-0000-000000000001'),
  ('00000000-0000-0000-0000-000000000305', '00000000-0000-0000-0000-000000000205', '00000000-0000-0000-0000-000000000001'),
  ('00000000-0000-0000-0000-000000000306', '00000000-0000-0000-0000-000000000206', '00000000-0000-0000-0000-000000000001');

-- Dons (basés sur la capture d'écran)
insert into dons (profil_participant_id, organisation_id, activite_id, montant, date, mode_paiement) values
  ('00000000-0000-0000-0000-000000000301', '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000101', 150.00, '2026-06-10', 'virement'),
  ('00000000-0000-0000-0000-000000000302', '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000101', 80.00,  '2026-06-06', 'cheque'),
  ('00000000-0000-0000-0000-000000000303', '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000102', 200.00, '2026-05-24', 'especes'),
  ('00000000-0000-0000-0000-000000000304', '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000103', 50.00,  '2026-05-02', 'virement'),
  ('00000000-0000-0000-0000-000000000305', '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000101', 300.00, '2026-04-18', 'cheque'),
  ('00000000-0000-0000-0000-000000000306', '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000102', 120.00, '2026-03-27', 'virement'),
  ('00000000-0000-0000-0000-000000000301', '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000103', 75.00,  '2026-02-14', 'especes'),
  ('00000000-0000-0000-0000-000000000301', '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000101', 90.00,  '2026-01-15', 'virement');

-- Note : pour créer le compte admin de démo, créer un utilisateur via
-- Supabase Auth (email/mot de passe), puis exécuter :
--
-- insert into profils_organisation (utilisateur_id, organisation_id, nom_affiche, role)
-- values ('<uuid-de-l-utilisateur-cree>', '00000000-0000-0000-0000-000000000001', 'Admin Mothana', 'admin');
