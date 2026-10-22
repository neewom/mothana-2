-- Tests de definir_notification_demandes / get_org_admins (notification_demandes_reglages.sql)
-- — à rejouer sur staging uniquement :
--   npx supabase db query --linked -f supabase/tests/notification_demandes_reglages.sql
-- Tout se passe dans un bloc qui se termine par une exception : rien n'est conservé ; le
-- message RESULTATS: liste chaque cas. Dépend de l'org « Association Démo Staging » (un admin
-- et un contributeur non désactivés), d'un admin d'une autre organisation et d'un super-admin.
do $$
declare
  v_demo uuid; v_admin uuid; v_contrib uuid; v_admin_autre uuid; v_super uuid;
  r text := '';
begin
  select id into v_demo from public.organisations where nom = 'Association Démo Staging';
  select po.utilisateur_id into v_admin from public.profils_organisation po join auth.users au on au.id = po.utilisateur_id
    where po.organisation_id = v_demo and po.role = 'admin' and (au.banned_until is null or au.banned_until < now()) order by po.created_at desc limit 1;
  select po.utilisateur_id into v_contrib from public.profils_organisation po join auth.users au on au.id = po.utilisateur_id
    where po.organisation_id = v_demo and po.role = 'contributeur' and (au.banned_until is null or au.banned_until < now()) limit 1;
  select po.utilisateur_id into v_admin_autre from public.profils_organisation po
    where po.organisation_id <> v_demo and po.role = 'admin' limit 1;
  select id into v_super from auth.users where (raw_app_meta_data ->> 'is_super_admin')::boolean limit 1;

  execute 'set local role authenticated';

  -- 1. Le contributeur coupe son propre réglage
  perform set_config('request.jwt.claims', json_build_object('sub', v_contrib, 'role', 'authenticated', 'app_metadata', json_build_object())::text, true);
  perform public.definir_notification_demandes(v_contrib, v_demo, false);
  r := r || '1.soi_meme=' || (select notif_demandes_adhesion from public.profils_organisation where utilisateur_id = v_contrib and organisation_id = v_demo) || '(false)';

  -- 2. Le contributeur ne peut pas changer celui d'un autre compte
  begin
    perform public.definir_notification_demandes(v_admin, v_demo, false);
    r := r || ' | 2.contrib_autre=ACCEPTE(KO)';
  exception when insufficient_privilege then r := r || ' | 2.contrib_autre=refuse';
  end;

  -- 3. Un admin de l'organisation change celui du contributeur ; get_org_admins le renvoie
  perform set_config('request.jwt.claims', json_build_object('sub', v_admin, 'role', 'authenticated', 'app_metadata', json_build_object())::text, true);
  perform public.definir_notification_demandes(v_contrib, v_demo, true);
  r := r || ' | 3.admin=' || (select g.notif_demandes_adhesion from public.get_org_admins(v_demo) g where g.utilisateur_id = v_contrib) || '(true)';

  -- 4. Un admin d'une autre organisation est refusé
  perform set_config('request.jwt.claims', json_build_object('sub', v_admin_autre, 'role', 'authenticated', 'app_metadata', json_build_object())::text, true);
  begin
    perform public.definir_notification_demandes(v_contrib, v_demo, false);
    r := r || ' | 4.admin_autre_org=ACCEPTE(KO)';
  exception when insufficient_privilege then r := r || ' | 4.admin_autre_org=refuse';
  end;

  -- 5. Super-admin (mode Consulter)
  perform set_config('request.jwt.claims', json_build_object('sub', v_super, 'role', 'authenticated', 'app_metadata', json_build_object('is_super_admin', true))::text, true);
  perform public.definir_notification_demandes(v_admin, v_demo, false);
  r := r || ' | 5.super_admin=' || (select notif_demandes_adhesion from public.profils_organisation where utilisateur_id = v_admin and organisation_id = v_demo) || '(false)';

  -- 6. Le rôle n'a pas bougé
  r := r || ' | 6.roles=' || (select string_agg(role, ',' order by role) from public.profils_organisation where utilisateur_id in (v_admin, v_contrib) and organisation_id = v_demo) || '(admin,contributeur)';

  -- 7. Anonyme : pas d'accès
  execute 'reset role';
  execute 'set local role anon';
  begin
    perform public.definir_notification_demandes(v_contrib, v_demo, false);
    r := r || ' | 7.anon=ACCEPTE(KO)';
  exception when insufficient_privilege then r := r || ' | 7.anon=refuse';
  end;

  raise exception 'RESULTATS: %', r;
end;
$$;
