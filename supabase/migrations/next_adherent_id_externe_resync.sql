-- Bug trouvé par l'utilisateur (2026-08-25) : création d'un adhérent en échec
-- avec "duplicate key value violates unique constraint
-- adherents_id_externe_unique". Confirmé en base sur "Association Démo
-- Staging" : la séquence adherent_id_externe_seq_<org> en était à 13 alors
-- que le plus grand id_externe numérique réellement présent était 16.
--
-- Cause : next_adherent_id_externe() (cf. next_adherent_id_externe.sql) ne
-- crée la séquence qu'une seule fois, au premier adhérent créé manuellement,
-- à partir du max constaté à cet instant — jamais resynchronisée ensuite.
-- Si des adhérents sont ajoutés après coup avec des id_externe numériques
-- plus élevés sans passer par cette fonction (import en masse via
-- import_upsert_adherents.sql, qui insère l'id_externe fourni par le client
-- sans jamais toucher la séquence), la séquence reste figée et finit par
-- re-proposer un numéro déjà pris. Le cas inverse (création manuelle avant
-- un import) était déjà anticipé ("géré côté import wizard, détection de
-- doublon") ; celui-ci (import puis création manuelle) ne l'était pas.
--
-- Fix : à chaque appel, resynchroniser la séquence sur le vrai max(id_externe)
-- courant si celui-ci a dépassé la séquence (GREATEST, jamais de recul en
-- arrière pour ne pas perturber une numérotation déjà en avance).
create or replace function next_adherent_id_externe(p_organisation_id uuid)
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
  seq_name := 'adherent_id_externe_seq_' || replace(p_organisation_id::text, '-', '_');

  select coalesce(max(id_externe::int), 0)
  into current_max
  from adherents
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
