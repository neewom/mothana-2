-- Tests de l'attribution automatique du numéro de donateur (participant_id_externe_auto.sql)
-- — staging uniquement :
--   npx supabase db query --linked -f supabase/tests/participant_id_externe_auto.sql
-- Bloc terminé par une exception : aucune ligne n'est conservée (seuls des numéros de
-- séquence sont consommés, sans effet : la séquence se resynchronise sur le max à chaque
-- appel). Dépend de l'org « Association Démo Staging » et de son compte bénévole.
do $$
declare
  v_demo uuid; v_benevole uuid; v_admin uuid;
  v_seq text;
  v_max bigint;
  p1 uuid := gen_random_uuid(); p2 uuid := gen_random_uuid(); p3 uuid := gen_random_uuid();
  p4 uuid := gen_random_uuid(); p5 uuid := gen_random_uuid(); p6 uuid := gen_random_uuid();
  pr1 uuid := gen_random_uuid(); pr2 uuid := gen_random_uuid(); pr3 uuid := gen_random_uuid();
  pr4 uuid := gen_random_uuid(); pr5 uuid := gen_random_uuid(); pr6 uuid := gen_random_uuid();
  n1 text; n2 text; n3 text; n4 text; n5 text; n6 text;
  pa1 uuid := gen_random_uuid(); pa2 uuid := gen_random_uuid();
  pra1 uuid := gen_random_uuid(); pra2 uuid := gen_random_uuid();
  v_prochain text; v_res jsonb; na1 text; na2 text;
  r text := '';
begin
  select id into v_demo from public.organisations where nom = 'Association Démo Staging';
  select id into v_benevole from auth.users where email = 'benevole-' || v_demo || '@mothana.internal';
  select po.utilisateur_id into v_admin from public.profils_organisation po
    where po.organisation_id = v_demo and po.role = 'admin' order by po.created_at desc limit 1;
  v_seq := 'public.participant_id_externe_seq_' || replace(v_demo::text, '-', '_');

  insert into public.personnes (id, nom, prenom)
  select x, 'Test numéro', 'Auto' from unnest(array[p1, p2, p3, p4, p5, p6]) as x;

  -- 0. Aucun donateur sans numéro après le rattrapage
  r := r || '0.sans_numero=' || (select count(*) from public.profils_participant
    where nullif(btrim(id_externe), '') is null);

  -- 1. Insert sans numéro → numéro attribué ; id_externe '' traité comme absent
  insert into public.profils_participant (id, personne_id, organisation_id) values (pr1, p1, v_demo);
  insert into public.profils_participant (id, personne_id, organisation_id, id_externe) values (pr2, p2, v_demo, '');
  select id_externe into n1 from public.profils_participant where id = pr1;
  select id_externe into n2 from public.profils_participant where id = pr2;
  r := r || ' | 1.attribue=' || coalesce(n1, 'NULL') || ',' || coalesce(n2, 'NULL');
  -- 3. Deux inserts → distincts et croissants
  r := r || ' | 3.croissants=' || (n1 ~ '^[0-9]+$' and n2 ~ '^[0-9]+$' and n2::bigint > n1::bigint);

  -- 2. Insert avec numéro explicite → inchangé
  insert into public.profils_participant (id, personne_id, organisation_id, id_externe) values (pr3, p3, v_demo, 'IMPORT-X1');
  select id_externe into n3 from public.profils_participant where id = pr3;
  r := r || ' | 2.explicite=' || n3;

  -- 5. Séquence en retard sur le max → pas de collision (max + 1)
  select max(id_externe::bigint) into v_max from public.profils_participant
    where organisation_id = v_demo and id_externe ~ '^[0-9]{1,18}$';
  perform setval(v_seq, 1);
  insert into public.profils_participant (id, personne_id, organisation_id) values (pr5, p5, v_demo);
  select id_externe into n5 from public.profils_participant where id = pr5;
  r := r || ' | 5.retard=' || (n5::bigint = v_max + 1);

  -- 6. Upsert d'import sans numéro sur un donateur numéroté → numéro conservé
  insert into public.profils_participant (id, personne_id, organisation_id, id_externe)
    values (pr1, p1, v_demo, null)
  on conflict (id) do update set id_externe = excluded.id_externe;
  r := r || ' | 6.upsert_conserve=' || ((select id_externe from public.profils_participant where id = pr1) = n1);

  -- 4. Session bénévole (chemin BenevolePage : insert direct) → numéro attribué
  perform set_config('request.jwt.claims', json_build_object('sub', v_benevole, 'role', 'authenticated',
    'app_metadata', json_build_object('role', 'benevole', 'organisation_id', v_demo))::text, true);
  execute 'set local role authenticated';
  insert into public.profils_participant (id, personne_id, organisation_id) values (pr4, p4, v_demo);
  -- La fonction interne n'est pas exécutable par un compte authentifié
  begin
    perform public.attribuer_participant_id_externe(v_demo);
    r := r || ' | 7.interne_benevole=ACCEPTE(KO)';
  exception when insufficient_privilege then r := r || ' | 7.interne_benevole=refuse';
  end;
  -- La RPC admin reste refusée au bénévole
  begin
    perform public.next_participant_id_externe(v_demo);
    r := r || ' rpc_benevole=ACCEPTE(KO)';
  exception when insufficient_privilege then r := r || ' rpc_benevole=refuse';
  end;
  execute 'reset role';
  select id_externe into n4 from public.profils_participant where id = pr4;
  r := r || ' | 4.benevole=' || coalesce(n4, 'NULL') || ' ' || (n4::bigint > n5::bigint);

  -- 8. Admin : la RPC continue la même séquence, sans collision avec le trigger
  perform set_config('request.jwt.claims', json_build_object('sub', v_admin, 'role', 'authenticated',
    'app_metadata', json_build_object())::text, true);
  n6 := public.next_participant_id_externe(v_demo);
  r := r || ' | 8.rpc_suite=' || (n6::bigint > n4::bigint);

  -- A. Import (session admin) : ligne sans numéro AVANT une ligne portant le
  -- prochain numéro, dans le même appel → les deux créées, numéros distincts
  -- (avant correctif : duplicate key sur profils_participant_organisation_id_externe_unique)
  v_prochain := (n6::bigint + 1)::text;
  execute 'set local role authenticated';
  v_res := public.import_upsert_participants(jsonb_build_array(
    jsonb_build_object('personne_id', pa1, 'profil_id', pra1, 'id_externe', null, 'nom', 'Test import', 'prenom', 'Sans numéro'),
    jsonb_build_object('personne_id', pa2, 'profil_id', pra2, 'id_externe', v_prochain, 'nom', 'Test import', 'prenom', 'Numéroté')
  ), v_demo);
  execute 'reset role';
  select id_externe into na1 from public.profils_participant where id = pra1;
  select id_externe into na2 from public.profils_participant where id = pra2;
  r := r || ' | A.import=' || (v_res->>'created') || ' crees, ' || coalesce(na1, 'NULL') || '/' || coalesce(na2, 'NULL')
    || ' ' || (na2 = v_prochain and na1 is not null and na1 <> na2);

  -- B. Verrou consultatif pris par l'attribution (le même que la RPC, cf. 8) :
  -- tenu jusqu'à la fin de la transaction
  r := r || ' | B.verrou=' || exists (
    select 1 from pg_locks
    where locktype = 'advisory' and pid = pg_backend_pid() and granted
      and ((classid::bigint << 32) | objid::bigint) = hashtext(replace(v_seq, 'public.', ''))::bigint
  );

  raise exception 'RESULTATS: %', r;
end;
$$;
