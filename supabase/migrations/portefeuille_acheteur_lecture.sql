-- Coupon 4 — lecture publique d'un portefeuille par capacité hashée.
-- Le secret brut reste dans le fragment du navigateur ; seul son SHA-256 est transmis.
begin;

create table if not exists public.acces_portefeuille_rate_limits (
  id bigint generated always as identity primary key,
  ip_hash text not null check (ip_hash ~ '^[0-9a-f]{64}$'),
  portefeuille_id uuid,
  scope text not null check (scope in ('etat', 'pdf')),
  created_at timestamptz not null default clock_timestamp(),
  foreign key (portefeuille_id) references public.portefeuilles(id) on delete cascade
);

create index if not exists idx_acces_portefeuille_rate_limits_ip
  on public.acces_portefeuille_rate_limits(scope, ip_hash, created_at desc);
create index if not exists idx_acces_portefeuille_rate_limits_wallet
  on public.acces_portefeuille_rate_limits(scope, portefeuille_id, created_at desc)
  where portefeuille_id is not null;

alter table public.acces_portefeuille_rate_limits enable row level security;
revoke all on public.acces_portefeuille_rate_limits from public, anon, authenticated;
grant select, insert, delete on public.acces_portefeuille_rate_limits to service_role;

-- Point unique de résolution par empreinte. La fonction historique délègue ici afin
-- que les deux chemins ne puissent pas diverger sur la révocation d'un secret.
create or replace function public.resoudre_hash_secret_portefeuille(p_secret_hash text)
returns table (portefeuille_id uuid, evenement_id uuid, organisation_id uuid)
language sql stable security definer set search_path = public, pg_temp as $$
  select w.id, w.evenement_id, w.organisation_id
  from public.secrets_portefeuille s
  join public.portefeuilles w on w.id = s.portefeuille_id
  where p_secret_hash ~ '^[0-9a-f]{64}$'
    and s.secret_hash = p_secret_hash
    and s.revoque_le is null;
$$;
revoke execute on function public.resoudre_hash_secret_portefeuille(text)
  from public, anon, authenticated;
grant execute on function public.resoudre_hash_secret_portefeuille(text) to service_role;

create or replace function public.resoudre_secret_portefeuille(p_secret text)
returns table (portefeuille_id uuid, evenement_id uuid, organisation_id uuid)
language sql stable security definer set search_path = public, pg_temp as $$
  select *
  from public.resoudre_hash_secret_portefeuille(
    encode(sha256(convert_to(coalesce(p_secret, ''), 'UTF8')), 'hex')
  );
$$;
revoke execute on function public.resoudre_secret_portefeuille(text)
  from public, anon, authenticated;
grant execute on function public.resoudre_secret_portefeuille(text) to service_role;

create or replace function public.lire_portefeuille_par_secret_hash(
  p_secret_hash text,
  p_ip_hash text,
  p_scope text default 'etat'
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_wallet_id uuid;
  v_event_id uuid;
  v_organisation_id uuid;
  v_wallet public.portefeuilles;
  v_event public.evenements;
  v_org_name text;
  v_ip_limit integer;
  v_wallet_limit integer;
  v_window interval;
  v_ip_count integer;
  v_wallet_count integer := 0;
  v_movements jsonb;
  v_pending jsonb;
begin
  if p_secret_hash is null or p_secret_hash !~ '^[0-9a-f]{64}$'
    or p_ip_hash is null or p_ip_hash !~ '^[0-9a-f]{64}$'
    or p_scope not in ('etat', 'pdf') then
    return jsonb_build_object('ok', false, 'reason', 'ACCES_INVALIDE');
  end if;

  if p_scope = 'pdf' then
    v_ip_limit := 6;
    v_wallet_limit := 10;
    v_window := interval '5 minutes';
  else
    v_ip_limit := 60;
    v_wallet_limit := 120;
    v_window := interval '1 minute';
  end if;

  select portefeuille_id, evenement_id, organisation_id
  into v_wallet_id, v_event_id, v_organisation_id
  from public.resoudre_hash_secret_portefeuille(p_secret_hash);

  -- Les verrous sérialisent les compteurs concurrents pour une IP puis un
  -- portefeuille. Tous les appels suivent le même ordre pour éviter un deadlock.
  perform pg_advisory_xact_lock(hashtextextended(
    'portefeuille:ip:' || p_scope || ':' || p_ip_hash, 0
  ));
  if v_wallet_id is not null then
    perform pg_advisory_xact_lock(hashtextextended(
      'portefeuille:wallet:' || p_scope || ':' || v_wallet_id::text, 0
    ));
  end if;

  delete from public.acces_portefeuille_rate_limits
  where created_at < clock_timestamp() - interval '1 day'
    and (ip_hash = p_ip_hash
      or portefeuille_id is not distinct from v_wallet_id);

  insert into public.acces_portefeuille_rate_limits(ip_hash, portefeuille_id, scope)
  values (p_ip_hash, v_wallet_id, p_scope);

  select count(*) into v_ip_count
  from public.acces_portefeuille_rate_limits
  where scope = p_scope and ip_hash = p_ip_hash
    and created_at > clock_timestamp() - v_window;

  if v_wallet_id is not null then
    select count(*) into v_wallet_count
    from public.acces_portefeuille_rate_limits
    where scope = p_scope and portefeuille_id = v_wallet_id
      and created_at > clock_timestamp() - v_window;
  end if;

  if v_ip_count > v_ip_limit or v_wallet_count > v_wallet_limit then
    return jsonb_build_object('ok', false, 'reason', 'RATE_LIMIT');
  end if;

  if v_wallet_id is null then
    return jsonb_build_object('ok', false, 'reason', 'ACCES_INVALIDE');
  end if;

  select * into v_wallet
  from public.portefeuilles
  where id = v_wallet_id;

  select e.* into v_event
  from public.evenements e
  join public.organisations o on o.id = e.organisation_id
  where e.id = v_event_id
    and e.organisation_id = v_organisation_id
    and o.fonctionnalites_activees -> 'evenements' = 'true'::jsonb;

  if not found then
    return jsonb_build_object('ok', false, 'reason', 'ACCES_INVALIDE');
  end if;

  select nom into v_org_name
  from public.organisations
  where id = v_organisation_id;

  select coalesce(jsonb_agg(jsonb_build_object(
    'type', m.type,
    'montantCentimes', m.montant_centimes,
    'soldeApresCentimes', m.solde_apres_centimes,
    'createdAt', m.created_at
  ) order by m.created_at desc), '[]'::jsonb)
  into v_movements
  from public.mouvements_portefeuille m
  where m.portefeuille_id = v_wallet.id;

  select jsonb_build_object(
    'id', d.id,
    'montantCentimes', d.montant_centimes,
    'expireLe', d.expire_le,
    'createdAt', d.created_at
  ) into v_pending
  from public.demandes_paiement d
  where d.portefeuille_id = v_wallet.id
    and d.statut = 'en_attente'
    and d.expire_le > clock_timestamp()
  order by d.created_at desc
  limit 1;

  return jsonb_build_object(
    'ok', true,
    'portefeuille', jsonb_build_object(
      'codePublic', v_wallet.code_public,
      'soldeCentimes', v_wallet.solde_centimes,
      'gele', v_wallet.gele
    ),
    'evenement', jsonb_build_object(
      'nom', v_event.nom,
      'dateDebut', v_event.date_evenement,
      'dateFin', v_event.date_fin,
      'statut', v_event.statut,
      'organisationNom', v_org_name
    ),
    'mouvements', v_movements,
    'demandeEnAttente', v_pending
  );
end;
$$;

revoke execute on function public.lire_portefeuille_par_secret_hash(text, text, text)
  from public, anon, authenticated;
grant execute on function public.lire_portefeuille_par_secret_hash(text, text, text)
  to service_role;

commit;
