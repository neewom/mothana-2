-- Migration: parametres_admin_seulement.sql
-- Audit sécurité 2026-10-24, carte « RLS bénévole, secrets, reçus » (https://trello.com/c/aSKiYaaa),
-- décision B de l'utilisateur : les paramètres de l'organisation sont en lecture seule pour un
-- contributeur. Seul un admin (ou le super-admin) modifie l'organisation (identité, modèle de
-- reçu, adhésions, formulaire public, statuts, porte-monnaie), les modèles de reçus et de cartes,
-- et les visuels. Le contributeur garde tout l'opérationnel (adhérents, dons, reçus, campagnes,
-- donateurs, activités, porte-monnaie).
--
-- Les policies « ALL » des modèles et visuels sont scindées : lecture pour tout membre de
-- l'organisation, écriture pour l'admin. Les helpers renvoient NULL pour une session sans
-- profil (bénévole, vendeur) : la condition est alors fausse, rien n'est autorisé.

begin;

-- organisations : UPDATE réservé à l'admin (INSERT/DELETE sont déjà réservés au super-admin)
drop policy if exists org_update_admin on public.organisations;
create policy org_update_admin on public.organisations
  for update
  using (
    ((select auth.jwt()) -> 'app_metadata' ->> 'is_super_admin')::boolean = true
    or (id = (select current_user_organisation_id()) and (select current_user_role()) = 'admin')
  )
  with check (
    ((select auth.jwt()) -> 'app_metadata' ->> 'is_super_admin')::boolean = true
    or (id = (select current_user_organisation_id()) and (select current_user_role()) = 'admin')
  );

-- Modèles de reçus, de cartes adhérent et visuels : lecture membre, écriture admin
do $$
declare
  v_table text;
  v_ancienne text;
  v_membre constant text :=
    '((select auth.jwt()) -> ''app_metadata'' ->> ''is_super_admin'')::boolean = true '
    || 'or organisation_id = (select current_user_organisation_id())';
  v_admin constant text :=
    '((select auth.jwt()) -> ''app_metadata'' ->> ''is_super_admin'')::boolean = true '
    || 'or (organisation_id = (select current_user_organisation_id()) and (select current_user_role()) = ''admin'')';
begin
  for v_table, v_ancienne in
    select * from (values
      ('templates_recu', 'templates_recu_org'),
      ('templates_carte_adherent', 'templates_carte_adherent_org'),
      ('organisation_assets', 'organisation_assets_org')
    ) as t(nom, ancienne)
  loop
    execute format('drop policy if exists %I on public.%I', v_ancienne, v_table);
    execute format('drop policy if exists %I on public.%I', v_table || '_select', v_table);
    execute format('drop policy if exists %I on public.%I', v_table || '_insert', v_table);
    execute format('drop policy if exists %I on public.%I', v_table || '_update', v_table);
    execute format('drop policy if exists %I on public.%I', v_table || '_delete', v_table);
    execute format('create policy %I on public.%I for select using (%s)', v_table || '_select', v_table, v_membre);
    execute format('create policy %I on public.%I for insert with check (%s)', v_table || '_insert', v_table, v_admin);
    execute format('create policy %I on public.%I for update using (%s) with check (%s)', v_table || '_update', v_table, v_admin, v_admin);
    execute format('create policy %I on public.%I for delete using (%s)', v_table || '_delete', v_table, v_admin);
  end loop;
end $$;

-- Bucket public organisation-assets (logos, tampons, statuts) : lecture des fichiers via URL
-- publique ; liste pour les membres, écriture pour l'admin.
drop policy if exists organisation_assets_write on storage.objects;
drop policy if exists organisation_assets_select on storage.objects;
drop policy if exists organisation_assets_insert on storage.objects;
drop policy if exists organisation_assets_update on storage.objects;
drop policy if exists organisation_assets_delete on storage.objects;

create policy organisation_assets_select on storage.objects
  for select
  using (
    bucket_id = 'organisation-assets'
    and (
      ((select auth.jwt()) -> 'app_metadata' ->> 'is_super_admin')::boolean = true
      or (storage.foldername(name))[1] = (select current_user_organisation_id())::text
    )
  );

create policy organisation_assets_insert on storage.objects
  for insert
  with check (
    bucket_id = 'organisation-assets'
    and (
      ((select auth.jwt()) -> 'app_metadata' ->> 'is_super_admin')::boolean = true
      or ((storage.foldername(name))[1] = (select current_user_organisation_id())::text
          and (select current_user_role()) = 'admin')
    )
  );

create policy organisation_assets_update on storage.objects
  for update
  using (
    bucket_id = 'organisation-assets'
    and (
      ((select auth.jwt()) -> 'app_metadata' ->> 'is_super_admin')::boolean = true
      or ((storage.foldername(name))[1] = (select current_user_organisation_id())::text
          and (select current_user_role()) = 'admin')
    )
  )
  with check (
    bucket_id = 'organisation-assets'
    and (
      ((select auth.jwt()) -> 'app_metadata' ->> 'is_super_admin')::boolean = true
      or ((storage.foldername(name))[1] = (select current_user_organisation_id())::text
          and (select current_user_role()) = 'admin')
    )
  );

create policy organisation_assets_delete on storage.objects
  for delete
  using (
    bucket_id = 'organisation-assets'
    and (
      ((select auth.jwt()) -> 'app_metadata' ->> 'is_super_admin')::boolean = true
      or ((storage.foldername(name))[1] = (select current_user_organisation_id())::text
          and (select current_user_role()) = 'admin')
    )
  );

commit;
