-- Tests de verifier_limite_simulation_achat (simuler_achat_evenement_rate_limit.sql) — staging uniquement :
--   npx supabase db query --linked -f supabase/tests/simuler_achat_evenement_rate_limit.sql
-- Bloc terminé par une exception : rien n'est conservé ; le message RESULTATS: liste chaque cas.
do $$
declare
  r text := '';
  v_ip text := repeat('a', 64);
  v_ip2 text := repeat('d', 64);
  v_email text := repeat('e', 64);
  v_email2 text := repeat('f', 64);
  i int;
  v jsonb;
  v_nb int;
begin
  -- 1. Même IP, adresses différentes : 5 par heure, la 6e est refusée
  r := r || '1.ip=';
  for i in 1..6 loop
    v := public.verifier_limite_simulation_achat(v_ip, lpad(to_hex(i), 64, 'c'));
    r := r || coalesce(v ->> 'reason', 'ok') || ' ';
  end loop;

  -- 2. Une demande refusée par l'IP ne consomme pas le quota de l'adresse
  select count(*) into v_nb from public.acces_portefeuille_rate_limits
  where scope = 'simulation_achat_email' and ip_hash = lpad(to_hex(6), 64, 'c');
  r := r || '| 2.adresse_non_comptee=' || v_nb;

  -- 3. Autre IP : acceptée
  r := r || ' | 3.autre_ip=' || coalesce(public.verifier_limite_simulation_achat(v_ip2, v_email2) ->> 'reason', 'ok');

  -- 4. Fenêtre IP expirée (> 1 h) : acceptée de nouveau
  update public.acces_portefeuille_rate_limits set created_at = created_at - interval '61 minutes'
  where scope = 'simulation_achat_ip' and ip_hash = v_ip;
  r := r || ' | 4.ip_expiree=' || coalesce(public.verifier_limite_simulation_achat(v_ip, repeat('9', 64)) ->> 'reason', 'ok');

  -- 5. Même adresse depuis des IP différentes : 3 par jour, la 4e est refusée
  r := r || ' | 5.adresse=';
  for i in 1..4 loop
    v := public.verifier_limite_simulation_achat(lpad(to_hex(i), 64, 'b'), v_email);
    r := r || coalesce(v ->> 'reason', 'ok') || ' ';
  end loop;

  -- 6. Autre adresse depuis une IP neuve : acceptée
  r := r || '| 6.autre_adresse=' || coalesce(public.verifier_limite_simulation_achat(repeat('7', 64), repeat('8', 64)) ->> 'reason', 'ok');

  -- 7. Fenêtre adresse expirée (> 1 jour) : acceptée de nouveau
  update public.acces_portefeuille_rate_limits set created_at = created_at - interval '25 hours'
  where scope = 'simulation_achat_email' and ip_hash = v_email;
  r := r || ' | 7.adresse_expiree=' || coalesce(public.verifier_limite_simulation_achat(lpad(to_hex(5), 64, 'b'), v_email) ->> 'reason', 'ok');

  -- 8. Empreintes invalides refusées
  r := r || ' | 8.empreinte_invalide=' || (public.verifier_limite_simulation_achat('x', v_email) ->> 'reason')
         || '/' || (public.verifier_limite_simulation_achat(v_ip, null) ->> 'reason');

  -- 9. Droits EXECUTE : service_role seul
  r := r || ' | 9.droits public=' || has_function_privilege('public', 'public.verifier_limite_simulation_achat(text, text)', 'execute')
         || ' anon=' || has_function_privilege('anon', 'public.verifier_limite_simulation_achat(text, text)', 'execute')
         || ' authenticated=' || has_function_privilege('authenticated', 'public.verifier_limite_simulation_achat(text, text)', 'execute')
         || ' service_role=' || has_function_privilege('service_role', 'public.verifier_limite_simulation_achat(text, text)', 'execute');

  -- 10. Appel refusé pour anon et pour authenticated (dont une session bénévole)
  execute 'set local role anon';
  begin
    perform public.verifier_limite_simulation_achat(v_ip2, v_email2);
    r := r || ' | 10.anon=ACCEPTE(KO)';
  exception when insufficient_privilege then r := r || ' | 10.anon=refuse';
  end;
  execute 'reset role';

  execute 'set local role authenticated';
  perform set_config('request.jwt.claims', json_build_object(
    'sub', gen_random_uuid(), 'role', 'authenticated',
    'email', 'benevole-test@mothana.internal')::text, true);
  begin
    perform public.verifier_limite_simulation_achat(v_ip2, v_email2);
    r := r || ' | 11.benevole=ACCEPTE(KO)';
  exception when insufficient_privilege then r := r || ' | 11.benevole=refuse';
  end;
  execute 'reset role';

  raise exception 'RESULTATS: %', r;
end $$;
