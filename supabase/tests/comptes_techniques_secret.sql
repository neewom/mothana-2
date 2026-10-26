-- Tests de revoquer_sessions_compte_technique et de la neutralisation des mots de passe
-- (comptes_techniques_secret.sql) — à rejouer sur staging uniquement :
--   npx supabase db query --linked -f supabase/tests/comptes_techniques_secret.sql
-- Tout se passe dans un bloc qui se termine par une exception : rien n'est conservé ; le
-- message RESULTATS: liste chaque cas. Dépend de l'org « Association Démo Staging » (compte
-- bénévole existant) et d'un admin de cette organisation.
do $$
declare
  v_demo uuid; v_admin uuid; v_email text; v_pin text; v_id uuid; v_res uuid;
  r text := '';
begin
  select id, code_pin_benevole into v_demo, v_pin from public.organisations where nom = 'Association Démo Staging';
  v_email := 'benevole-' || v_demo || '@mothana.internal';
  select id into v_id from auth.users where email = v_email;
  select po.utilisateur_id into v_admin from public.profils_organisation po
    where po.organisation_id = v_demo and po.role = 'admin' order by po.created_at desc limit 1;

  -- 1. Le mot de passe du compte technique n'est pas le PIN
  r := r || '1.mdp_different_du_pin=' || ((select encrypted_password from auth.users where id = v_id) <> extensions.crypt(v_pin, (select encrypted_password from auth.users where id = v_id)));

  -- 2. Aucun compte non technique n'a été touché par le motif de neutralisation
  r := r || ' | 2.motif_strict=' || ((select count(*) from auth.users where email ~ '^(benevole|vendeur)-[0-9a-f-]{36}@mothana\.internal$'
         and (raw_app_meta_data ->> 'role') not in ('benevole', 'vendeur')) = 0);

  -- 3. service_role : révoque les sessions du compte et renvoie son id
  insert into auth.sessions (id, user_id, created_at, updated_at) values (gen_random_uuid(), v_id, now(), now());
  execute 'set local role service_role';
  v_res := public.revoquer_sessions_compte_technique(v_email);
  execute 'reset role';
  r := r || ' | 3.service_role=' || (v_res = v_id) || ' sessions_restantes=' || (select count(*) from auth.sessions where user_id = v_id) || '(0)';

  -- 4. Email non technique refusé (jamais un admin)
  begin
    perform public.revoquer_sessions_compte_technique((select email from auth.users where id = v_admin));
    r := r || ' | 4.email_admin=ACCEPTE(KO)';
  exception when invalid_parameter_value then r := r || ' | 4.email_admin=refuse';
  end;

  -- 5. authenticated (même admin) et anon : pas d'accès
  perform set_config('request.jwt.claims', json_build_object('sub', v_admin, 'role', 'authenticated', 'app_metadata', json_build_object())::text, true);
  execute 'set local role authenticated';
  begin
    perform public.revoquer_sessions_compte_technique(v_email);
    r := r || ' | 5.authenticated=ACCEPTE(KO)';
  exception when insufficient_privilege then r := r || ' | 5.authenticated=refuse';
  end;
  execute 'reset role';
  execute 'set local role anon';
  begin
    perform public.revoquer_sessions_compte_technique(v_email);
    r := r || ' anon=ACCEPTE(KO)';
  exception when insufficient_privilege then r := r || ' anon=refuse';
  end;

  raise exception 'RESULTATS: %', r;
end;
$$;
