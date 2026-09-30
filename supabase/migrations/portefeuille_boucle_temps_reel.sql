-- Coupon 4/5 phase (b) — révision monotone et réveil Broadcast acheteur.
-- Le Broadcast ne transporte aucune donnée métier : les clients relisent toujours
-- leur source autoritaire via l'Edge Function ou la RLS.
begin;

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
  v_revision bigint;
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

  select (extract(epoch from greatest(
    v_wallet.updated_at,
    v_event.updated_at,
    coalesce((select max(m.created_at) from public.mouvements_portefeuille m
      where m.portefeuille_id = v_wallet.id), '-infinity'::timestamptz),
    coalesce((select max(case
      when d.statut = 'en_attente' and d.expire_le <= clock_timestamp() then d.expire_le
      else d.updated_at
    end) from public.demandes_paiement d
      where d.portefeuille_id = v_wallet.id), '-infinity'::timestamptz)
  )) * 1000000)::bigint
  into v_revision;

  return jsonb_build_object(
    'ok', true,
    'revision', v_revision,
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

create or replace function public.broadcast_portefeuille_payment_wakeup()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_secret_hash text;
begin
  for v_secret_hash in
    select s.secret_hash
    from public.secrets_portefeuille s
    where s.portefeuille_id = new.portefeuille_id
      and s.revoque_le is null
  loop
    begin
      perform realtime.send('{}'::jsonb, 'changed', v_secret_hash, false);
    exception when others then
      -- Le polling réconcilie l'état : un signal indisponible ne doit jamais
      -- annuler la mutation métier ni écrire le secret dans les journaux.
      raise warning 'Coupon payment buyer broadcast unavailable';
    end;
  end loop;
  return null;
end;
$$;

revoke execute on function public.broadcast_portefeuille_payment_wakeup()
  from public, anon, authenticated;

drop trigger if exists trg_demandes_paiement_broadcast_acheteur
  on public.demandes_paiement;
create trigger trg_demandes_paiement_broadcast_acheteur
  after insert or update of statut on public.demandes_paiement
  for each row execute function public.broadcast_portefeuille_payment_wakeup();

commit;
