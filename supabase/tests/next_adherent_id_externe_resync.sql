-- Tests de la numérotation des adhérents (adherent_id_externe_resync_verrou.sql)
-- — staging uniquement :
--   npx supabase db query --linked -f supabase/tests/next_adherent_id_externe_resync.sql
-- Bloc terminé par une exception : rien n'est conservé. Les appels portent sur une
-- organisation de test créée dans la transaction, avec son propre compte admin : sa
-- séquence (create sequence, transactionnel) disparaît au rollback, et la séquence des
-- organisations existantes n'est jamais touchée (les appels refusés échouent sur la garde,
-- avant toute lecture de séquence). Dépend de l'org « Association Démo Staging » (compte
-- bénévole existant, un admin).
do $$
declare
  v_demo uuid; v_benevole uuid; v_admin_demo uuid;
  v_org uuid := gen_random_uuid();
  v_admin uuid := gen_random_uuid();
  v_seq text;
  n1 text; n2 text; n3 text; n4 text; n5 text; n6 text; n7 text;
  r text := '';
begin
  select id into v_demo from public.organisations where nom = 'Association Démo Staging';
  select id into v_benevole from auth.users where email = 'benevole-' || v_demo || '@mothana.internal';
  select po.utilisateur_id into v_admin_demo from public.profils_organisation po
    where po.organisation_id = v_demo and po.role = 'admin' order by po.created_at desc limit 1;
  v_seq := 'adherent_id_externe_seq_' || replace(v_org::text, '-', '_');

  insert into public.organisations (id, nom, slug)
    values (v_org, 'Test numérotation adhérents', 'test-resync-' || replace(v_org::text, '-', ''));
  insert into auth.users (id, email) values (v_admin, 'test-resync-' || v_admin || '@mothana.internal');
  insert into public.profils_organisation (utilisateur_id, organisation_id, role) values (v_admin, v_org, 'admin');

  -- 1. Admin de l'organisation, aucun adhérent, pas de séquence → 1 (séquence créée)
  perform set_config('request.jwt.claims', json_build_object('sub', v_admin, 'role', 'authenticated',
    'app_metadata', json_build_object())::text, true);
  execute 'set local role authenticated';
  n1 := public.next_adherent_id_externe(v_org);
  execute 'reset role';
  r := r || '1.premier=' || n1 || ' seq=' || exists (
    select 1 from pg_sequences where schemaname = 'public' and sequencename = v_seq);

  -- 2. Adhérent importé avec un numéro supérieur à la séquence → l'appel suivant le dépasse
  --    (avant correctif : la séquence existante n'était pas recalée → 2, puis collision à 500)
  insert into public.adherents (organisation_id, nom, id_externe) values (v_org, 'Test import', '500');
  insert into public.adherents (organisation_id, nom, id_externe) values (v_org, 'Test import', 'IMP-9000');
  execute 'set local role authenticated';
  n2 := public.next_adherent_id_externe(v_org);
  execute 'reset role';
  r := r || ' | 2.resync=' || n2;

  -- 3. Numéro au-delà de 2^31 → bigint, sans erreur de cast
  insert into public.adherents (organisation_id, nom, id_externe) values (v_org, 'Test import', '9999999999');
  execute 'set local role authenticated';
  n3 := public.next_adherent_id_externe(v_org);
  execute 'reset role';
  r := r || ' | 3.bigint=' || n3;

  -- 4. Jamais de recul : le grand numéro disparaît, la séquence ne redescend pas
  delete from public.adherents where organisation_id = v_org and id_externe = '9999999999';
  execute 'set local role authenticated';
  n4 := public.next_adherent_id_externe(v_org);
  execute 'reset role';
  r := r || ' | 4.sans_recul=' || n4;

  -- 5. attribuer_numero_adherent (adhésion bénévole) : même séquence, resynchronisée
  insert into public.adherents (organisation_id, nom, id_externe) values (v_org, 'Test import', '20000000000');
  n5 := public.attribuer_numero_adherent(v_org);
  r := r || ' | 5.attribuer=' || n5;
  -- puis la RPC continue après
  perform set_config('request.jwt.claims', json_build_object('sub', v_admin_demo, 'role', 'authenticated',
    'app_metadata', json_build_object('is_super_admin', true))::text, true);
  execute 'set local role authenticated';
  n6 := public.next_adherent_id_externe(v_org);
  execute 'reset role';
  r := r || ' | 6.super_admin_suite=' || n6;

  -- 7. Verrou consultatif (clé = nom de la séquence) tenu jusqu'à la fin de la transaction
  r := r || ' | 7.verrou=' || exists (
    select 1 from pg_locks
    where locktype = 'advisory' and pid = pg_backend_pid() and granted
      and ((classid::bigint << 32) | objid::bigint) = hashtext(v_seq)::bigint
  );

  -- 8. Session bénévole : refusée (sur l'organisation de test et sur la sienne)
  perform set_config('request.jwt.claims', json_build_object('sub', v_benevole, 'role', 'authenticated',
    'app_metadata', json_build_object('role', 'benevole', 'organisation_id', v_demo))::text, true);
  execute 'set local role authenticated';
  begin
    perform public.next_adherent_id_externe(v_org);
    r := r || ' | 8.benevole=ACCEPTE(KO)';
  exception when insufficient_privilege then r := r || ' | 8.benevole=refuse';
  end;
  begin
    perform public.next_adherent_id_externe(v_demo);
    r := r || ' propre_org=ACCEPTE(KO)';
  exception when insufficient_privilege then r := r || ' propre_org=refuse';
  end;
  -- La fonction interne n'est pas exécutable par un compte authentifié
  begin
    perform public.attribuer_numero_adherent(v_org);
    r := r || ' interne=ACCEPTE(KO)';
  exception when insufficient_privilege then r := r || ' interne=refuse';
  end;
  execute 'reset role';

  -- 9. Admin d'une autre organisation (admin démo, sans claim super-admin) : refusé
  perform set_config('request.jwt.claims', json_build_object('sub', v_admin_demo, 'role', 'authenticated',
    'app_metadata', json_build_object())::text, true);
  execute 'set local role authenticated';
  begin
    perform public.next_adherent_id_externe(v_org);
    r := r || ' | 9.autre_org=ACCEPTE(KO)';
  exception when insufficient_privilege then r := r || ' | 9.autre_org=refuse';
  end;
  begin
    perform public.attribuer_numero_adherent(v_org);
    r := r || ' interne=ACCEPTE(KO)';
  exception when insufficient_privilege then r := r || ' interne=refuse';
  end;
  execute 'reset role';

  -- 10. Session sans utilisateur : refusée
  perform set_config('request.jwt.claims', json_build_object('role', 'anon')::text, true);
  begin
    perform public.next_adherent_id_externe(v_org);
    r := r || ' | 10.sans_uid=ACCEPTE(KO)';
  exception when insufficient_privilege then r := r || ' | 10.sans_uid=refuse';
  end;

  -- 11. Droits : authenticated/service_role sur la RPC, pas anon ; interne : service_role seul
  r := r || ' | 11.droits rpc auth=' || has_function_privilege('authenticated', 'public.next_adherent_id_externe(uuid)', 'execute')
    || ' anon=' || has_function_privilege('anon', 'public.next_adherent_id_externe(uuid)', 'execute')
    || ' service=' || has_function_privilege('service_role', 'public.next_adherent_id_externe(uuid)', 'execute')
    || ' / interne auth=' || has_function_privilege('authenticated', 'public.attribuer_numero_adherent(uuid)', 'execute')
    || ' anon=' || has_function_privilege('anon', 'public.attribuer_numero_adherent(uuid)', 'execute')
    || ' service=' || has_function_privilege('service_role', 'public.attribuer_numero_adherent(uuid)', 'execute');

  raise exception 'RESULTATS: %', r;
end;
$$;
