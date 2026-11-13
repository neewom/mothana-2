-- Inscription freemium : demande en ligne validée par le super-admin (carte https://trello.com/c/hNqpdZXL).
--
-- 1. Table demandes_inscription : écrite uniquement par les Edge Functions (service_role)
--    soumettre-demande-inscription (insertion), confirmer-demande-inscription (confirmation de
--    l'adresse) et valider-demande-inscription (acceptation), et par la section « Demandes
--    d'inscription » de /super-admin (refus). Lue par cette section seulement. RLS : aucun accès
--    anon ; authenticated limité au super-admin (select / update / delete), aucune insertion hors
--    service_role.
--    Statuts : a_confirmer (soumise, adresse pas encore confirmée par le lien envoyé par email,
--    invisible du super-admin) → en_attente (adresse confirmée, à traiter) → acceptee | refusee.
-- 2. Limitation de débit sur la table partagée acces_portefeuille_rate_limits (scopes dédiés) :
--    par IP (5 / heure, puis 429, sans enregistrer la tentative refusée), plafond global
--    (200 tentatives enregistrées / 24 h, puis 429) et par
--    adresse (3 emails / 24 h, au-delà rien n'est envoyé ni modifié) ; confirmation : 10 essais
--    par IP et par heure.
-- 3. soumettre_demande_inscription : limite + cas (nouvelle demande, demande à confirmer
--    renvoyée, compte existant, demande déjà en attente) + écriture, en une transaction.
--    confirmer_demande_inscription : a_confirmer → en_attente si le jeton est valide.
--    service_role seulement.
-- 4. Purge quotidienne (pg_cron, section hors transaction) : demandes refusées après 30 jours,
--    demandes jamais confirmées 7 jours après l'expiration de leur lien.
--
-- Rejouable sur staging, qui avait la version sans confirmation : les demandes en_attente
-- existantes y restent en_attente (considérées comme confirmées).
begin;

-- ---------------------------------------------------------------------------
-- 1. Table
-- ---------------------------------------------------------------------------
create table if not exists public.demandes_inscription (
  id uuid primary key default gen_random_uuid(),
  nom_association text not null check (char_length(btrim(nom_association)) between 2 and 150),
  ville text not null check (char_length(btrim(ville)) between 1 and 100),
  rna text check (rna is null or rna ~ '^W[0-9]{9}$'),
  siren text check (siren is null or siren ~ '^[0-9]{9}$'),
  prenom text not null check (char_length(btrim(prenom)) between 1 and 100),
  nom text not null check (char_length(btrim(nom)) between 1 and 100),
  email text not null check (char_length(email) <= 254 and email = lower(email) and email ~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'),
  message text check (message is null or char_length(message) <= 2000),
  cgu_acceptees_le timestamptz,
  statut text not null default 'a_confirmer',
  organisation_id uuid references public.organisations(id) on delete set null,
  traitee_par uuid references auth.users(id) on delete set null,
  traitee_le timestamptz,
  -- Admin créé à la validation, et son invitation : date d'envoi, ou dernière erreur (relance
  -- possible depuis la demande, sans seconde organisation).
  admin_utilisateur_id uuid references auth.users(id) on delete set null,
  invitation_envoyee_le timestamptz,
  erreur_invitation text,
  created_at timestamptz not null default now()
);

comment on table public.demandes_inscription is
  'Demandes d''espace Samakan déposées sur /inscription. Écritures : Edge Functions (service_role) et refus par le super-admin. Lecture : super-admin seul.';

-- Confirmation de l'adresse (double opt-in) : seule l'empreinte SHA-256 du jeton envoyé par
-- email est conservée, jamais le jeton. Elle reste après la confirmation (statut en_attente ou
-- suivant) pour répondre « déjà confirmée » à un second clic ; le jeton ne sert qu'une fois, la
-- transition partant uniquement de a_confirmer.
alter table public.demandes_inscription
  add column if not exists confirmation_jeton_hash text,
  add column if not exists confirmation_expire_le timestamptz,
  add column if not exists confirmee_le timestamptz;
alter table public.demandes_inscription alter column statut set default 'a_confirmer';

alter table public.demandes_inscription drop constraint if exists demandes_inscription_statut_check;
alter table public.demandes_inscription add constraint demandes_inscription_statut_check
  check (statut in ('a_confirmer', 'en_attente', 'acceptee', 'refusee'));
alter table public.demandes_inscription drop constraint if exists demandes_inscription_confirmation_check;
alter table public.demandes_inscription add constraint demandes_inscription_confirmation_check
  check ((confirmation_jeton_hash is null or confirmation_jeton_hash ~ '^[0-9a-f]{64}$')
         and (statut <> 'a_confirmer' or (confirmation_jeton_hash is not null and confirmation_expire_le is not null)));

-- Une seule demande à confirmer ou en attente par adresse (la soumission suivante met à jour la
-- demande à confirmer, ou reçoit le rappel « en cours » ; aucune deuxième ligne).
drop index if exists public.demandes_inscription_email_en_attente;
create unique index if not exists demandes_inscription_email_active
  on public.demandes_inscription (email) where statut in ('a_confirmer', 'en_attente');
create unique index if not exists demandes_inscription_confirmation_jeton
  on public.demandes_inscription (confirmation_jeton_hash) where confirmation_jeton_hash is not null;
create index if not exists demandes_inscription_statut_created
  on public.demandes_inscription (statut, created_at desc);

alter table public.demandes_inscription enable row level security;

revoke all on table public.demandes_inscription from public, anon, authenticated;
-- authenticated : droits de table nécessaires au super-admin (les policies filtrent tout le reste).
-- Mise à jour limitée aux colonnes du refus ; l'acceptation passe par l'Edge Function.
grant select, delete on table public.demandes_inscription to authenticated;
grant update (statut, traitee_par, traitee_le) on table public.demandes_inscription to authenticated;
grant all on table public.demandes_inscription to service_role;

drop policy if exists demandes_inscription_select_super_admin on public.demandes_inscription;
create policy demandes_inscription_select_super_admin on public.demandes_inscription
  for select to authenticated using (coalesce(is_current_user_super_admin(), false));

-- Super-admin : seul le refus d'une demande en attente (en_attente → refusee). Toute autre
-- transition (acceptation, remise en attente) passe par l'Edge Function (service_role).
drop policy if exists demandes_inscription_update_super_admin on public.demandes_inscription;
create policy demandes_inscription_update_super_admin on public.demandes_inscription
  for update to authenticated
  using (coalesce(is_current_user_super_admin(), false) and statut = 'en_attente')
  with check (coalesce(is_current_user_super_admin(), false) and statut = 'refusee');

drop policy if exists demandes_inscription_delete_super_admin on public.demandes_inscription;
create policy demandes_inscription_delete_super_admin on public.demandes_inscription
  for delete to authenticated using (coalesce(is_current_user_super_admin(), false));

-- Pas de policy insert : aucune insertion possible hors service_role (qui contourne la RLS).

-- ---------------------------------------------------------------------------
-- 2. Scopes de limitation
-- ---------------------------------------------------------------------------
alter table public.acces_portefeuille_rate_limits
  drop constraint if exists acces_portefeuille_rate_limits_scope_check;

alter table public.acces_portefeuille_rate_limits
  add constraint acces_portefeuille_rate_limits_scope_check
  check (scope in ('etat', 'pdf', 'verify_pin', 'demande_adhesion', 'reset_mdp_ip', 'reset_mdp_email',
                   'simulation_achat_ip', 'simulation_achat_email',
                   'renouvellement_lecture_ip', 'renouvellement_lecture_lien',
                   'renouvellement_envoi_ip', 'renouvellement_envoi_lien',
                   'inscription_ip', 'inscription_email', 'inscription_confirmation_ip'));

-- ---------------------------------------------------------------------------
-- 3. Soumission (service_role seulement)
-- ---------------------------------------------------------------------------
-- p_demande : champs déjà validés et normalisés par l'Edge Function (les contraintes de la
-- table restent l'autorité). p_jeton_hash : empreinte SHA-256 (hex) du jeton de confirmation
-- tiré par l'Edge Function, enregistrée pour une nouvelle demande ou une demande à confirmer
-- renvoyée (expiration à 48 h). Retour :
--   {ok:false, reason:'ACCES_INVALIDE'|'RATE_LIMIT'}
--   {ok:true, cas:'nouvelle'|'a_confirmer'|'compte_existant'|'en_attente', envoyer_accuse:bool, demande_id?}
-- cas a_confirmer avec envoyer_accuse=false : plafond d'emails atteint, la demande n'est pas
-- modifiée (le lien déjà envoyé reste valable).
drop function if exists public.soumettre_demande_inscription(text, text, jsonb);
create or replace function public.soumettre_demande_inscription(
  p_ip_hash text,
  p_email_hash text,
  p_jeton_hash text,
  p_demande jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_email text := lower(btrim(coalesce(p_demande ->> 'email', '')));
  v_nb integer;
  v_envoyer boolean := true;
  v_id uuid;
begin
  if p_ip_hash is null or p_ip_hash !~ '^[0-9a-f]{64}$'
     or p_email_hash is null or p_email_hash !~ '^[0-9a-f]{64}$'
     or p_jeton_hash is null or p_jeton_hash !~ '^[0-9a-f]{64}$'
     or jsonb_typeof(p_demande) is distinct from 'object' or v_email = '' then
    return jsonb_build_object('ok', false, 'reason', 'ACCES_INVALIDE');
  end if;

  perform pg_advisory_xact_lock(hashtextextended('inscription:ip:' || p_ip_hash, 0));
  perform pg_advisory_xact_lock(hashtextextended('inscription:email:' || p_email_hash, 0));

  delete from public.acces_portefeuille_rate_limits
  where scope in ('inscription_ip', 'inscription_email')
    and ip_hash in (p_ip_hash, p_email_hash)
    and created_at < clock_timestamp() - interval '1 day';

  -- Débit par IP d'abord (5 / heure) : une IP au-delà est refusée sans rien enregistrer, pour
  -- qu'elle ne puisse pas remplir à elle seule le plafond global.
  select count(*) into v_nb
  from public.acces_portefeuille_rate_limits
  where scope = 'inscription_ip'
    and ip_hash = p_ip_hash
    and created_at > clock_timestamp() - interval '1 hour';
  if v_nb >= 5 then
    return jsonb_build_object('ok', false, 'reason', 'RATE_LIMIT');
  end if;

  -- Plafond global quotidien (tentatives enregistrées, toutes IP confondues).
  select count(*) into v_nb
  from public.acces_portefeuille_rate_limits
  where scope = 'inscription_ip'
    and created_at > clock_timestamp() - interval '1 day';
  if v_nb >= 200 then
    return jsonb_build_object('ok', false, 'reason', 'RATE_LIMIT');
  end if;

  insert into public.acces_portefeuille_rate_limits(ip_hash, portefeuille_id, scope)
  values (p_ip_hash, null, 'inscription_ip');

  -- Emails par adresse : 3 / 24 h, au-delà rien n'est envoyé.
  select count(*) into v_nb
  from public.acces_portefeuille_rate_limits
  where scope = 'inscription_email'
    and ip_hash = p_email_hash
    and created_at > clock_timestamp() - interval '1 day';
  if v_nb >= 3 then
    v_envoyer := false;
  else
    insert into public.acces_portefeuille_rate_limits(ip_hash, portefeuille_id, scope)
    values (p_email_hash, null, 'inscription_email');
  end if;

  -- Adresse déjà rattachée à un compte (hors comptes techniques) : rien n'est créé.
  if exists (
    select 1 from auth.users u
    where lower(u.email) = v_email and u.email not like '%@mothana.internal'
  ) then
    return jsonb_build_object('ok', true, 'cas', 'compte_existant', 'envoyer_accuse', v_envoyer);
  end if;

  if exists (select 1 from public.demandes_inscription where email = v_email and statut = 'en_attente') then
    return jsonb_build_object('ok', true, 'cas', 'en_attente', 'envoyer_accuse', v_envoyer);
  end if;

  -- Demande pas encore confirmée : mise à jour (champs saisis, nouveau jeton, nouvelle
  -- expiration) et nouvel email de confirmation. Plafond d'emails atteint : rien ne change, pour
  -- que le dernier lien envoyé reste valable.
  select id into v_id from public.demandes_inscription
  where email = v_email and statut = 'a_confirmer'
  for update;
  if found then
    if v_envoyer then
      update public.demandes_inscription set
        nom_association = btrim(p_demande ->> 'nom_association'),
        ville = btrim(p_demande ->> 'ville'),
        rna = nullif(btrim(coalesce(p_demande ->> 'rna', '')), ''),
        siren = nullif(btrim(coalesce(p_demande ->> 'siren', '')), ''),
        prenom = btrim(p_demande ->> 'prenom'),
        nom = btrim(p_demande ->> 'nom'),
        message = nullif(btrim(coalesce(p_demande ->> 'message', '')), ''),
        cgu_acceptees_le = case when coalesce((p_demande ->> 'cgu_acceptees')::boolean, false) then now() end,
        confirmation_jeton_hash = p_jeton_hash,
        confirmation_expire_le = now() + interval '48 hours'
      where id = v_id;
    end if;
    return jsonb_build_object('ok', true, 'cas', 'a_confirmer', 'envoyer_accuse', v_envoyer, 'demande_id', v_id);
  end if;

  begin
    insert into public.demandes_inscription
      (nom_association, ville, rna, siren, prenom, nom, email, message, cgu_acceptees_le,
       statut, confirmation_jeton_hash, confirmation_expire_le)
    values (
      btrim(p_demande ->> 'nom_association'),
      btrim(p_demande ->> 'ville'),
      nullif(btrim(coalesce(p_demande ->> 'rna', '')), ''),
      nullif(btrim(coalesce(p_demande ->> 'siren', '')), ''),
      btrim(p_demande ->> 'prenom'),
      btrim(p_demande ->> 'nom'),
      v_email,
      nullif(btrim(coalesce(p_demande ->> 'message', '')), ''),
      case when coalesce((p_demande ->> 'cgu_acceptees')::boolean, false) then now() end,
      'a_confirmer',
      p_jeton_hash,
      now() + interval '48 hours'
    )
    returning id into v_id;
  exception when unique_violation then
    -- Course entre deux soumissions de la même adresse (en principe exclue par le verrou sur
    -- l'empreinte de l'adresse) : la première l'emporte, aucun email avec ce jeton non enregistré.
    return jsonb_build_object('ok', true, 'cas', 'a_confirmer', 'envoyer_accuse', false);
  end;

  return jsonb_build_object('ok', true, 'cas', 'nouvelle', 'envoyer_accuse', v_envoyer, 'demande_id', v_id);
end;
$$;

revoke execute on function public.soumettre_demande_inscription(text, text, text, jsonb)
  from public, anon, authenticated;
grant execute on function public.soumettre_demande_inscription(text, text, text, jsonb)
  to service_role;

-- Confirmation de l'adresse (Edge Function publique confirmer-demande-inscription) :
-- p_ip_hash : empreinte HMAC de l'IP (10 essais / heure, puis RATE_LIMIT) ; p_jeton_hash :
-- empreinte SHA-256 (hex) du jeton reçu. Retour :
--   {ok:false, reason:'ACCES_INVALIDE'|'RATE_LIMIT'}
--   {ok:true, cas:'confirmee', demande:{…champs pour la notification}}
--   {ok:true, cas:'deja_confirmee'|'expiree'|'invalide'}
-- Transition atomique : la ligne est verrouillée, et seule une demande a_confirmer au lien non
-- expiré passe en en_attente ; un second appel concurrent attend puis répond deja_confirmee.
create or replace function public.confirmer_demande_inscription(
  p_ip_hash text,
  p_jeton_hash text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_nb integer;
  v_demande public.demandes_inscription%rowtype;
begin
  if p_ip_hash is null or p_ip_hash !~ '^[0-9a-f]{64}$' then
    return jsonb_build_object('ok', false, 'reason', 'ACCES_INVALIDE');
  end if;

  perform pg_advisory_xact_lock(hashtextextended('inscription:confirmation:' || p_ip_hash, 0));
  delete from public.acces_portefeuille_rate_limits
  where scope = 'inscription_confirmation_ip'
    and ip_hash = p_ip_hash
    and created_at < clock_timestamp() - interval '1 day';
  select count(*) into v_nb
  from public.acces_portefeuille_rate_limits
  where scope = 'inscription_confirmation_ip'
    and ip_hash = p_ip_hash
    and created_at > clock_timestamp() - interval '1 hour';
  if v_nb >= 10 then
    return jsonb_build_object('ok', false, 'reason', 'RATE_LIMIT');
  end if;
  insert into public.acces_portefeuille_rate_limits(ip_hash, portefeuille_id, scope)
  values (p_ip_hash, null, 'inscription_confirmation_ip');

  if p_jeton_hash is null or p_jeton_hash !~ '^[0-9a-f]{64}$' then
    return jsonb_build_object('ok', true, 'cas', 'invalide');
  end if;

  select * into v_demande from public.demandes_inscription
  where confirmation_jeton_hash = p_jeton_hash
  for update;
  if not found then
    return jsonb_build_object('ok', true, 'cas', 'invalide');
  end if;
  if v_demande.statut <> 'a_confirmer' then
    return jsonb_build_object('ok', true, 'cas', 'deja_confirmee');
  end if;
  if not coalesce(v_demande.confirmation_expire_le > now(), false) then
    return jsonb_build_object('ok', true, 'cas', 'expiree');
  end if;

  update public.demandes_inscription
  set statut = 'en_attente', confirmee_le = now(), confirmation_expire_le = null
  where id = v_demande.id;

  return jsonb_build_object('ok', true, 'cas', 'confirmee', 'demande', jsonb_build_object(
    'nom_association', v_demande.nom_association,
    'ville', v_demande.ville,
    'rna', v_demande.rna,
    'siren', v_demande.siren,
    'prenom', v_demande.prenom,
    'nom', v_demande.nom,
    'email', v_demande.email,
    'message', v_demande.message));
end;
$$;

revoke execute on function public.confirmer_demande_inscription(text, text)
  from public, anon, authenticated;
grant execute on function public.confirmer_demande_inscription(text, text)
  to service_role;

-- ---------------------------------------------------------------------------
-- 4. Purge : demandes refusées 30 jours après le refus, demandes jamais confirmées 7 jours
--    après l'expiration de leur lien (nom historique conservé, comme le job pg_cron).
-- ---------------------------------------------------------------------------
create or replace function public.purger_demandes_inscription_refusees()
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_nb integer;
begin
  delete from public.demandes_inscription
  where (statut = 'refusee' and coalesce(traitee_le, created_at) < now() - interval '30 days')
     or (statut = 'a_confirmer' and confirmation_expire_le < now() - interval '7 days');
  get diagnostics v_nb = row_count;
  return v_nb;
end;
$$;

revoke execute on function public.purger_demandes_inscription_refusees()
  from public, anon, authenticated;
grant execute on function public.purger_demandes_inscription_refusees()
  to service_role;

commit;

-- Planification quotidienne (hors transaction ; cron.schedule remplace un job existant du même
-- nom, donc rejouable). À appliquer aussi en prod à la promotion.
create extension if not exists pg_cron;
select cron.schedule(
  'purger-demandes-inscription-refusees',
  '23 3 * * *',
  $$select public.purger_demandes_inscription_refusees()$$
);
