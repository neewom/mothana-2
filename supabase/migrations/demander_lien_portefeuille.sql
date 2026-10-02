-- Coupon 9 — récupération self-service du lien acheteur.
-- La RPC n'est accessible qu'au service_role et ne révèle jamais si l'email
-- correspond à un portefeuille. Chaque renvoi ajoute un secret sans révoquer
-- les accès déjà ouverts sur les autres appareils.
begin;

alter table public.acces_portefeuille_rate_limits
  drop constraint if exists acces_portefeuille_rate_limits_scope_check;

alter table public.acces_portefeuille_rate_limits
  add constraint acces_portefeuille_rate_limits_scope_check
  check (scope in ('etat', 'pdf', 'verify_pin', 'recuperation'));

create or replace function public.demander_lien_portefeuille(
  p_evenement_id uuid,
  p_email text,
  p_ip_hash text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_now timestamptz := clock_timestamp();
  v_email text := lower(btrim(coalesce(p_email, '')));
  v_event_name text;
  v_org_name text;
  v_wallet_id uuid;
  v_ip_count integer;
  v_wallet_count integer := 0;
  v_recent_wallet_count integer := 0;
  v_secret text;
  v_secret_id uuid;
begin
  if p_evenement_id is null
    or v_email !~ '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$'
    or length(v_email) > 254
    or p_ip_hash is null
    or p_ip_hash !~ '^[0-9a-f]{64}$' then
    return jsonb_build_object(
      'ok', true,
      'secret', null,
      'envoi_id', null,
      'evenement_nom', null,
      'organisation_nom', null
    );
  end if;

  select e.nom, o.nom
  into v_event_name, v_org_name
  from public.evenements e
  join public.organisations o on o.id = e.organisation_id
  where e.id = p_evenement_id
    and e.statut = 'ouvert'
    and o.fonctionnalites_activees -> 'evenements' = 'true'::jsonb
  for share of e;

  -- Un événement non public ou une organisation sans le flag ne produit
  -- aucun secret ni entrée de rate limiting.
  if not found then
    return jsonb_build_object(
      'ok', true,
      'secret', null,
      'envoi_id', null,
      'evenement_nom', null,
      'organisation_nom', null
    );
  end if;

  select w.id
  into v_wallet_id
  from public.portefeuilles w
  where w.evenement_id = p_evenement_id
    and lower(w.email) = v_email;

  -- Ordre de verrouillage commun à toutes les tentatives : IP puis
  -- portefeuille. L'adresse inconnue suit le même chemin IP et est comptée.
  perform pg_advisory_xact_lock(hashtextextended(
    'portefeuille:ip:recuperation:' || p_ip_hash, 0
  ));
  if v_wallet_id is not null then
    perform pg_advisory_xact_lock(hashtextextended(
      'portefeuille:wallet:recuperation:' || v_wallet_id::text, 0
    ));
  end if;

  delete from public.acces_portefeuille_rate_limits
  where scope = 'recuperation'
    and created_at < v_now - interval '1 day'
    and (ip_hash = p_ip_hash
      or (v_wallet_id is not null and portefeuille_id = v_wallet_id));

  -- Une ligne sans portefeuille représente chaque tentative et alimente la
  -- limite IP, que l'adresse soit connue ou non.
  insert into public.acces_portefeuille_rate_limits(ip_hash, portefeuille_id, scope)
  values (p_ip_hash, null, 'recuperation');

  select count(*) into v_ip_count
  from public.acces_portefeuille_rate_limits
  where scope = 'recuperation'
    and ip_hash = p_ip_hash
    and portefeuille_id is null
    and created_at > v_now - interval '15 minutes';

  if v_wallet_id is not null then
    select count(*) into v_wallet_count
    from public.acces_portefeuille_rate_limits
    where scope = 'recuperation'
      and portefeuille_id = v_wallet_id
      and created_at > v_now - interval '1 hour';

    select count(*) into v_recent_wallet_count
    from public.acces_portefeuille_rate_limits
    where scope = 'recuperation'
      and portefeuille_id = v_wallet_id
      and created_at > v_now - interval '2 minutes';
  end if;

  if v_ip_count > 6
    or v_wallet_count >= 3
    or v_recent_wallet_count > 0
    or v_wallet_id is null then
    return jsonb_build_object(
      'ok', true,
      'secret', null,
      'envoi_id', null,
      'evenement_nom', null,
      'organisation_nom', null
    );
  end if;

  -- Les lignes rattachées au portefeuille représentent uniquement les envois
  -- autorisés. Une tentative bloquée ne repousse donc pas indéfiniment le délai
  -- minimal d'un acheteur légitime.
  insert into public.acces_portefeuille_rate_limits(ip_hash, portefeuille_id, scope)
  values (p_ip_hash, v_wallet_id, 'recuperation');

  -- Primitive existante : elle verrouille le portefeuille, insère uniquement
  -- le hash et conserve tous les secrets actifs précédents.
  v_secret := public.ajouter_secret_portefeuille(v_wallet_id);

  select s.id into v_secret_id
  from public.secrets_portefeuille s
  where s.portefeuille_id = v_wallet_id
    and s.secret_hash = encode(sha256(convert_to(v_secret, 'UTF8')), 'hex');

  return jsonb_build_object(
    'ok', true,
    'secret', v_secret,
    'envoi_id', v_secret_id,
    'evenement_nom', v_event_name,
    'organisation_nom', v_org_name
  );
end;
$$;

revoke execute on function public.demander_lien_portefeuille(uuid, text, text)
  from public, anon, authenticated;
grant execute on function public.demander_lien_portefeuille(uuid, text, text)
  to service_role;

commit;
