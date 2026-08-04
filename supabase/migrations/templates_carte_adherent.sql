-- Module Adhérents, étape 5 : gabarit HTML/CSS de carte adhérent, seedé
-- automatiquement à la création d'une organisation (même pattern que
-- templates_recu.sql pour les reçus Cerfa) — un seul type de carte, pas de
-- dimension type_cerfa.
create table templates_carte_adherent (
  id uuid primary key default uuid_generate_v4(),
  organisation_id uuid not null references organisations(id) on delete cascade,
  nom text not null,
  html_template text not null,
  css text,
  is_active boolean not null default false,
  is_archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Un seul template actif par organisation
create unique index idx_templates_carte_adherent_active
  on templates_carte_adherent(organisation_id)
  where is_active = true and is_archived = false;

create trigger trg_templates_carte_adherent_updated_at
before update on templates_carte_adherent
for each row execute function set_updated_at();

alter table templates_carte_adherent enable row level security;

-- Bypass super-admin inclus dès le départ (contrairement à templates_recu.sql
-- qui avait dû être corrigé après coup, cf. templates_recu_super_admin_bypass.sql) :
-- le seed automatique à la création d'une organisation (SuperAdminPage.tsx)
-- est fait par un super-admin qui n'est pas encore membre de l'organisation
-- qu'il vient de créer — current_effective_organisation_id() renverrait NULL
-- sans ce bypass, et l'insert échouerait silencieusement (RLS).
create policy "templates_carte_adherent_org" on templates_carte_adherent
  for all using (
    organisation_id = (select current_effective_organisation_id())
    or (((select auth.jwt()) -> 'app_metadata' ->> 'is_super_admin'))::boolean = true
  );
