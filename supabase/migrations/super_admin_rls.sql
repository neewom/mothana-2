-- =========================================================
-- Migration : bypass RLS pour le super-admin
-- À exécuter dans Supabase SQL Editor
-- =========================================================
-- Le super-admin est identifié par :
--   auth.jwt() -> 'app_metadata' ->> 'is_super_admin' = 'true'
-- Pour promouvoir un compte :
--   update auth.users set raw_app_meta_data = raw_app_meta_data || '{"is_super_admin": true}'::jsonb
--   where email = 'email-du-super-admin';
-- =========================================================

-- organisations : super-admin voit tout, peut tout modifier/créer/supprimer
drop policy if exists "org_select" on organisations;
create policy "org_select" on organisations
  for select using (
    (auth.jwt() -> 'app_metadata' ->> 'is_super_admin')::boolean = true
    or id = current_effective_organisation_id()
  );

drop policy if exists "org_update_admin" on organisations;
create policy "org_update_admin" on organisations
  for update using (
    (auth.jwt() -> 'app_metadata' ->> 'is_super_admin')::boolean = true
    or id = current_user_organisation_id()
  );

drop policy if exists "org_insert_superadmin" on organisations;
create policy "org_insert_superadmin" on organisations
  for insert with check (
    (auth.jwt() -> 'app_metadata' ->> 'is_super_admin')::boolean = true
  );

drop policy if exists "org_delete_superadmin" on organisations;
create policy "org_delete_superadmin" on organisations
  for delete using (
    (auth.jwt() -> 'app_metadata' ->> 'is_super_admin')::boolean = true
  );

-- dons : super-admin peut lire tous les dons
drop policy if exists "dons_select_admin" on dons;
create policy "dons_select_admin" on dons
  for select using (
    (auth.jwt() -> 'app_metadata' ->> 'is_super_admin')::boolean = true
    or organisation_id = current_user_organisation_id()
  );

-- profils_participant : super-admin peut lire tous les profils
drop policy if exists "profils_participant_select" on profils_participant;
create policy "profils_participant_select" on profils_participant
  for select using (
    (auth.jwt() -> 'app_metadata' ->> 'is_super_admin')::boolean = true
    or organisation_id = current_effective_organisation_id()
  );

-- profils_organisation : super-admin peut tout lire et modifier
drop policy if exists "profils_org_select" on profils_organisation;
create policy "profils_org_select" on profils_organisation
  for select using (
    (auth.jwt() -> 'app_metadata' ->> 'is_super_admin')::boolean = true
    or organisation_id = current_user_organisation_id()
  );

drop policy if exists "profils_org_all_admin" on profils_organisation;
create policy "profils_org_all_admin" on profils_organisation
  for all using (
    (auth.jwt() -> 'app_metadata' ->> 'is_super_admin')::boolean = true
    or organisation_id = current_user_organisation_id()
  );
