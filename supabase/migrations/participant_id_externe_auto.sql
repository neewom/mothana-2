-- Blocage trouvé en testant la PR #320 (format de numéro de reçu « année +
-- numéro de donateur ») : un donateur sans profils_participant.id_externe ne
-- peut pas recevoir de reçu dans ce format. Le numéro n'était attribué que par
-- ParticipantModal (RPC next_participant_id_externe, réservée à l'admin) et
-- l'import ; pas pour un donateur créé depuis l'espace bénévole (insert
-- direct, refusé par la garde de la RPC), par transposition d'un adhérent
-- (adherentTranspose.ts) ni par le jeu de démo (demoOrgSeed.ts).
--
-- Correctif : attribution en base, par un trigger BEFORE INSERT, avec la même
-- séquence par organisation que next_participant_id_externe
-- (participant_id_externe_seq_<org>, resynchronisée sur le plus grand
-- id_externe numérique existant). Un id_externe fourni explicitement (import,
-- ParticipantModal) n'est jamais modifié. Puis rattrapage des donateurs
-- existants sans numéro. Ré-exécutable.

-- Fonction interne : pas de garde utilisateur (appelée uniquement par le
-- trigger, dans un insert déjà autorisé par la RLS, et par le rattrapage).
-- Non exécutable par anon/authenticated.
create or replace function public.attribuer_participant_id_externe(p_organisation_id uuid)
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
  seq_name := 'participant_id_externe_seq_' || replace(p_organisation_id::text, '-', '_');

  select coalesce(max(id_externe::bigint), 0)
  into current_max
  from profils_participant
  where organisation_id = p_organisation_id
    and id_externe ~ '^[0-9]{1,18}$';

  if not exists (select 1 from pg_sequences where schemaname = 'public' and sequencename = seq_name) then
    -- if not exists : deux premiers inserts concurrents d'une même organisation
    execute format('create sequence if not exists public.%I start %s', seq_name, current_max + 1);
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

revoke execute on function public.attribuer_participant_id_externe(uuid) from public, anon, authenticated;
grant execute on function public.attribuer_participant_id_externe(uuid) to service_role;

create or replace function public.profils_participant_attribuer_id_externe()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_existant text;
begin
  if nullif(btrim(new.id_externe), '') is not null or new.organisation_id is null then
    return new;
  end if;

  -- Upsert (import : on conflict (id) do update set id_externe = excluded.id_externe)
  -- d'un donateur déjà numéroté sans numéro fourni : excluded porte la valeur
  -- posée ici, on reprend donc le numéro existant plutôt que d'en brûler un neuf.
  select pp.id_externe into v_existant
  from profils_participant pp
  where pp.id = new.id and pp.organisation_id = new.organisation_id;

  if nullif(btrim(v_existant), '') is not null then
    new.id_externe := v_existant;
  else
    new.id_externe := public.attribuer_participant_id_externe(new.organisation_id);
  end if;
  return new;
end;
$$;

revoke execute on function public.profils_participant_attribuer_id_externe() from public, anon, authenticated;

drop trigger if exists profils_participant_attribuer_id_externe on public.profils_participant;
create trigger profils_participant_attribuer_id_externe
  before insert on public.profils_participant
  for each row execute function public.profils_participant_attribuer_id_externe();

-- Rattrapage : chaque donateur sans numéro, organisation par organisation,
-- dans l'ordre created_at puis id, à la suite du plus grand numéro (la
-- fonction resynchronise la séquence à chaque appel, elle reste donc calée).
do $$
declare
  r record;
begin
  for r in
    select id, organisation_id
    from public.profils_participant
    where nullif(btrim(id_externe), '') is null
    order by organisation_id, created_at, id
  loop
    update public.profils_participant
    set id_externe = public.attribuer_participant_id_externe(r.organisation_id)
    where id = r.id;
  end loop;
end;
$$;
