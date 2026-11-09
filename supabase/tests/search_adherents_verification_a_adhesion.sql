-- Tests de search_adherents_verification_a_adhesion.sql — à rejouer sur staging uniquement :
--   npx supabase db query --linked -f supabase/tests/search_adherents_verification_a_adhesion.sql
-- Bloc terminé par une exception : rien n'est conservé ; le message RESULTATS: liste chaque cas.
-- Dépend de l'org « Association Démo Staging » (et de son compte bénévole) et d'une autre org.
do $$
declare
  v_demo uuid; v_autre uuid; v_benevole uuid;
  v_sans uuid := gen_random_uuid(); v_sans_fin uuid := gen_random_uuid(); v_expire uuid := gen_random_uuid();
  r text := '';
begin
  select id into v_demo from public.organisations where nom = 'Association Démo Staging';
  select id into v_autre from public.organisations where id <> v_demo limit 1;
  select id into v_benevole from auth.users where email = 'benevole-' || v_demo || '@mothana.internal';

  insert into public.adherents (id, organisation_id, nom, prenom) values
    (v_sans, v_demo, 'ZZVERIFTEST', 'Sans'),
    (v_sans_fin, v_demo, 'ZZVERIFTEST', 'SansFin'),
    (v_expire, v_demo, 'ZZVERIFTEST', 'Expire');
  insert into public.adhesions (adherent_id, date_debut, date_fin) values
    (v_sans_fin, current_date - 400, current_date - 35),
    (v_sans_fin, current_date - 30, null),
    (v_expire, current_date - 400, current_date - 35);
  -- Le trigger calcule date_fin à l'insertion : on la vide après coup (adhésions historiques sans fin).
  update public.adhesions set date_fin = null where adherent_id = v_sans_fin and date_debut = current_date - 30;

  -- Session bénévole de l'org démo
  perform set_config('request.jwt.claims', json_build_object('sub', v_benevole, 'role', 'authenticated',
    'app_metadata', json_build_object('role', 'benevole', 'organisation_id', v_demo))::text, true);
  execute 'set local role authenticated';

  r := r || 'sans_adhesion=' || (select a_adhesion::text || '/' || coalesce(date_fin::text, 'null')
      from public.search_adherents_verification(v_demo, 'ZZVERIFTEST Sans') where prenom = 'Sans')
    || ' sans_date_fin=' || (select a_adhesion::text || '/' || coalesce(date_fin::text, 'null')
      from public.search_adherents_verification(v_demo, 'ZZVERIFTEST SansFin'))
    || ' expire=' || (select a_adhesion::text || '/' || (date_fin < current_date)::text
      from public.search_adherents_verification(v_demo, 'ZZVERIFTEST Expire'))
    || ' | benevole_autre_org=' || (select count(*) from public.search_adherents_verification(v_autre, 'a'));

  -- Session sans organisation : aucune ligne
  perform set_config('request.jwt.claims', json_build_object('sub', gen_random_uuid(), 'role', 'authenticated',
    'app_metadata', json_build_object())::text, true);
  r := r || ' sans_org=' || (select count(*) from public.search_adherents_verification(v_demo, 'ZZVERIFTEST'));

  execute 'reset role';
  raise exception 'RESULTATS: % (attendu : sans_adhesion=false/null sans_date_fin=true/null expire=true/true | benevole_autre_org=0 sans_org=0)', r;
end $$;
