-- Trouvé en développant Coupon 13 (accès vendeur) : next_adherent_id_externe
-- et next_participant_id_externe n'avaient aucune garde interne sur
-- p_organisation_id et étaient grantées à `authenticated` en bloc (durcies
-- une première fois le 2026-09-22 côté grants, mais pas en interne) — tout
-- compte authentifié, y compris un futur compte vendeur qui n'a jamais
-- légitimement besoin de ces RPC, pouvait avancer la numérotation
-- adhérents/donateurs de n'importe quelle organisation. Seuls
-- AdherentModal.tsx et ParticipantModal.tsx les appellent, tous deux
-- admin-only (jamais depuis l'espace bénévole) : restreint à l'admin de
-- l'organisation ciblée (ou au super-admin), même garde que
-- creer_credit_manuel.
create or replace function next_adherent_id_externe(p_organisation_id uuid)
returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  seq_name text;
  next_val bigint;
  depart integer;
begin
  if auth.uid() is null or not coalesce(
    public.is_current_user_super_admin()
    or p_organisation_id = public.current_user_organisation_id(),
    false
  ) then
    raise exception 'ACCES_INTERDIT' using errcode = '42501';
  end if;

  seq_name := 'adherent_id_externe_seq_' || replace(p_organisation_id::text, '-', '_');

  if not exists (select 1 from pg_sequences where schemaname = 'public' and sequencename = seq_name) then
    select coalesce(max(id_externe::int), 0) + 1
    into depart
    from adherents
    where organisation_id = p_organisation_id
      and id_externe ~ '^[0-9]+$';

    execute format('create sequence public.%I start %s', seq_name, depart);
  end if;

  execute format('select nextval(%L)', 'public.' || seq_name) into next_val;
  return next_val::text;
end;
$$;

create or replace function next_participant_id_externe(p_organisation_id uuid)
returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  seq_name text;
  next_val bigint;
  current_max integer;
begin
  if auth.uid() is null or not coalesce(
    public.is_current_user_super_admin()
    or p_organisation_id = public.current_user_organisation_id(),
    false
  ) then
    raise exception 'ACCES_INTERDIT' using errcode = '42501';
  end if;

  seq_name := 'participant_id_externe_seq_' || replace(p_organisation_id::text, '-', '_');

  select coalesce(max(id_externe::int), 0)
  into current_max
  from profils_participant
  where organisation_id = p_organisation_id
    and id_externe ~ '^[0-9]+$';

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
