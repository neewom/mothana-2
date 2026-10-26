-- Tests des gardes NULL des RPC de recalage (gardes_null_rpc.sql) — staging uniquement :
--   npx supabase db query --linked -f supabase/tests/gardes_null_rpc.sql
-- Bloc terminé par une exception : rien n'est conservé. Dépend de l'org « Association Démo
-- Staging » (compte bénévole existant, un admin).
do $$
declare v_demo uuid; v_benevole uuid; v_admin uuid; r text := '';
begin
  select id into v_demo from public.organisations where nom = 'Association Démo Staging';
  select id into v_benevole from auth.users where email = 'benevole-' || v_demo || '@mothana.internal';
  select po.utilisateur_id into v_admin from public.profils_organisation po
    where po.organisation_id = v_demo and po.role = 'admin' order by po.created_at desc limit 1;

  -- 1. Session bénévole (aucun profil d'organisation) : refusée
  perform set_config('request.jwt.claims', json_build_object('sub', v_benevole, 'role', 'authenticated',
    'app_metadata', json_build_object('role', 'benevole', 'organisation_id', v_demo))::text, true);
  execute 'set local role authenticated';
  begin
    perform public.apercu_recalage_adhesions(v_demo);
    r := r || '1.benevole_apercu=ACCEPTE(KO)';
  exception when insufficient_privilege then r := r || '1.benevole_apercu=refuse';
  end;
  begin
    perform public.recalculer_dates_fin_adhesions(v_demo);
    r := r || ' benevole_recalcul=ACCEPTE(KO)';
  exception when insufficient_privilege then r := r || ' benevole_recalcul=refuse';
  end;

  -- 2. Admin de l'organisation : toujours autorisé
  perform set_config('request.jwt.claims', json_build_object('sub', v_admin, 'role', 'authenticated', 'app_metadata', json_build_object())::text, true);
  r := r || ' | 2.admin_apercu=' || (public.apercu_recalage_adhesions(v_demo) ? 'total');

  raise exception 'RESULTATS: %', r;
end;
$$;
