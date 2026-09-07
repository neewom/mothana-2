-- =========================================================
-- Migration : pièces jointes sur un don (justificatifs)
-- Cadré 2026-08-09, carte Trello "Pièces jointes sur un don"
-- =========================================================
-- Table dons_fichiers : plusieurs fichiers par don, pas une simple
-- colonne sur dons.
--
-- Accès (RLS) :
-- - select/insert : admin ET bénévole (current_effective_organisation_id()),
--   même scope que la saisie d'un don elle-même.
-- - delete : admin uniquement (current_user_organisation_id()) — un
--   bénévole peut ajouter/consulter mais pas supprimer.
-- - super-admin : bypass complet, cohérent avec super_admin_rls.sql.
--
-- Bucket Storage privé dons-fichiers (justificatif de paiement
-- potentiellement sensible, pas le pattern public de
-- organisation-assets) — URL signée générée à la demande côté client.
-- RLS storage.objects : même convention que organisation-assets/
-- recus-fiscaux (1er segment du chemin objet = organisation_id),
-- mais avec un policy insert/select ouvert au bénévole en plus de
-- l'admin (contrairement à recus-fiscaux, écrit uniquement par une
-- edge function service_role).
-- =========================================================

create table dons_fichiers (
  id uuid primary key default gen_random_uuid(),
  don_id uuid not null references dons(id) on delete cascade,
  organisation_id uuid not null references organisations(id) on delete cascade,
  chemin_storage text not null,
  nom_original text not null,
  type_mime text not null,
  taille bigint not null,
  uploaded_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index idx_dons_fichiers_don on dons_fichiers(don_id);
create index idx_dons_fichiers_organisation on dons_fichiers(organisation_id);

alter table dons_fichiers enable row level security;

create policy "dons_fichiers_select" on dons_fichiers
  for select using (
    (auth.jwt() -> 'app_metadata' ->> 'is_super_admin')::boolean = true
    or organisation_id = current_effective_organisation_id()
  );

create policy "dons_fichiers_insert" on dons_fichiers
  for insert with check (
    organisation_id = current_effective_organisation_id()
  );

create policy "dons_fichiers_delete_admin" on dons_fichiers
  for delete using (
    (auth.jwt() -> 'app_metadata' ->> 'is_super_admin')::boolean = true
    or organisation_id = current_user_organisation_id()
  );

-- ---------------------------------------------------------
-- Bucket Storage privé
-- ---------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'dons-fichiers',
  'dons-fichiers',
  false,
  10485760, -- 10 Mo
  array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'application/pdf']
)
on conflict (id) do nothing;

create policy "dons_fichiers_storage_select"
  on storage.objects for select
  using (
    bucket_id = 'dons-fichiers'
    and (
      (auth.jwt() -> 'app_metadata' ->> 'is_super_admin')::boolean = true
      or (storage.foldername(name))[1] = public.current_effective_organisation_id()::text
    )
  );

create policy "dons_fichiers_storage_insert"
  on storage.objects for insert
  with check (
    bucket_id = 'dons-fichiers'
    and (storage.foldername(name))[1] = public.current_effective_organisation_id()::text
  );

create policy "dons_fichiers_storage_delete"
  on storage.objects for delete
  using (
    bucket_id = 'dons-fichiers'
    and (
      (auth.jwt() -> 'app_metadata' ->> 'is_super_admin')::boolean = true
      or (storage.foldername(name))[1] = public.current_user_organisation_id()::text
    )
  );
