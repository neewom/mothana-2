-- Migration: recus_lecture_seule.sql
-- Cadré 2026-10-24 (audit sécurité). Un reçu fiscal émis n'est plus modifiable ni supprimable
-- depuis le client : lecture seule pour les membres de l'organisation (+ super-admin) ; toutes
-- les écritures passent par les Edge Functions en service_role (generate-recu, send-recu-email).
-- Aucune écriture client n'existait. Pas de trigger d'immutabilité (il casserait l'upsert de
-- régénération de generate-recu) : carte séparée.
begin;

drop policy if exists recus_all_admin on public.recus_fiscaux;

create policy recus_select on public.recus_fiscaux
  for select
  to authenticated
  using (
    organisation_id = (select public.current_user_organisation_id())
    or ((select auth.jwt()) -> 'app_metadata' ->> 'is_super_admin')::boolean = true
  );

revoke insert, update, delete, truncate on public.recus_fiscaux from anon, authenticated;

commit;
