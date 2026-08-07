-- Incrémentation automatique de l'id_externe à la création manuelle d'un
-- adhérent (jusqu'ici seulement renseigné par l'import, jamais par le
-- formulaire AdherentModal). Même pattern que next_numero_recu() : une
-- séquence Postgres dédiée par organisation, créée à la volée, garantit
-- l'atomicité en cas de créations concurrentes.
--
-- Point de départ : max(id_externe::int) + 1 sur les id_externe déjà
-- purement numériques de l'organisation (import legacy), pas 1 — pour
-- prolonger la numérotation existante plutôt que la chevaucher.
--
-- Décision produit (2026-08-07) : on garde une numérotation strictement
-- continue plutôt qu'un palier haut ou un préfixe non numérique, pour rester
-- cohérent avec le pattern de numérotation propre à chaque organisation.
-- Le risque de collision avec un futur réimport (l'organisation saisit un
-- adhérent dans Mothana avant qu'il soit importé depuis la base source) est
-- géré côté import wizard (détection de collision/doublon) et côté
-- organisationnel (consigne de ne plus saisir en double, ou de corriger les
-- id_externe avant/pendant un réimport).
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
