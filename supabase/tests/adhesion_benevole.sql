-- Tests de la saisie d'adhésion par un bénévole (adhesion_benevole.sql) — staging uniquement :
--   npx supabase db query --linked -f supabase/tests/adhesion_benevole.sql
-- Bloc terminé par une exception : rien n'est conservé (seule la séquence de numérotation de
-- l'organisation avance, nextval n'étant pas transactionnel). Dépend de l'org « Association
-- Démo Staging » (compte bénévole existant, un admin).
do $$
declare
  v_demo uuid;
  v_benevole uuid;
  v_admin uuid;
  v_autre_org uuid := gen_random_uuid();
  v_res jsonb;
  v_n int;
  v_ok boolean;
  r text := '';
  c_adherent constant jsonb := '{"civilite":1,"nom":"TEST-BENEVOLE","prenom":"Zoé","date_naissance":"1990-05-12","adresse":"1 rue du Test","code_postal":"75001","ville":"Paris","pays":"France","telephone":"0600000000","courriel":"zoe.test-benevole@exemple.fr"}';
  c_signature constant text := 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';
begin
  select id into v_demo from public.organisations where nom = 'Association Démo Staging';
  select id into v_benevole from auth.users where email = 'benevole-' || v_demo || '@mothana.internal';
  select po.utilisateur_id into v_admin from public.profils_organisation po
    where po.organisation_id = v_demo and po.role = 'admin' order by po.created_at desc limit 1;

  update public.organisations set saisie_adhesion_benevole = false where id = v_demo;

  -- 1. Bénévole de l'organisation, réglage inactif : refusé
  perform set_config('request.jwt.claims', json_build_object('sub', v_benevole, 'role', 'authenticated',
    'app_metadata', json_build_object('role', 'benevole', 'organisation_id', v_demo))::text, true);
  execute 'set local role authenticated';
  begin
    perform public.creer_adhesion_benevole(v_demo, c_adherent, true, true, c_signature, false, current_date, null, null);
    r := r || '1.reglage_inactif=ACCEPTE(KO)';
  exception when insufficient_privilege then r := r || '1.reglage_inactif=refuse';
  end;
  begin
    perform public.verifier_doublon_adhesion_benevole(v_demo, 'X', 'Y', null);
    r := r || ' doublon_inactif=ACCEPTE(KO)';
  exception when insufficient_privilege then r := r || ' doublon_inactif=refuse';
  end;

  -- 2. Réglage actif : création OK (tactile), numéro + date de fin posés
  execute 'reset role';
  update public.organisations set saisie_adhesion_benevole = true where id = v_demo;
  execute 'set local role authenticated';
  v_res := public.creer_adhesion_benevole(v_demo, c_adherent, true, true, c_signature, false, current_date, 20, 1::smallint);
  r := r || ' | 2.cree=' || (v_res ->> 'id_externe' is not null and v_res ->> 'date_fin' is not null)
         || ' doublon=' || (v_res ->> 'doublon');

  -- Aucun droit direct : le bénévole ne lit ni l'adhérent créé ni la signature
  select count(*) into v_n from public.adherents where id = (v_res ->> 'adherent_id')::uuid;
  r := r || ' lecture_adherent=' || v_n;
  select count(*) into v_n from public.signatures_adhesion where adhesion_id = (v_res ->> 'adhesion_id')::uuid;
  r := r || ' lecture_signature=' || v_n;
  begin
    insert into public.adherents (organisation_id, nom) values (v_demo, 'INSERT-DIRECT');
    r := r || ' insert_direct=ACCEPTE(KO)';
  exception when insufficient_privilege then r := r || ' insert_direct=refuse';
  end;

  -- 3. Doublon détecté (même nom/prénom, casse ignorée ; même courriel)
  v_ok := public.verifier_doublon_adhesion_benevole(v_demo, 'test-benevole', 'ZOÉ', null);
  r := r || ' | 3.doublon_nom=' || v_ok;
  v_ok := public.verifier_doublon_adhesion_benevole(v_demo, 'AUTRE', 'Personne', 'ZOE.test-benevole@exemple.fr');
  r := r || ' doublon_email=' || v_ok;
  v_ok := public.verifier_doublon_adhesion_benevole(v_demo, 'INCONNU-XYZ', 'Personne', null);
  r := r || ' pas_doublon=' || (not v_ok);
  -- Papier : pas de signature, doublon signalé sans bloquer
  v_res := public.creer_adhesion_benevole(v_demo, c_adherent, true, true, null, true, current_date, null, null);
  r := r || ' papier_cree=' || (v_res ->> 'id_externe' is not null) || ' papier_doublon=' || (v_res ->> 'doublon');

  -- 4. Validation : ni signature ni papier, les deux, code postal, courriel, consentement
  begin
    perform public.creer_adhesion_benevole(v_demo, c_adherent, true, true, null, false, current_date, null, null);
    r := r || ' | 4.sans_signature=ACCEPTE(KO)';
  exception when invalid_parameter_value then r := r || ' | 4.sans_signature=refuse';
  end;
  begin
    perform public.creer_adhesion_benevole(v_demo, c_adherent, true, true, c_signature, true, current_date, null, null);
    r := r || ' deux_modes=ACCEPTE(KO)';
  exception when invalid_parameter_value then r := r || ' deux_modes=refuse';
  end;
  begin
    perform public.creer_adhesion_benevole(v_demo, c_adherent || '{"code_postal":"7500"}', true, true, null, true, current_date, null, null);
    r := r || ' cp=ACCEPTE(KO)';
  exception when invalid_parameter_value then r := r || ' cp=refuse';
  end;
  begin
    perform public.creer_adhesion_benevole(v_demo, c_adherent || '{"courriel":"pas-un-email"}', true, true, null, true, current_date, null, null);
    r := r || ' courriel=ACCEPTE(KO)';
  exception when invalid_parameter_value then r := r || ' courriel=refuse';
  end;
  begin
    perform public.creer_adhesion_benevole(v_demo, c_adherent, true, false, null, true, current_date, null, null);
    r := r || ' rgpd=ACCEPTE(KO)';
  exception when invalid_parameter_value then r := r || ' rgpd=refuse';
  end;

  -- 5. Bénévole d'une autre organisation : refusé
  perform set_config('request.jwt.claims', json_build_object('sub', v_benevole, 'role', 'authenticated',
    'app_metadata', json_build_object('role', 'benevole', 'organisation_id', v_autre_org))::text, true);
  begin
    perform public.creer_adhesion_benevole(v_demo, c_adherent, true, true, null, true, current_date, null, null);
    r := r || ' | 5.autre_org=ACCEPTE(KO)';
  exception when insufficient_privilege then r := r || ' | 5.autre_org=refuse';
  end;
  begin
    perform public.verifier_doublon_adhesion_benevole(v_demo, 'X', 'Y', null);
    r := r || ' doublon_autre_org=ACCEPTE(KO)';
  exception when insufficient_privilege then r := r || ' doublon_autre_org=refuse';
  end;

  -- 6. Vendeur de l'organisation : refusé
  perform set_config('request.jwt.claims', json_build_object('sub', gen_random_uuid(), 'role', 'authenticated',
    'app_metadata', json_build_object('role', 'vendeur', 'organisation_id', v_demo))::text, true);
  begin
    perform public.creer_adhesion_benevole(v_demo, c_adherent, true, true, null, true, current_date, null, null);
    r := r || ' | 6.vendeur=ACCEPTE(KO)';
  exception when insufficient_privilege then r := r || ' | 6.vendeur=refuse';
  end;

  -- 7. Anon : pas de droit d'exécution
  execute 'reset role';
  perform set_config('request.jwt.claims', json_build_object('role', 'anon')::text, true);
  execute 'set local role anon';
  begin
    perform public.creer_adhesion_benevole(v_demo, c_adherent, true, true, null, true, current_date, null, null);
    r := r || ' | 7.anon=ACCEPTE(KO)';
  exception when insufficient_privilege then r := r || ' | 7.anon=refuse';
  end;
  begin
    perform public.verifier_doublon_adhesion_benevole(v_demo, 'X', 'Y', null);
    r := r || ' doublon_anon=ACCEPTE(KO)';
  exception when insufficient_privilege then r := r || ' doublon_anon=refuse';
  end;
  begin
    perform public.attribuer_numero_adherent(v_demo);
    r := r || ' numero_anon=ACCEPTE(KO)';
  exception when insufficient_privilege then r := r || ' numero_anon=refuse';
  end;

  -- 8. Bénévole : helpers internes non exécutables directement
  execute 'reset role';
  perform set_config('request.jwt.claims', json_build_object('sub', v_benevole, 'role', 'authenticated',
    'app_metadata', json_build_object('role', 'benevole', 'organisation_id', v_demo))::text, true);
  execute 'set local role authenticated';
  begin
    perform public.attribuer_numero_adherent(v_demo);
    r := r || ' | 8.numero_benevole=ACCEPTE(KO)';
  exception when insufficient_privilege then r := r || ' | 8.numero_benevole=refuse';
  end;
  begin
    perform public.adherent_doublon_existe(v_demo, 'X', 'Y', null);
    r := r || ' doublon_interne=ACCEPTE(KO)';
  exception when insufficient_privilege then r := r || ' doublon_interne=refuse';
  end;

  -- 9. Admin de l'organisation, réglage inactif : autorisé (droit de création déjà acquis) et
  -- lit la signature
  execute 'reset role';
  update public.organisations set saisie_adhesion_benevole = false where id = v_demo;
  perform set_config('request.jwt.claims', json_build_object('sub', v_admin, 'role', 'authenticated', 'app_metadata', json_build_object())::text, true);
  execute 'set local role authenticated';
  v_res := public.creer_adhesion_benevole(v_demo, c_adherent || '{"nom":"TEST-ADMIN"}', true, true, c_signature, false, current_date, null, null);
  select count(*) into v_n from public.signatures_adhesion where adhesion_id = (v_res ->> 'adhesion_id')::uuid;
  r := r || ' | 9.admin_cree=' || (v_res ->> 'id_externe' is not null) || ' admin_lit_signature=' || v_n;
  select count(*) into v_n from public.journal_modifications
    where ligne_id = (v_res ->> 'adherent_id')::uuid and details ->> 'origine' = 'benevole' and details ->> 'signature' = 'tactile';
  r := r || ' journal=' || v_n;

  raise exception 'RESULTATS: %', r;
end;
$$;
