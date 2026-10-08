-- Coupon RGPD — anonymisation d'un acheteur, conservation bornée, information des
-- personnes, purge quotidienne. Le journal des mouvements reste immuable : on écrase
-- l'email (portefeuille et commandes) au lieu de supprimer des lignes. Rejouable.
begin;

-- ---------------------------------------------------------------------------
-- 1. Colonnes
-- ---------------------------------------------------------------------------
alter table public.organisations
  add column if not exists conservation_evenements_mois integer not null default 18,
  add column if not exists url_politique_confidentialite text;
alter table public.organisations
  drop constraint if exists organisations_conservation_evenements_mois_check;
alter table public.organisations
  add constraint organisations_conservation_evenements_mois_check
  check (conservation_evenements_mois between 1 and 120);
alter table public.organisations
  drop constraint if exists organisations_url_politique_confidentialite_check;
alter table public.organisations
  add constraint organisations_url_politique_confidentialite_check
  check (url_politique_confidentialite is null
    or (url_politique_confidentialite ~* '^https?://[^[:space:]]+$'
      and length(url_politique_confidentialite) <= 2048));
comment on column public.organisations.conservation_evenements_mois is
  'Durée (mois) de conservation des données acheteurs Coupon après la date de fin d''un événement ; vaut aussi validité du crédit restant.';
comment on column public.organisations.url_politique_confidentialite is
  'Politique de confidentialité de l''association (responsable de traitement), affichée aux acheteurs Coupon.';

alter table public.portefeuilles
  add column if not exists anonymise_le timestamptz,
  add column if not exists anonymise_par uuid;
comment on column public.portefeuilles.anonymise_le is
  'Date d''anonymisation de l''acheteur (email écrasé, accès révoqués). Irréversible.';
comment on column public.portefeuilles.anonymise_par is
  'Compte ayant anonymisé l''acheteur ; null quand c''est la purge automatique.';

-- ---------------------------------------------------------------------------
-- 2. Garde-fous : un portefeuille anonymisé ne peut plus être ré-identifié ni
--    réalimenté, quel que soit le chemin (renvoi d'accès, correction d'adresse,
--    crédit). Triggers plutôt que modification de chaque RPC existante.
-- ---------------------------------------------------------------------------
create or replace function public.portefeuilles_anonymise_fige()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if old.anonymise_le is not null
    and (new.email is distinct from old.email or new.anonymise_le is distinct from old.anonymise_le) then
    raise exception 'PORTEFEUILLE_ANONYMISE';
  end if;
  return new;
end;
$$;
revoke execute on function public.portefeuilles_anonymise_fige() from public, anon, authenticated;
drop trigger if exists trg_portefeuilles_anonymise_fige on public.portefeuilles;
create trigger trg_portefeuilles_anonymise_fige before update on public.portefeuilles
  for each row execute function public.portefeuilles_anonymise_fige();

create or replace function public.portefeuille_non_anonymise()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if exists (
    select 1 from public.portefeuilles
    where id = new.portefeuille_id and anonymise_le is not null
  ) then
    raise exception 'PORTEFEUILLE_ANONYMISE';
  end if;
  return new;
end;
$$;
revoke execute on function public.portefeuille_non_anonymise() from public, anon, authenticated;

drop trigger if exists trg_secrets_portefeuille_non_anonymise on public.secrets_portefeuille;
create trigger trg_secrets_portefeuille_non_anonymise before insert on public.secrets_portefeuille
  for each row execute function public.portefeuille_non_anonymise();

drop trigger if exists trg_mouvements_portefeuille_non_anonymise on public.mouvements_portefeuille;
create trigger trg_mouvements_portefeuille_non_anonymise before insert on public.mouvements_portefeuille
  for each row execute function public.portefeuille_non_anonymise();

-- ---------------------------------------------------------------------------
-- 3. Noyau d'anonymisation (non exposé) : partagé par l'action admin et la purge.
--    Retourne false si le portefeuille était déjà anonymisé (idempotent).
-- ---------------------------------------------------------------------------
create or replace function public.anonymiser_portefeuille_interne(
  p_portefeuille_id uuid,
  p_auteur uuid
)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_wallet public.portefeuilles;
  v_placeholder text;
begin
  select * into v_wallet
  from public.portefeuilles
  where id = p_portefeuille_id
  for update;

  if not found then
    raise exception 'PORTEFEUILLE_INTROUVABLE';
  end if;
  if v_wallet.anonymise_le is not null then
    return false;
  end if;

  -- Unique par portefeuille (index unique evenement_id + lower(email)) et conforme
  -- au CHECK de format ; le TLD .invalid ne peut recevoir aucun email. Le domaine
  -- est repris côté front (emailCommandeAffiche) pour masquer ces adresses.
  v_placeholder := 'efface+' || replace(v_wallet.id::text, '-', '') || '@anonyme.invalid';

  -- Commandes du portefeuille, et commandes jamais rattachées (paiement abandonné ou
  -- expiré) passées avec la même adresse sur le même événement.
  update public.commandes
  set email = v_placeholder
  where evenement_id = v_wallet.evenement_id
    and (portefeuille_id = v_wallet.id
      or (portefeuille_id is null and email = v_wallet.email));

  update public.secrets_portefeuille
  set revoque_le = clock_timestamp()
  where portefeuille_id = v_wallet.id
    and revoque_le is null;

  delete from public.acces_portefeuille_rate_limits
  where portefeuille_id = v_wallet.id;

  update public.portefeuilles
  set email = v_placeholder,
    anonymise_le = clock_timestamp(),
    anonymise_par = p_auteur
  where id = v_wallet.id;

  return true;
end;
$$;
revoke execute on function public.anonymiser_portefeuille_interne(uuid, uuid) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 4. Action admin : org-scopée, bypass super-admin. Idempotente.
-- ---------------------------------------------------------------------------
create or replace function public.anonymiser_portefeuille(p_portefeuille_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_organisation_id uuid;
begin
  select organisation_id into v_organisation_id
  from public.portefeuilles
  where id = p_portefeuille_id;

  if not found then
    raise exception 'PORTEFEUILLE_INTROUVABLE';
  end if;

  if auth.uid() is null or not coalesce(
    public.is_current_user_super_admin()
      or v_organisation_id = public.current_user_organisation_id(),
    false
  ) then
    raise exception 'ACCES_INTERDIT' using errcode = '42501';
  end if;

  perform public.anonymiser_portefeuille_interne(p_portefeuille_id, auth.uid());
end;
$$;
revoke execute on function public.anonymiser_portefeuille(uuid) from public, anon, authenticated;
grant execute on function public.anonymiser_portefeuille(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 5. Purge quotidienne : anonymise les portefeuilles échus et supprime les traces
--    de rate limiting au-delà de 24 h (la rétention déjà visée par le nettoyage
--    scopé des RPC acheteur, qui laissait des lignes orphelines).
--    Échéance = date de fin de l'événement + durée de l'organisation ; le dernier
--    jour de conservation est inclus (même calcul que dateFinConservation côté front).
-- ---------------------------------------------------------------------------
create or replace function public.purger_donnees_evenements()
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_wallet_id uuid;
  v_count integer := 0;
begin
  for v_wallet_id in
    select w.id
    from public.portefeuilles w
    join public.evenements e on e.id = w.evenement_id
    join public.organisations o on o.id = e.organisation_id
    where w.anonymise_le is null
      and (e.date_fin + make_interval(months => o.conservation_evenements_mois))::date < current_date
  loop
    if public.anonymiser_portefeuille_interne(v_wallet_id, null) then
      v_count := v_count + 1;
    end if;
  end loop;

  delete from public.acces_portefeuille_rate_limits
  where created_at < clock_timestamp() - interval '1 day';

  return v_count;
end;
$$;
revoke execute on function public.purger_donnees_evenements() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 6. Information des acheteurs : la page publique d'achat et la page portefeuille
--    reçoivent la durée de conservation et le lien de politique de confidentialité.
-- ---------------------------------------------------------------------------
drop function if exists public.get_evenement_public(text, text);
create function public.get_evenement_public(p_org_slug text, p_slug text)
returns table (
  id uuid,
  nom text,
  date_evenement date,
  date_fin date,
  montants_credit_centimes integer[],
  nom_organisation text,
  conservation_evenements_mois integer,
  url_politique_confidentialite text
)
language sql stable security definer set search_path = public, pg_temp as $$
  select e.id, e.nom, e.date_evenement, e.date_fin, e.montants_credit_centimes, o.nom,
    o.conservation_evenements_mois, o.url_politique_confidentialite
  from public.evenements e join public.organisations o on o.id = e.organisation_id
  where o.slug = p_org_slug and e.slug = p_slug and e.statut = 'ouvert'
    and o.fonctionnalites_activees -> 'evenements' = 'true'::jsonb;
$$;
revoke execute on function public.get_evenement_public(text, text) from public, anon, authenticated;
grant execute on function public.get_evenement_public(text, text) to anon, authenticated, service_role;

-- Reprise de portefeuille_boucle_temps_reel.sql : seuls la lecture de l'organisation
-- et l'objet `evenement` retourné changent.
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
  v_conservation integer;
  v_url_politique text;
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

  select nom, conservation_evenements_mois, url_politique_confidentialite
  into v_org_name, v_conservation, v_url_politique
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
      'organisationNom', v_org_name,
      'conservationMois', v_conservation,
      'urlPolitiqueConfidentialite', v_url_politique
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

-- ---------------------------------------------------------------------------
-- 7. Planification quotidienne (hors transaction ; cron.schedule remplace un job
--    existant du même nom, donc rejouable). À appliquer aussi en prod à la promotion.
-- ---------------------------------------------------------------------------
create extension if not exists pg_cron;
select cron.schedule(
  'purger-donnees-evenements',
  '17 3 * * *',
  $$select public.purger_donnees_evenements()$$
);
