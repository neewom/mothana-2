-- Tests du logo d'organisation (organisation_logo.sql) — staging uniquement :
--   npx supabase db query --linked -f supabase/tests/organisation_logo.sql
-- Bloc terminé par une exception : rien n'est conservé. Dépend de l'org « Association Démo
-- Staging » (compte bénévole existant, un admin) et d'au moins une autre organisation.
do $$
declare
  v_demo uuid; v_autre uuid; v_benevole uuid; v_admin uuid;
  v_logo uuid; v_pdf uuid; v_asset_autre uuid; v_logo_autre uuid;
  v_url text; v_n int; r text := '';
begin
  select id into v_demo from public.organisations where nom = 'Association Démo Staging';
  select id into v_autre from public.organisations where id <> v_demo order by created_at limit 1;
  select id into v_benevole from auth.users where email = 'benevole-' || v_demo || '@mothana.internal';
  select po.utilisateur_id into v_admin from public.profils_organisation po
    where po.organisation_id = v_demo and po.role = 'admin' order by po.created_at desc limit 1;

  -- Préparation (rôle de connexion, hors RLS) : visuels de test et logo de l'autre organisation
  insert into public.organisation_assets (organisation_id, identifiant, libelle, url)
    values (v_demo, 'test_logo_tmp', 'Logo test', 'https://exemple.test/demo/logo.png') returning id into v_logo;
  insert into public.organisation_assets (organisation_id, identifiant, libelle, url)
    values (v_demo, 'test_pdf_tmp', 'PDF test', 'https://exemple.test/demo/statuts.pdf') returning id into v_pdf;
  insert into public.organisation_assets (organisation_id, identifiant, libelle, url)
    values (v_autre, 'test_logo_autre_tmp', 'Logo autre', 'https://exemple.test/autre/logo.jpg') returning id into v_asset_autre;
  insert into public.organisation_assets (organisation_id, identifiant, libelle, url)
    values (v_autre, 'test_logo_autre2_tmp', 'Logo autre 2', 'https://exemple.test/autre/logo2.png') returning id into v_logo_autre;
  update public.organisations set logo_asset_id = v_logo_autre where id = v_autre;

  -- 1. Admin de l'organisation
  perform set_config('request.jwt.claims', json_build_object('sub', v_admin, 'role', 'authenticated',
    'app_metadata', json_build_object())::text, true);
  execute 'set local role authenticated';

  begin
    update public.organisations set logo_asset_id = v_asset_autre where id = v_demo;
    r := r || '1.admin_visuel_autre_org=ACCEPTE(KO)';
  exception when check_violation then r := r || '1.admin_visuel_autre_org=refuse';
  end;
  begin
    update public.organisations set logo_asset_id = v_pdf where id = v_demo;
    r := r || ' admin_pdf=ACCEPTE(KO)';
  exception when check_violation then r := r || ' admin_pdf=refuse';
  end;
  update public.organisations set logo_asset_id = v_logo where id = v_demo;
  get diagnostics v_n = row_count;
  r := r || ' admin_definir=' || case when v_n = 1 then 'ok' else 'KO' end;
  r := r || ' admin_url=' || case when public.get_organisation_logo_url(v_demo) = 'https://exemple.test/demo/logo.png' then 'ok' else 'KO' end;
  begin
    perform public.get_organisation_logo_url(v_autre);
    r := r || ' admin_url_autre_org=ACCEPTE(KO)';
  exception when insufficient_privilege then r := r || ' admin_url_autre_org=refuse';
  end;

  -- 2. Session bénévole (aucun profil d'organisation)
  perform set_config('request.jwt.claims', json_build_object('sub', v_benevole, 'role', 'authenticated',
    'app_metadata', json_build_object('role', 'benevole', 'organisation_id', v_demo))::text, true);

  v_url := public.get_organisation_logo_url(v_demo);
  r := r || ' | 2.benevole_url=' || case when v_url = 'https://exemple.test/demo/logo.png' then 'ok' else 'KO' end;
  begin
    perform public.get_organisation_logo_url(v_autre);
    r := r || ' benevole_url_autre_org=ACCEPTE(KO)';
  exception when insufficient_privilege then r := r || ' benevole_url_autre_org=refuse';
  end;
  select count(*) into v_n from public.organisation_assets;
  r := r || ' benevole_visuels_lisibles=' || v_n || case when v_n = 0 then '(ok)' else '(KO)' end;
  update public.organisations set logo_asset_id = null where id = v_demo;
  get diagnostics v_n = row_count;
  r := r || ' benevole_modifier=' || case when v_n = 0 then 'refuse' else 'ACCEPTE(KO)' end;

  -- 3. Session sans organisation ni claim super-admin : refusée (helpers NULL)
  perform set_config('request.jwt.claims', json_build_object('sub', gen_random_uuid(), 'role', 'authenticated',
    'app_metadata', json_build_object())::text, true);
  begin
    perform public.get_organisation_logo_url(v_demo);
    r := r || ' | 3.sans_org=ACCEPTE(KO)';
  exception when insufficient_privilege then r := r || ' | 3.sans_org=refuse';
  end;

  -- 4. Super-admin : bypass (lecture d'une autre organisation)
  perform set_config('request.jwt.claims', json_build_object('sub', gen_random_uuid(), 'role', 'authenticated',
    'app_metadata', json_build_object('is_super_admin', true))::text, true);
  r := r || ' | 4.super_admin_url_autre_org=' || case when public.get_organisation_logo_url(v_autre) = 'https://exemple.test/autre/logo2.png' then 'ok' else 'KO' end;

  -- 5. Suppression du visuel → logo retiré (admin)
  perform set_config('request.jwt.claims', json_build_object('sub', v_admin, 'role', 'authenticated',
    'app_metadata', json_build_object())::text, true);
  delete from public.organisation_assets where id = v_logo;
  r := r || ' | 5.suppression_logo_retire=' || case when (select logo_asset_id from public.organisations where id = v_demo) is null
    and public.get_organisation_logo_url(v_demo) is null then 'ok' else 'KO' end;

  raise exception 'RESULTATS: %', r;
end;
$$;
