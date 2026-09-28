-- Coupon 10 — limitation des tentatives de connexion bénévole par IP.
-- Le scope verify_pin n'est volontairement rattaché à aucun portefeuille ni organisation.
begin;

alter table public.acces_portefeuille_rate_limits
  drop constraint if exists acces_portefeuille_rate_limits_scope_check;

alter table public.acces_portefeuille_rate_limits
  add constraint acces_portefeuille_rate_limits_scope_check
  check (scope in ('etat', 'pdf', 'verify_pin'));

create or replace function public.verifier_limite_verify_pin(p_ip_hash text)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_attempt_count integer;
begin
  if p_ip_hash is null or p_ip_hash !~ '^[0-9a-f]{64}$' then
    return jsonb_build_object('ok', false, 'reason', 'ACCES_INVALIDE');
  end if;

  -- Sérialise les tentatives concurrentes de la même IP avant le comptage.
  perform pg_advisory_xact_lock(hashtextextended(
    'portefeuille:ip:verify_pin:' || p_ip_hash, 0
  ));

  delete from public.acces_portefeuille_rate_limits
  where scope = 'verify_pin'
    and ip_hash = p_ip_hash
    and created_at < clock_timestamp() - interval '1 day';

  insert into public.acces_portefeuille_rate_limits(ip_hash, portefeuille_id, scope)
  values (p_ip_hash, null, 'verify_pin');

  select count(*) into v_attempt_count
  from public.acces_portefeuille_rate_limits
  where scope = 'verify_pin'
    and ip_hash = p_ip_hash
    and created_at > clock_timestamp() - interval '15 minutes';

  if v_attempt_count > 10 then
    return jsonb_build_object('ok', false, 'reason', 'RATE_LIMIT');
  end if;

  return jsonb_build_object('ok', true);
end;
$$;

revoke execute on function public.verifier_limite_verify_pin(text)
  from public, anon, authenticated;
grant execute on function public.verifier_limite_verify_pin(text)
  to service_role;

commit;
