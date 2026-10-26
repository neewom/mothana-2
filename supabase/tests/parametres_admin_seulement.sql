-- Tests de parametres_admin_seulement.sql — à rejouer sur staging uniquement :
--   npx supabase db query --linked -f supabase/tests/parametres_admin_seulement.sql
-- Bloc terminé par une exception : rien n'est conservé ; le message RESULTATS: liste chaque cas.
-- Dépend de l'org « Association Démo Staging » (un admin, un contributeur, le compte bénévole,
-- au moins un modèle de reçu et de carte) et d'un super-admin.
do $$
declare
  v_demo uuid; v_admin uuid; v_contrib uuid; v_benevole uuid; v_super uuid;
  v_tpl uuid; v_carte uuid;
  r text := '';
  n int;
begin
  select id into v_demo from public.organisations where nom = 'Association Démo Staging';
  select po.utilisateur_id into v_admin from public.profils_organisation po
    where po.organisation_id = v_demo and po.role = 'admin' order by po.created_at desc limit 1;
  select po.utilisateur_id into v_contrib from public.profils_organisation po
    where po.organisation_id = v_demo and po.role = 'contributeur' limit 1;
  select id into v_benevole from auth.users where email = 'benevole-' || v_demo || '@mothana.internal';
  select id into v_super from auth.users where (raw_app_meta_data ->> 'is_super_admin')::boolean limit 1;
  select id into v_tpl from public.templates_recu where organisation_id = v_demo limit 1;
  select id into v_carte from public.templates_carte_adherent where organisation_id = v_demo limit 1;

  execute 'set local role authenticated';

  -- 1. Contributeur : lit les réglages, ne les modifie pas
  perform set_config('request.jwt.claims', json_build_object('sub', v_contrib, 'role', 'authenticated', 'app_metadata', json_build_object())::text, true);
  r := r || '1.contrib_lecture=' || ((select count(*) from public.organisations where id = v_demo) = 1
    and (select count(*) from public.templates_recu where id = v_tpl) = 1
    and (select count(*) from public.templates_carte_adherent where id = v_carte) = 1);
  update public.organisations set nom = nom where id = v_demo;
  get diagnostics n = row_count;
  r := r || ' contrib_update_org=' || n;
  update public.templates_recu set nom = nom where id = v_tpl;
  get diagnostics n = row_count;
  r := r || ' contrib_update_tpl=' || n;
  delete from public.templates_carte_adherent where id = v_carte;
  get diagnostics n = row_count;
  r := r || ' contrib_delete_carte=' || n;
  begin
    insert into public.organisation_assets (organisation_id, identifiant, libelle, url) values (v_demo, 'test_rls', 'Test RLS', 'https://example.invalid/x.png');
    r := r || ' contrib_insert_asset=ACCEPTE(KO)';
  exception when insufficient_privilege then r := r || ' contrib_insert_asset=refuse';
  end;
  begin
    insert into storage.objects (bucket_id, name) values ('organisation-assets', v_demo || '/test-rls.png');
    r := r || ' contrib_storage=ACCEPTE(KO)';
  exception when insufficient_privilege then r := r || ' contrib_storage=refuse';
  end;

  -- 2. Admin : modifie
  perform set_config('request.jwt.claims', json_build_object('sub', v_admin, 'role', 'authenticated', 'app_metadata', json_build_object())::text, true);
  update public.organisations set nom = nom where id = v_demo;
  get diagnostics n = row_count;
  r := r || ' | 2.admin_update_org=' || n;
  update public.templates_recu set nom = nom where id = v_tpl;
  get diagnostics n = row_count;
  r := r || ' admin_update_tpl=' || n;
  insert into public.organisation_assets (organisation_id, identifiant, libelle, url) values (v_demo, 'test_rls', 'Test RLS', 'https://example.invalid/x.png');
  r := r || ' admin_insert_asset=ok';
  insert into storage.objects (bucket_id, name) values ('organisation-assets', v_demo || '/test-rls.png');
  r := r || ' admin_storage=ok';

  -- 3. Super-admin : bypass
  perform set_config('request.jwt.claims', json_build_object('sub', v_super, 'role', 'authenticated',
    'app_metadata', json_build_object('is_super_admin', true))::text, true);
  update public.organisations set nom = nom where id = v_demo;
  get diagnostics n = row_count;
  r := r || ' | 3.super_update_org=' || n;
  update public.templates_carte_adherent set nom = nom where id = v_carte;
  get diagnostics n = row_count;
  r := r || ' super_update_carte=' || n;

  -- 4. Bénévole : ni lecture des modèles, ni écriture
  perform set_config('request.jwt.claims', json_build_object('sub', v_benevole, 'role', 'authenticated',
    'app_metadata', json_build_object('role', 'benevole', 'organisation_id', v_demo))::text, true);
  update public.organisations set nom = nom where id = v_demo;
  get diagnostics n = row_count;
  r := r || ' | 4.benevole_update_org=' || n
    || ' benevole_lecture_tpl=' || (select count(*) from public.templates_recu);

  execute 'reset role';
  raise exception 'RESULTATS: %', r;
end $$;
