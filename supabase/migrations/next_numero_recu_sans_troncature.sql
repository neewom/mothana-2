-- Migration: next_numero_recu_sans_troncature.sql
-- 2026-11-04 (PR #343, bloquant trouvé au test de charge, PR doc #344).
-- lpad(x, 3, '0') TRONQUE une chaîne plus longue que 3 caractères : le 1 000e reçu d'une année
-- recevait « AAAA-100 » (numéro faux, déjà porté par le 100e reçu), puis l'index unique
-- (organisation_id, numero_ordre) refusait tous les suivants. Le remplissage à 3 chiffres est
-- conservé (2026-001 … 2026-999), au-delà le numéro est rendu en entier (2026-1000, 2026-1001…).
-- Signature, security definer, search_path et droits (rpc_execute_grants_hardening.sql :
-- service_role seul) inchangés : create or replace conserve les droits existants.
-- Les reçus déjà émis ne sont pas touchés (numéros immuables).
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
  -- Au moins 3 chiffres, jamais de troncature au-delà de 999.
  return annee || '-' || lpad(next_val::text, greatest(3, length(next_val::text)), '0');
end;
$$;
