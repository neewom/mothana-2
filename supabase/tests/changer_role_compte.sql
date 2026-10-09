-- Tests de changer_role_compte / est_dernier_admin_actif (changer_role_compte.sql) — à rejouer
-- sur staging uniquement :
--   npx supabase db query --linked -f supabase/tests/changer_role_compte.sql
-- Tout se passe dans un bloc qui se termine par une exception : rien n'est conservé ; le
-- message RESULTATS: liste chaque cas. Dépend de l'org « Association Démo Staging » (au moins
-- deux admins actifs et un contributeur actif).
do $$
declare
  v_demo uuid; v_admin uuid; v_admin2 uuid; v_contrib uuid; v_banni uuid;
  v_super jsonb := json_build_object('sub', gen_random_uuid(), 'role', 'authenticated',
    'app_metadata', json_build_object('is_super_admin', true))::jsonb;
  r text := '';
begin
  select id into v_demo from public.organisations where nom = 'Association Démo Staging';
  select po.utilisateur_id into v_admin from public.profils_organisation po join auth.users au on au.id = po.utilisateur_id
    where po.organisation_id = v_demo and po.role = 'admin' and au.banned_until is null order by po.created_at limit 1;
  select po.utilisateur_id into v_admin2 from public.profils_organisation po join auth.users au on au.id = po.utilisateur_id
    where po.organisation_id = v_demo and po.role = 'admin' and au.banned_until is null and po.utilisateur_id <> v_admin limit 1;
  select po.utilisateur_id into v_contrib from public.profils_organisation po join auth.users au on au.id = po.utilisateur_id
    where po.organisation_id = v_demo and po.role = 'contributeur' and au.banned_until is null limit 1;
  select po.utilisateur_id into v_banni from public.profils_organisation po join auth.users au on au.id = po.utilisateur_id
    where po.organisation_id = v_demo and po.role = 'admin' and au.banned_until > now() limit 1;

  -- 1. Un admin d'organisation ne peut pas changer un rôle
  perform set_config('request.jwt.claims', json_build_object('sub', v_admin, 'role', 'authenticated', 'app_metadata', json_build_object())::text, true);
  execute 'set local role authenticated';
  begin
    perform public.changer_role_compte(v_contrib, 'admin');
    r := r || ' 1.admin=ACCEPTE(KO)';
  exception when insufficient_privilege then
    r := r || ' 1.admin=refuse';
  end;

  -- 2. authenticated ne peut pas appeler est_dernier_admin_actif
  begin
    perform public.est_dernier_admin_actif(v_admin);
    r := r || ' | 2.helper=ACCEPTE(KO)';
  exception when insufficient_privilege then
    r := r || ' | 2.helper=refuse';
  end;

  -- 3. Super-admin : contributeur -> admin -> contributeur
  perform set_config('request.jwt.claims', v_super::text, true);
  -- (lecture du rôle dans une instruction séparée : une même expression voit l'état d'avant l'appel)
  perform public.changer_role_compte(v_contrib, 'admin');
  r := r || ' | 3.promotion=' || (select role from public.profils_organisation where utilisateur_id = v_contrib);
  perform public.changer_role_compte(v_contrib, 'contributeur');
  r := r || ' retrogradation=' || (select role from public.profils_organisation where utilisateur_id = v_contrib);

  -- 4. Rôle inconnu
  begin
    perform public.changer_role_compte(v_contrib, 'proprietaire');
    r := r || ' | 4.role_inconnu=ACCEPTE(KO)';
  exception when invalid_parameter_value then
    r := r || ' | 4.role_inconnu=refuse';
  end;

  -- 5. Rétrograder un admin quand un autre admin actif existe : accepté
  r := r || ' | 5.avec_autre_admin=' || public.changer_role_compte(v_admin2, 'contributeur');
  perform public.changer_role_compte(v_admin2, 'admin');

  -- 6. Dernier admin actif : on désactive tous les autres admins (annulé à la fin)
  execute 'reset role';
  update auth.users set banned_until = now() + interval '1 day'
    where id in (select utilisateur_id from public.profils_organisation
                 where organisation_id = v_demo and role = 'admin' and utilisateur_id <> v_admin);
  r := r || ' | 6.helper_dernier=' || public.est_dernier_admin_actif(v_admin)
    || ' helper_contrib=' || public.est_dernier_admin_actif(v_contrib);
  execute 'set local role authenticated';
  begin
    perform public.changer_role_compte(v_admin, 'contributeur');
    r := r || ' retrograder_dernier=ACCEPTE(KO)';
  exception when raise_exception then
    r := r || ' retrograder_dernier=refuse';
  end;

  -- 7. Rétrograder un admin désactivé reste possible (l'org n'en perd pas un actif)
  if v_banni is not null then
    r := r || ' | 7.admin_desactive=' || public.changer_role_compte(v_banni, 'contributeur');
  end if;

  execute 'reset role';
  raise exception 'RESULTATS:%', r;
end $$;
