-- Refonte Cerfa (§1.5 docs/brief-cerfa.md) : numérotation atomique et sans
-- doublon des reçus fiscaux, par organisation et par année. Une séquence
-- Postgres dédiée est créée à la volée pour chaque (organisation, année),
-- démarrée au numéro de départ configuré dans modele_recu_pdf.numero_recu_depart
-- (défaut 1). org_id est de type uuid (pas du texte libre) : la construction
-- dynamique du nom de séquence via format() ne présente pas de risque
-- d'injection SQL.
create or replace function next_numero_recu(org_id uuid, annee integer)
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
  seq_name := 'recu_seq_' || replace(org_id::text, '-', '_') || '_' || annee;

  -- Créer la séquence si elle n'existe pas encore pour cette année
  if not exists (select 1 from pg_sequences where schemaname = 'public' and sequencename = seq_name) then
    -- Récupérer le numéro de départ configuré dans l'organisation
    select coalesce((modele_recu_pdf->>'numero_recu_depart')::integer, 1)
    into depart
    from organisations where id = org_id;

    execute format('create sequence public.%I start %s', seq_name, depart);
  end if;

  execute format('select nextval(%L)', 'public.' || seq_name) into next_val;
  return annee || '-' || lpad(next_val::text, 3, '0');
end;
$$;
