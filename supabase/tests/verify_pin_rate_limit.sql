-- Tests transactionnels de Coupon 10. Toutes les tentatives sont annulées à la fin.
begin;

do $$
begin
  if has_function_privilege(
      'anon', 'public.verifier_limite_verify_pin(text)', 'execute'
    )
    or has_function_privilege(
      'authenticated', 'public.verifier_limite_verify_pin(text)', 'execute'
    )
    or not has_function_privilege(
      'service_role', 'public.verifier_limite_verify_pin(text)', 'execute'
    ) then
    raise exception 'TEST: privilèges rate limit verify-pin incorrects';
  end if;
end;
$$;

do $$
declare
  v_ip_hash text := repeat('a', 64);
  v_result jsonb;
begin
  v_result := public.verifier_limite_verify_pin('invalide');
  if v_result->>'reason' <> 'ACCES_INVALIDE' then
    raise exception 'TEST: empreinte IP invalide acceptée: %', v_result;
  end if;

  for i in 1..10 loop
    v_result := public.verifier_limite_verify_pin(v_ip_hash);
    if not (v_result->>'ok')::boolean then
      raise exception 'TEST: tentative % bloquée trop tôt: %', i, v_result;
    end if;
  end loop;

  v_result := public.verifier_limite_verify_pin(v_ip_hash);
  if v_result->>'reason' <> 'RATE_LIMIT' then
    raise exception 'TEST: onzième tentative non bloquée: %', v_result;
  end if;

  if exists (
    select 1
    from public.acces_portefeuille_rate_limits
    where scope = 'verify_pin'
      and ip_hash = v_ip_hash
      and portefeuille_id is not null
  ) then
    raise exception 'TEST: tentative verify-pin rattachée à un portefeuille';
  end if;

  update public.acces_portefeuille_rate_limits
  set created_at = clock_timestamp() - interval '16 minutes'
  where scope = 'verify_pin' and ip_hash = v_ip_hash;

  v_result := public.verifier_limite_verify_pin(v_ip_hash);
  if not (v_result->>'ok')::boolean then
    raise exception 'TEST: limite non réinitialisée après la fenêtre: %', v_result;
  end if;
end;
$$;

rollback;
