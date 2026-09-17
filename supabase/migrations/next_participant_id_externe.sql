-- Cadré 2026-09-15 (carte Trello "Cerfa : ajouter le placeholder numero de
-- donateur"), relance le sujet abandonné le 2026-07-20
-- (profils_participant.id_externe trop peu fiable, non renseigné hors
-- import) — reprend pour les donateurs le même pattern que
-- next_adherent_id_externe (next_adherent_id_externe_resync.sql), resync
-- inclus dès le départ plutôt que découverte après coup comme pour les
-- adhérents.
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
