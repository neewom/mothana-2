-- Numéro d'adhérent : resynchronisation + verrou (carte ToVUikT1, relevée en
-- développant la PR #326).
--
-- Après un import d'adhérents numérotés, une création manuelle pouvait tirer
-- un numéro déjà pris (« duplicate key adherents_id_externe_unique ») : la
-- resynchronisation de next_adherent_id_externe_resync.sql a été écrasée par
-- next_id_externe_organisation_guard.sql (2026-10-01), qui a repris l'ancienne
-- version sans GREATEST. attribuer_numero_adherent (adhesion_benevole.sql)
-- avait gardé la resynchronisation mais sans verrou.
--
-- Correctif, sur le modèle exact des numéros de donateur
-- (participant_id_externe_auto.sql) :
-- - les deux fonctions relisent le plus grand numéro numérique existant
--   (bigint, 1 à 18 chiffres ; l'ancien cast ::int échouait au-delà de 2^31)
--   et recalent la séquence dessus, jamais en arrière ;
-- - elles prennent le même verrou consultatif transactionnel, clé = nom de la
--   séquence de l'organisation : deux attributions simultanées dans une même
--   organisation sont sérialisées (la seconde attend le commit de la première,
--   relit le max à jour, et ne peut ni tirer le même numéro ni échouer sur la
--   création concurrente de la séquence).
-- Garde, signatures et droits inchangés (create or replace conserve les
-- grants ; ils sont réaffirmés ci-dessous). Aucune donnée modifiée : la
-- séquence se recale au prochain appel. Ré-exécutable.

-- RPC appelée par AdherentModal (création manuelle, ratification d'une
-- demande) et par l'import (collision « Créer un nouveau »).
create or replace function public.next_adherent_id_externe(p_organisation_id uuid)
returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  seq_name text;
  next_val bigint;
  current_max bigint;
begin
  if auth.uid() is null or not coalesce(
    public.is_current_user_super_admin()
    or p_organisation_id = public.current_user_organisation_id(),
    false
  ) then
    raise exception 'ACCES_INTERDIT' using errcode = '42501';
  end if;

  seq_name := 'adherent_id_externe_seq_' || replace(p_organisation_id::text, '-', '_');
  perform pg_advisory_xact_lock(hashtext(seq_name));

  select coalesce(max(id_externe::bigint), 0)
  into current_max
  from adherents
  where organisation_id = p_organisation_id
    and id_externe ~ '^[0-9]{1,18}$';

  if not exists (select 1 from pg_sequences where schemaname = 'public' and sequencename = seq_name) then
    -- Création sérialisée par le verrou consultatif ci-dessus.
    execute format('create sequence public.%I start %s', seq_name, current_max + 1);
  else
    execute format(
      'select setval(%L, GREATEST(last_value, %s)) from public.%I',
      'public.' || seq_name, current_max, seq_name
    );
  end if;

  execute format('select nextval(%L)', 'public.' || seq_name) into next_val;
  return next_val::text;
end;
$$;

revoke execute on function public.next_adherent_id_externe(uuid) from public, anon;
grant execute on function public.next_adherent_id_externe(uuid) to authenticated, service_role;

-- Fonction interne de l'adhésion saisie par un bénévole : même séquence et
-- même verrou que next_adherent_id_externe, sans sa garde utilisateur (qui
-- refuse le bénévole). Non exécutable par anon/authenticated.
create or replace function public.attribuer_numero_adherent(p_organisation_id uuid)
returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  seq_name text := 'adherent_id_externe_seq_' || replace(p_organisation_id::text, '-', '_');
  current_max bigint;
  next_val bigint;
begin
  perform pg_advisory_xact_lock(hashtext(seq_name));

  select coalesce(max(id_externe::bigint), 0)
  into current_max
  from public.adherents
  where organisation_id = p_organisation_id
    and id_externe ~ '^[0-9]{1,18}$';

  if not exists (select 1 from pg_sequences where schemaname = 'public' and sequencename = seq_name) then
    execute format('create sequence public.%I start %s', seq_name, current_max + 1);
  else
    execute format(
      'select setval(%L, GREATEST(last_value, %s)) from public.%I',
      'public.' || seq_name, current_max, seq_name
    );
  end if;

  execute format('select nextval(%L)', 'public.' || seq_name) into next_val;
  return next_val::text;
end;
$$;

revoke all on function public.attribuer_numero_adherent(uuid) from public, anon, authenticated;
