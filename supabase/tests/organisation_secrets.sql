-- Tests des secrets d'organisation, des reçus en lecture seule et de get_organisation_public
-- (organisation_secrets.sql, organisation_secrets_retrait_colonnes.sql, recus_lecture_seule.sql,
-- get_organisation_public_sans_id.sql) — à rejouer sur staging uniquement :
--   npx supabase db query --linked -f supabase/tests/organisation_secrets.sql
-- Tout se passe dans un bloc qui se termine par une exception : rien n'est conservé ; le
-- message RESULTATS: liste chaque cas. Dépend de l'org « Association Démo Staging » (un admin,
-- un contributeur, le compte bénévole, au moins un reçu) et d'un super-admin.
do $$
declare
  v_demo uuid; v_admin uuid; v_contrib uuid; v_benevole uuid; v_super uuid; v_recu uuid; v_org uuid;
  r text := '';
  n int;
begin
  select id into v_demo from public.organisations where nom = 'Association Démo Staging';
  select po.utilisateur_id into v_admin from public.profils_organisation po join auth.users au on au.id = po.utilisateur_id
    where po.organisation_id = v_demo and po.role = 'admin' and (au.banned_until is null or au.banned_until < now()) order by po.created_at desc limit 1;
  select po.utilisateur_id into v_contrib from public.profils_organisation po join auth.users au on au.id = po.utilisateur_id
    where po.organisation_id = v_demo and po.role = 'contributeur' and (au.banned_until is null or au.banned_until < now()) limit 1;
  select id into v_benevole from auth.users where email = 'benevole-' || v_demo || '@mothana.internal';
  select id into v_super from auth.users where (raw_app_meta_data ->> 'is_super_admin')::boolean limit 1;
  select id into v_recu from public.recus_fiscaux where organisation_id = v_demo limit 1;

  -- 1. Colonnes secrètes retirées d'organisations
  r := r || '1.colonnes_retirees=' || ((select count(*) from information_schema.columns where table_name = 'organisations'
         and column_name in ('brevo_api_key', 'code_pin_benevole', 'code_pin_vendeur_evenement')) = 0);

  -- 2. Session bénévole : aucune lecture des secrets
  perform set_config('request.jwt.claims', json_build_object('sub', v_benevole, 'role', 'authenticated',
    'app_metadata', json_build_object('role', 'benevole', 'organisation_id', v_demo))::text, true);
  execute 'set local role authenticated';
  begin
    perform 1 from public.organisation_secrets limit 1;
    r := r || ' | 2.benevole_table=ACCEPTE(KO)';
  exception when insufficient_privilege then r := r || ' | 2.benevole_table=refuse';
  end;
  begin
    perform public.codes_pin(v_demo);
    r := r || ' benevole_codes_pin=ACCEPTE(KO)';
  exception when insufficient_privilege then r := r || ' benevole_codes_pin=refuse';
  end;
  begin
    perform public.etat_config_brevo(v_demo);
    r := r || ' benevole_etat_brevo=ACCEPTE(KO)';
  exception when insufficient_privilege then r := r || ' benevole_etat_brevo=refuse';
  end;

  -- 3. Contributeur : voit l'état Brevo (sans clé), mais ni PIN ni modification Brevo
  perform set_config('request.jwt.claims', json_build_object('sub', v_contrib, 'role', 'authenticated', 'app_metadata', json_build_object())::text, true);
  r := r || ' | 3.contrib_etat=' || (public.etat_config_brevo(v_demo) ? 'cle_configuree') || ' sans_cle=' || not (public.etat_config_brevo(v_demo) ? 'brevo_api_key');
  begin
    perform public.codes_pin(v_demo);
    r := r || ' contrib_codes_pin=ACCEPTE(KO)';
  exception when insufficient_privilege then r := r || ' contrib_codes_pin=refuse';
  end;
  begin
    perform public.definir_config_brevo(v_demo, 'xkeysib-test', 'Test', 'test@example.com');
    r := r || ' contrib_definir_brevo=ACCEPTE(KO)';
  exception when insufficient_privilege then r := r || ' contrib_definir_brevo=refuse';
  end;

  -- 4. Admin : lit les PIN ; une clé vide conserve la clé enregistrée
  perform set_config('request.jwt.claims', json_build_object('sub', v_admin, 'role', 'authenticated', 'app_metadata', json_build_object())::text, true);
  r := r || ' | 4.admin_codes_pin=' || ((select count(*) from public.codes_pin(v_demo) where code_pin_benevole ~ '^\d{6}$') = 1);
  execute 'reset role';
  select count(*) into n from public.organisation_secrets where organisation_id = v_demo and brevo_api_key is not null;
  execute 'set local role authenticated';
  perform public.definir_config_brevo(v_demo, '', 'Nom test', 'contact@samakan.fr');
  execute 'reset role';
  r := r || ' admin_cle_conservee=' || ((select count(*) from public.organisation_secrets where organisation_id = v_demo and brevo_api_key is not null) = n);

  -- 5. Reçus : lecture oui, écriture non (même pour l'admin)
  execute 'set local role authenticated';
  r := r || ' | 5.recus_select=' || ((select count(*) from public.recus_fiscaux where id = v_recu) = 1);
  begin
    update public.recus_fiscaux set montant_total = montant_total where id = v_recu;
    r := r || ' recus_update=ACCEPTE(KO)';
  exception when insufficient_privilege then r := r || ' recus_update=refuse';
  end;
  begin
    delete from public.recus_fiscaux where id = v_recu;
    r := r || ' recus_delete=ACCEPTE(KO)';
  exception when insufficient_privilege then r := r || ' recus_delete=refuse';
  end;

  -- 6. Super-admin : PIN de toutes les organisations
  perform set_config('request.jwt.claims', json_build_object('sub', v_super, 'role', 'authenticated', 'app_metadata', json_build_object('is_super_admin', true))::text, true);
  r := r || ' | 6.super_pins=' || ((select count(*) from public.codes_pin_benevole_organisations()) = (select count(*) from public.organisations));
  execute 'reset role';

  -- 7. Nouvelle organisation : ligne de secrets avec un PIN bénévole unique
  insert into public.organisations (nom, slug) values ('Org test secrets', 'org-test-secrets-' || floor(random() * 1e9)::text) returning id into v_org;
  r := r || ' | 7.nouvelle_org_pin=' || ((select code_pin_benevole from public.organisation_secrets where organisation_id = v_org) ~ '^\d{6}$');

  -- 8. get_organisation_public : plus d'identifiant
  r := r || ' | 8.gop_sans_id=' || (pg_get_function_result('public.get_organisation_public(text)'::regprocedure) not like '%id uuid%');

  -- 9. anon : aucune RPC de secrets
  execute 'set local role anon';
  begin
    perform public.codes_pin(v_demo);
    r := r || ' | 9.anon=ACCEPTE(KO)';
  exception when insufficient_privilege then r := r || ' | 9.anon=refuse';
  end;

  raise exception 'RESULTATS: %', r;
end;
$$;
