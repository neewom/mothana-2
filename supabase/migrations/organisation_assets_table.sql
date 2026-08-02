-- =========================================================
-- Migration : table des assets d'organisation (logo, tampon,
-- signature, ou tout autre visuel) — remplace les 3 champs
-- fixes logo_url/tampon_url/signature_url du JSONB
-- modele_recu_pdf par une liste ouverte, chaque asset ayant
-- un identifiant utilisable comme placeholder {{asset_xxx}}
-- dans les templates de reçus fiscaux.
-- Le bucket Storage organisation-assets (organisation_assets_storage.sql)
-- ne change pas : déjà scopé génériquement par organisation_id.
-- =========================================================

create table organisation_assets (
  id uuid primary key default uuid_generate_v4(),
  organisation_id uuid not null references organisations(id) on delete cascade,
  identifiant text not null check (identifiant ~ '^[a-z0-9_]+$'),
  libelle text not null,
  url text not null,
  created_at timestamptz not null default now(),
  unique (organisation_id, identifiant)
);

alter table organisation_assets enable row level security;

create policy "organisation_assets_org" on organisation_assets
  for all using (organisation_id = current_effective_organisation_id());
