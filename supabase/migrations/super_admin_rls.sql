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

-- dons : super-admin peut lire et écrire tous les dons
drop policy if exists "dons_select_admin" on dons;
create policy "dons_select_admin" on dons
  for select using (
    (auth.jwt() -> 'app_metadata' ->> 'is_super_admin')::boolean = true
    or organisation_id = current_user_organisation_id()
  );

drop policy if exists "dons_insert" on dons;
create policy "dons_insert" on dons
  for insert with check (
    (auth.jwt() -> 'app_metadata' ->> 'is_super_admin')::boolean = true
    or organisation_id = current_effective_organisation_id()
  );

drop policy if exists "dons_update_admin" on dons;
create policy "dons_update_admin" on dons
  for update using (
    (auth.jwt() -> 'app_metadata' ->> 'is_super_admin')::boolean = true
    or organisation_id = current_user_organisation_id()
  );

drop policy if exists "dons_delete_admin" on dons;
create policy "dons_delete_admin" on dons
  for delete using (
    (auth.jwt() -> 'app_metadata' ->> 'is_super_admin')::boolean = true
    or organisation_id = current_user_organisation_id()
  );

-- profils_participant : super-admin peut lire et écrire tous les profils
drop policy if exists "profils_participant_select" on profils_participant;
create policy "profils_participant_select" on profils_participant
  for select using (
    (auth.jwt() -> 'app_metadata' ->> 'is_super_admin')::boolean = true
    or organisation_id = current_effective_organisation_id()
  );

drop policy if exists "profils_participant_insert" on profils_participant;
create policy "profils_participant_insert" on profils_participant
  for insert with check (
    (auth.jwt() -> 'app_metadata' ->> 'is_super_admin')::boolean = true
    or organisation_id = current_effective_organisation_id()
  );

drop policy if exists "profils_participant_update_admin" on profils_participant;
create policy "profils_participant_update_admin" on profils_participant
  for update using (
    (auth.jwt() -> 'app_metadata' ->> 'is_super_admin')::boolean = true
    or organisation_id = current_user_organisation_id()
  );

-- personnes : super-admin peut lire toutes les personnes
-- (critique : la table n'a pas de organisation_id, le join !inner dans DonsPage
--  retournerait 0 lignes si le super-admin ne peut pas accéder aux personnes)
drop policy if exists "personnes_select" on personnes;
create policy "personnes_select" on personnes
  for select using (
    (auth.jwt() -> 'app_metadata' ->> 'is_super_admin')::boolean = true
    or exists (
      select 1 from profils_participant pp
      where pp.personne_id = personnes.id
        and pp.organisation_id = current_effective_organisation_id()
    )
  );

-- activites : super-admin peut lire toutes les activités
drop policy if exists "activites_select" on activites;
create policy "activites_select" on activites
  for select using (
    (auth.jwt() -> 'app_metadata' ->> 'is_super_admin')::boolean = true
    or organisation_id = current_effective_organisation_id()
  );

-- recus_fiscaux : super-admin peut lire/écrire tous les reçus
drop policy if exists "recus_all_admin" on recus_fiscaux;
create policy "recus_all_admin" on recus_fiscaux
  for all using (
    (auth.jwt() -> 'app_metadata' ->> 'is_super_admin')::boolean = true
    or organisation_id = current_user_organisation_id()
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
