-- Tests de l'état « à renouveler » de search_adherents (search_adherents_a_renouveler.sql) —
-- staging uniquement :
--   npx supabase db query --linked -f supabase/tests/search_adherents_a_renouveler.sql
-- Bloc terminé par une exception : rien n'est conservé (adhérents de test créés puis annulés).
-- Dépend de l'org « Association Démo Staging » (un admin, le compte bénévole). Les adhérents de
-- test portent une liste propre au test (p_tag) pour ne pas dépendre des données existantes.
do $$
declare
  v_demo uuid; v_admin uuid; v_benevole uuid;
  v_tag text := 'zz-test-renouv-' || substr(md5(random()::text), 1, 8);
  v_a uuid := gen_random_uuid(); v_b uuid := gen_random_uuid(); v_c uuid := gen_random_uuid();
  v_d uuid := gen_random_uuid(); v_e uuid := gen_random_uuid(); v_f uuid := gen_random_uuid();
  v_g uuid := gen_random_uuid(); v_h uuid := gen_random_uuid(); v_i uuid := gen_random_uuid();
  r text := ''; got text;
begin
  select id into v_demo from public.organisations where nom = 'Association Démo Staging';
  select po.utilisateur_id into v_admin from public.profils_organisation po
    where po.organisation_id = v_demo and po.role = 'admin' order by po.created_at desc limit 1;
  select id into v_benevole from auth.users where email = 'benevole-' || v_demo || '@mothana.internal';

  -- Jeu de test (dernière adhésion) :
  --   A fin dans 31 j → à jour ; B fin dans 30 j → à renouveler ; C fin aujourd'hui → à renouveler ;
  --   D fin hier → expiré ; E sans date de fin → à jour ; F aucune adhésion → expiré ;
  --   G ancienne adhésion qui finit dans 10 j mais déjà renouvelé (fin dans 1 an) → à jour ;
  --   H archivé (fin dans 10 j) → archivé seulement ; I fin dans 10 j → à renouveler.
  insert into public.adherents (id, organisation_id, nom, prenom, statut, tags) values
    (v_a, v_demo, 'ZRen A', 'Alpha', 'actif', array[v_tag]),
    (v_b, v_demo, 'ZRen B', 'Bravo', 'actif', array[v_tag]),
    (v_c, v_demo, 'ZRen C', 'Charlie', 'actif', array[v_tag]),
    (v_d, v_demo, 'ZRen D', 'Delta', 'actif', array[v_tag]),
    (v_e, v_demo, 'ZRen E', 'Echo', 'actif', array[v_tag]),
    (v_f, v_demo, 'ZRen F', 'Foxtrot', 'actif', array[v_tag]),
    (v_g, v_demo, 'ZRen G', 'Golf', 'actif', array[v_tag]),
    (v_h, v_demo, 'ZRen H', 'Hotel', 'archive', array[v_tag]),
    (v_i, v_demo, 'ZRen I', 'India', 'actif', array[v_tag]);
  insert into public.adhesions (adherent_id, date_debut) values
    (v_a, current_date - 300), (v_b, current_date - 301), (v_c, current_date - 302),
    (v_d, current_date - 303), (v_e, current_date - 304), (v_g, current_date - 305),
    (v_g, current_date - 5), (v_h, current_date - 306), (v_i, current_date - 307);
  -- Le trigger trg_adhesions_poser_date_fin recalcule date_fin à l'insertion : on repose les dates
  -- de fin voulues (mise à jour de date_fin seule, hors trigger).
  update public.adhesions h set date_fin = v.fin
    from (values (v_a, current_date - 300, current_date + 31), (v_b, current_date - 301, current_date + 30),
                 (v_c, current_date - 302, current_date), (v_d, current_date - 303, current_date - 1),
                 (v_e, current_date - 304, null::date), (v_g, current_date - 305, current_date + 10),
                 (v_g, current_date - 5, current_date + 360), (v_h, current_date - 306, current_date + 10),
                 (v_i, current_date - 307, current_date + 10)) as v(adherent, debut, fin)
    where h.adherent_id = v.adherent and h.date_debut = v.debut;

  -- Session admin de l'organisation (RLS appliquée : security invoker)
  perform set_config('request.jwt.claims', json_build_object('sub', v_admin, 'role', 'authenticated', 'app_metadata', json_build_object())::text, true);
  execute 'set local role authenticated';

  select string_agg(right(x.nom, 1), ',' order by x.nom) into got
    from public.search_adherents(v_demo, p_tag => v_tag, p_statut => 'a_jour') x;
  r := r || '1.a_jour=' || coalesce(got, '') || case when got = 'A,E,G' then ' OK' else ' KO' end;

  select string_agg(right(x.nom, 1), ',' order by x.nom) into got
    from public.search_adherents(v_demo, p_tag => v_tag, p_statut => 'a_renouveler') x;
  r := r || ' | 2.a_renouveler=' || coalesce(got, '') || case when got = 'B,C,I' then ' OK' else ' KO' end;

  select string_agg(right(x.nom, 1), ',' order by x.nom) into got
    from public.search_adherents(v_demo, p_tag => v_tag, p_statut => 'expire') x;
  r := r || ' | 3.expire=' || coalesce(got, '') || case when got = 'D,F' then ' OK' else ' KO' end;

  select string_agg(right(x.nom, 1), ',' order by x.nom) into got
    from public.search_adherents(v_demo, p_tag => v_tag, p_statut => 'archive') x;
  r := r || ' | 4.archive=' || coalesce(got, '') || case when got = 'H' then ' OK' else ' KO' end;

  -- 5. Les trois états couvrent exactement les non-archivés (statut 'actif')
  select string_agg(right(x.nom, 1), ',' order by x.nom) into got
    from public.search_adherents(v_demo, p_tag => v_tag, p_statut => 'actif') x;
  r := r || ' | 5.actif=' || coalesce(got, '') || case when got = 'A,B,C,D,E,F,G,I' then ' OK' else ' KO' end;

  -- 6. total_count et tri par date de fin dans l'état à renouveler (bloc de l'accueil)
  select string_agg(right(x.nom, 1) || '/' || x.total_count, ',' order by x.ordinality) into got
    from public.search_adherents(v_demo, p_tag => v_tag, p_statut => 'a_renouveler', p_limit => 2, p_tri => 'date_fin') with ordinality x;
  r := r || ' | 6.tri_date_fin=' || coalesce(got, '') || case when got = 'C/3,I/3' then ' OK' else ' KO' end;

  -- 7. Session bénévole : aucune ligne (RLS adherents)
  perform set_config('request.jwt.claims', json_build_object('sub', v_benevole, 'role', 'authenticated',
    'app_metadata', json_build_object('role', 'benevole', 'organisation_id', v_demo))::text, true);
  select count(*)::text into got from public.search_adherents(v_demo, p_statut => 'a_renouveler');
  r := r || ' | 7.benevole_lignes=' || got || case when got = '0' then ' OK' else ' KO' end;

  execute 'reset role';
  raise exception 'RESULTATS: %', r;
end;
$$;
