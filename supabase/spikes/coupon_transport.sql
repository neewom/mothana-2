-- Banc de transport synthétique STAGING UNIQUEMENT. Ne pas promouvoir en production.
-- Aucune référence aux portefeuilles, aux événements ou au journal financier.
begin;
create table if not exists public.coupon_transport_spike (
  id uuid primary key default gen_random_uuid(),
  seller_hash text not null,
  buyer_hash text not null,
  topic text not null,
  revision integer not null default 0,
  status text not null default 'idle' check (status in ('idle','pending','accepted','refused','expired')),
  request_id uuid,
  changed_at timestamptz not null default clock_timestamp(),
  request_expires_at timestamptz,
  expires_at timestamptz not null default (clock_timestamp() + interval '2 hours')
);
alter table public.coupon_transport_spike enable row level security;
revoke all on public.coupon_transport_spike from public, anon, authenticated;
grant select, insert, update, delete on public.coupon_transport_spike to service_role;
-- Pas de policy organisationnelle : données techniques sans tenant, accessibles
-- uniquement par l'Edge Function ; création réservée au super-admin vérifié.
create or replace function public.coupon_spike_step(
  p_session_id uuid, p_token text, p_action text, p_request_id uuid default null, p_accept boolean default null
) returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare
  s public.coupon_transport_spike;
  token_hash text := encode(sha256(convert_to(p_token, 'UTF8')), 'hex');
  actor text;
begin
  select * into s from public.coupon_transport_spike where id = p_session_id for update;
  if not found or s.expires_at <= clock_timestamp() or token_hash is null then
    raise exception 'ACCES_INTERDIT' using errcode = '42501';
  end if;
  actor := case when token_hash = s.seller_hash then 'seller' when token_hash = s.buyer_hash then 'buyer' end;
  if actor is null then raise exception 'ACCES_INTERDIT' using errcode = '42501'; end if;
  if p_action is null or p_action not in ('read','request','decide') then raise exception 'ACTION_INVALIDE'; end if;
  if p_action = 'request' and (actor <> 'seller' or p_request_id is null) then
    raise exception 'ACCES_INTERDIT' using errcode = '42501';
  end if;
  if p_action = 'decide' and (actor <> 'buyer' or p_request_id is null or p_accept is null) then
    raise exception 'ACCES_INTERDIT' using errcode = '42501';
  end if;
  if s.status = 'pending' and s.request_expires_at <= clock_timestamp() then
    s.status := 'expired'; s.revision := s.revision + 1; s.changed_at := clock_timestamp();
  end if;
  if p_action = 'request' and p_request_id is distinct from s.request_id then
    if s.status = 'pending' then raise exception 'DEMANDE_EN_COURS'; end if;
    s.request_id := p_request_id; s.status := 'pending'; s.revision := s.revision + 1;
    s.changed_at := clock_timestamp(); s.request_expires_at := s.changed_at + interval '90 seconds';
  elsif p_action = 'decide' then
    if p_request_id is distinct from s.request_id then raise exception 'DEMANDE_INCONNUE'; end if;
    if s.status = 'pending' then
      s.status := case when p_accept then 'accepted' else 'refused' end;
      s.revision := s.revision + 1; s.changed_at := clock_timestamp();
    end if;
  end if;
  update public.coupon_transport_spike set revision = s.revision, status = s.status,
    request_id = s.request_id, changed_at = s.changed_at, request_expires_at = s.request_expires_at
    where id = s.id;
  return jsonb_build_object('revision',s.revision,'status',s.status,'requestId',s.request_id,
    'changedAt',s.changed_at,'expiresAt',s.request_expires_at,'sessionExpiresAt',s.expires_at,
    'topic',s.topic,'role',actor,'serverNow',clock_timestamp());
end;
$$;
revoke execute on function public.coupon_spike_step(uuid,text,text,uuid,boolean) from public, anon, authenticated;
grant execute on function public.coupon_spike_step(uuid,text,text,uuid,boolean) to service_role;
commit;
