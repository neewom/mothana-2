-- Tests de verifier_limite_reset_mdp (request_password_reset_rate_limit.sql) — staging uniquement :
--   npx supabase db query --linked -f supabase/tests/request_password_reset_rate_limit.sql
-- Bloc terminé par une exception : rien n'est conservé ; le message RESULTATS: liste chaque cas.
do $$
declare
  r text := '';
  v_ip text := repeat('a', 64);
  v_email text := repeat('e', 64);
  i int;
  v jsonb;
begin
  -- 1. Même adresse depuis des IP différentes : 3 envois par heure, puis acceptée sans envoi
  r := r || '1.cooldown_adresse=';
  for i in 1..4 loop
    r := r || (public.verifier_limite_reset_mdp(lpad(to_hex(i), 64, 'b'), v_email) ->> 'envoyer') || ' ';
  end loop;

  -- 2. Même IP, adresses différentes : 5 demandes / 15 min, la 6e est refusée
  for i in 1..6 loop
    v := public.verifier_limite_reset_mdp(v_ip, lpad(to_hex(i), 64, 'c'));
  end loop;
  r := r || '| 2.limite_ip_6e=' || coalesce(v ->> 'reason', 'ok');

  -- 3. Empreintes invalides refusées
  r := r || ' | 3.empreinte_invalide=' || (public.verifier_limite_reset_mdp('x', v_email) ->> 'reason');

  -- 4. Pas d'exécution pour authenticated
  execute 'set local role authenticated';
  begin
    perform public.verifier_limite_reset_mdp(v_ip, v_email);
    r := r || ' | 4.authenticated=ACCEPTE(KO)';
  exception when insufficient_privilege then r := r || ' | 4.authenticated=refuse';
  end;
  execute 'reset role';

  raise exception 'RESULTATS: %', r;
end $$;
