-- Refonte Cerfa (§1.3 docs/brief-cerfa.md) : templates HTML/CSS des reçus
-- fiscaux, remplace l'approche pdf-lib (positionnement x/y rigide) par des
-- templates éditables (placeholders {{...}}, cf. §2.2), un par type de
-- Cerfa (11580 particuliers / 16216 personnes morales) et par organisation.
create table templates_recu (
  id uuid primary key default uuid_generate_v4(),
  organisation_id uuid not null references organisations(id) on delete cascade,
  nom text not null,
  type_cerfa text not null check (type_cerfa in ('11580', '16216')),
  html_template text not null,
  css text,
  is_active boolean not null default false,
  is_archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Un seul template actif par type et par organisation
create unique index idx_templates_recu_active
  on templates_recu(organisation_id, type_cerfa)
  where is_active = true and is_archived = false;

-- Même convention que les autres tables (organisations, personnes, dons...)
create trigger trg_templates_recu_updated_at
before update on templates_recu
for each row execute function set_updated_at();

alter table templates_recu enable row level security;

create policy "templates_recu_org" on templates_recu
  for all using (organisation_id = current_effective_organisation_id());
