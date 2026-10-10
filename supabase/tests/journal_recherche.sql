-- Tests de la recherche du journal (journal_modifications_recherche.sql) — staging uniquement :
--   npx supabase db query --linked -f supabase/tests/journal_recherche.sql
-- Bloc terminé par une exception : rien n'est conservé. Dépend de l'org « Association Démo Staging ».
do $$
declare v_demo uuid; v_other uuid; v_admin uuid; r text := '';
begin
  select id into v_demo from public.organisations where nom = 'Association Démo Staging';
  select id into v_other from public.organisations where nom <> 'Association Démo Staging' limit 1;
  select utilisateur_id into v_admin from public.profils_organisation where organisation_id = v_demo and role = 'admin' limit 1;
  perform set_config('request.jwt.claims', json_build_object('sub', v_admin, 'role', 'authenticated', 'app_metadata', json_build_object())::text, true);
  execute 'set local role authenticated';
  r := r || 'tout=' || (select count(*) from public.list_journal_modifications(v_demo, 1000, 0));
  r := r || ' boulom=' || (select count(*) from public.list_journal_modifications(v_demo, 1000, 0, null, null, 'boulom'));
  r := r || ' BOULÔM=' || (select count(*) from public.list_journal_modifications(v_demo, 1000, 0, null, null, 'BOULÔM'));
  r := r || ' nicolas_boulom=' || (select count(*) from public.list_journal_modifications(v_demo, 1000, 0, null, null, 'nicolas boulom'));
  r := r || ' auteur=' || (select count(*) from public.list_journal_modifications(v_demo, 1000, 0, null, null, 'invitation'));
  r := r || ' 1car=' || (select count(*) from public.list_journal_modifications(v_demo, 1000, 0, null, null, 'b'));
  r := r || ' joker=' || (select count(*) from public.list_journal_modifications(v_demo, 1000, 0, null, null, '%%'));
  r := r || ' total_count_boulom=' || coalesce((select max(total_count) from public.list_journal_modifications(v_demo, 2, 0, null, null, 'boulom')),0);
  r := r || ' autre_org=' || (select count(*) from public.list_journal_modifications(v_other, 1000, 0, null, null, 'a'));
  execute 'reset role';
  perform set_config('request.jwt.claims', '', true);
  execute 'set local role anon';
  begin
    perform public.list_journal_modifications(v_demo, 10, 0);
    r := r || ' anon=ACCEPTE';
  exception when insufficient_privilege then r := r || ' anon=refuse'; end;
  execute 'reset role';
  raise exception 'RESULTATS:%', r;
end $$;
