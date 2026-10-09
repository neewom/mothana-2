-- Tests de la RPC rechercher_global (recherche_globale.sql) — à rejouer sur staging uniquement :
--   npx supabase db query --linked -f supabase/tests/recherche_globale.sql
-- Tout se passe dans un bloc qui se termine par une exception : rien n'est conservé ; le
-- message RESULTATS: liste chaque cas. Dépend des données de l'org « Association Démo Staging ».
do $$
declare
  v_demo uuid; v_other uuid; v_admin uuid; v_benevole uuid; v_other_nom text; v_anon_code text;
  v_res jsonb; r text := '';
begin
  select id into v_demo from public.organisations where nom = 'Association Démo Staging';
  select id into v_other from public.organisations where nom = 'Les super heros';
  select utilisateur_id into v_admin from public.profils_organisation where organisation_id = v_demo and role = 'admin' limit 1;
  select id into v_benevole from auth.users where email = 'benevole-' || v_demo || '@mothana.internal';
  select p.nom into v_other_nom from public.profils_participant pp join public.personnes p on p.id = pp.personne_id
    where pp.organisation_id = v_other and not exists (
      select 1 from public.profils_participant pp2 join public.personnes p2 on p2.id = pp2.personne_id
      where pp2.organisation_id = v_demo and lower(p2.nom) = lower(p.nom)) limit 1;
  select code_public into v_anon_code from public.portefeuilles where organisation_id = v_demo and anonymise_le is not null limit 1;

  -- Admin de l'org démo
  perform set_config('request.jwt.claims', json_build_object('sub', v_admin, 'role', 'authenticated', 'app_metadata', json_build_object())::text, true);
  execute 'set local role authenticated';
  v_res := public.rechercher_global('boul');
  r := r || ' 1.boul=' || (select string_agg(coalesce(e->>'prenom','') || ' ' || (e->>'nom') || ' [' ||
      case when e->>'participant_id' is not null and e->>'adherent_id' is not null then 'D+A' when e->>'participant_id' is not null then 'D' else 'A' end || ']', ', ')
      from jsonb_array_elements(v_res->'personnes') e);
  v_res := public.rechercher_global(v_other_nom);
  r := r || ' | 2.autre_org(' || v_other_nom || ')=' || jsonb_array_length(v_res->'personnes');
  v_res := public.rechercher_global(v_other_nom, v_other);
  r := r || ' avec_p_org=' || jsonb_array_length(v_res->'personnes');
  v_res := public.rechercher_global('anonyme.invalid');
  r := r || ' | 3.anonymise_par_email=' || jsonb_array_length(v_res->'portefeuilles');
  v_res := public.rechercher_global(left(v_anon_code, 8));
  r := r || ' par_code=' || jsonb_array_length(v_res->'portefeuilles') || ' email_renvoye=' || coalesce((v_res->'portefeuilles'->0->>'email'), 'null');
  r := r || ' | court=' || jsonb_array_length(public.rechercher_global('b')->'personnes');
  r := r || ' jokers=' || jsonb_array_length(public.rechercher_global('%%')->'personnes');

  -- Module adhérents désactivé (transaction annulée)
  execute 'reset role';
  perform set_config('request.jwt.claims', '', true);
  update public.organisations set fonctionnalites_activees = fonctionnalites_activees || '{"adherents": false}' where id = v_demo;
  perform set_config('request.jwt.claims', json_build_object('sub', v_admin, 'role', 'authenticated', 'app_metadata', json_build_object())::text, true);
  execute 'set local role authenticated';
  v_res := public.rechercher_global('boul');
  r := r || ' | 4.sans_adherents: lignes=' || jsonb_array_length(v_res->'personnes') || ' avec_adherent=' ||
    (select count(*) from jsonb_array_elements(v_res->'personnes') e where e->>'adherent_id' is not null);
  execute 'reset role';
  perform set_config('request.jwt.claims', '', true);
  update public.organisations set fonctionnalites_activees = fonctionnalites_activees || '{"adherents": true, "evenements": false}' where id = v_demo;
  perform set_config('request.jwt.claims', json_build_object('sub', v_admin, 'role', 'authenticated', 'app_metadata', json_build_object())::text, true);
  execute 'set local role authenticated';
  r := r || ' sans_evenements: portefeuilles=' || jsonb_array_length(public.rechercher_global(left(v_anon_code, 8))->'portefeuilles');

  -- Bénévole
  execute 'reset role';
  perform set_config('request.jwt.claims', json_build_object('sub', v_benevole, 'role', 'authenticated', 'app_metadata', json_build_object('role','benevole','organisation_id', v_demo))::text, true);
  execute 'set local role authenticated';
  r := r || ' | 5.benevole(' || coalesce(v_benevole::text,'absent') || ')=' || jsonb_array_length(public.rechercher_global('boul')->'personnes');

  -- Fusion sur email identique (noms différents) puis vrais homonymes (transaction annulée)
  execute 'reset role';
  perform set_config('request.jwt.claims', '', true);
  declare v_pers uuid := gen_random_uuid(); v_pers2 uuid := gen_random_uuid();
  begin
    insert into public.personnes(id, nom, prenom, email) values (v_pers, 'Zedtest', 'Alpha', 'zz-search@example.test');
    insert into public.profils_participant(id, personne_id, organisation_id) values (gen_random_uuid(), v_pers, v_demo);
    insert into public.adherents(organisation_id, nom, prenom, courriel, code_postal, ville)
      values (v_demo, 'Zedtest-Autre', 'Beta', 'ZZ-search@example.test', '75000', 'Paris');
    insert into public.personnes(id, nom, prenom) values (v_pers2, 'Boulom', 'Nicolas');
    insert into public.profils_participant(id, personne_id, organisation_id) values (gen_random_uuid(), v_pers2, v_demo);
  end;
  perform set_config('request.jwt.claims', json_build_object('sub', v_admin, 'role', 'authenticated', 'app_metadata', json_build_object())::text, true);
  execute 'set local role authenticated';
  v_res := public.rechercher_global('zedtest');
  r := r || ' | 7.email_identique=' || (select string_agg(case when e->>'participant_id' is not null and e->>'adherent_id' is not null then 'D+A' when e->>'participant_id' is not null then 'D' else 'A' end, ',') from jsonb_array_elements(v_res->'personnes') e);
  v_res := public.rechercher_global('boul');
  r := r || ' | 8.homonymes=' || (select string_agg(case when e->>'participant_id' is not null and e->>'adherent_id' is not null then 'D+A' when e->>'participant_id' is not null then 'D' else 'A' end, ',') from jsonb_array_elements(v_res->'personnes') e);

  -- Super-admin
  execute 'reset role';
  perform set_config('request.jwt.claims', json_build_object('sub', gen_random_uuid(), 'role', 'authenticated', 'app_metadata', json_build_object('is_super_admin', true))::text, true);
  execute 'set local role authenticated';
  r := r || ' | 6.superadmin_sans_org=' || jsonb_array_length(public.rechercher_global('boul')->'personnes')
        || ' org_consultee=' || jsonb_array_length(public.rechercher_global('boul', v_demo)->'personnes');
  execute 'reset role';
  raise exception 'RESULTATS:%', r;
end;
$$;
