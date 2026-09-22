-- Transactional tests: no persisted fixtures.
begin;
do $$
declare
  sid uuid; state jsonb; rid uuid := gen_random_uuid();
  seller text := repeat('a',64); buyer text := repeat('b',64);
begin
  if has_table_privilege('anon','public.coupon_transport_spike','SELECT')
    or has_table_privilege('authenticated','public.coupon_transport_spike','SELECT')
    or has_function_privilege('anon','public.coupon_spike_step(uuid,text,text,uuid,boolean)','EXECUTE')
    or has_function_privilege('authenticated','public.coupon_spike_step(uuid,text,text,uuid,boolean)','EXECUTE') then
    raise exception 'unexpected public privileges';
  end if;
  insert into public.coupon_transport_spike(seller_hash,buyer_hash,topic)
    values(encode(sha256(convert_to(seller,'UTF8')),'hex'),encode(sha256(convert_to(buyer,'UTF8')),'hex'),'test-only') returning id into sid;
  begin
    perform public.coupon_spike_step(sid,'wrong','read'); raise exception 'bad token accepted';
  exception when insufficient_privilege then null; end;
  begin
    perform public.coupon_spike_step(sid,buyer,'request',rid); raise exception 'buyer created request';
  exception when insufficient_privilege then null; end;
  state := public.coupon_spike_step(sid,seller,'request',rid);
  assert state->>'status' = 'pending' and (state->>'revision')::int = 1;
  state := public.coupon_spike_step(sid,seller,'request',rid);
  assert (state->>'revision')::int = 1, 'repeat must not create a new request';
  begin
    perform public.coupon_spike_step(sid,seller,'decide',rid,true); raise exception 'seller decided';
  exception when insufficient_privilege then null; end;
  state := public.coupon_spike_step(sid,buyer,'decide',rid,true);
  assert state->>'status' = 'accepted' and (state->>'revision')::int = 2;
  state := public.coupon_spike_step(sid,buyer,'decide',rid,false);
  assert state->>'status' = 'accepted' and (state->>'revision')::int = 2, 'first decision wins';
  rid := gen_random_uuid();
  perform public.coupon_spike_step(sid,seller,'request',rid);
  update public.coupon_transport_spike set request_expires_at = clock_timestamp() - interval '1 second' where id = sid;
  state := public.coupon_spike_step(sid,buyer,'decide',rid,true);
  assert state->>'status' = 'expired', 'late decisions must expire';
  update public.coupon_transport_spike set expires_at = clock_timestamp() - interval '1 second' where id = sid;
  begin
    perform public.coupon_spike_step(sid,seller,'read'); raise exception 'expired session accepted';
  exception when insufficient_privilege then null; end;
end;
$$;
rollback;
