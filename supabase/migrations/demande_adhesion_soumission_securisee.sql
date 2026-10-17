-- Migration: demande_adhesion_soumission_securisee.sql
-- Cadré 2026-10-17 (carte Trello « Sécurité : le formulaire d'adhésion en ligne
-- et son email de confirmation peuvent être détournés »). Les demandes
-- d'adhésion passent désormais uniquement par l'Edge Function
-- soumettre-demande-adhesion (service_role) :
--   - limite de débit par IP (scope 'demande_adhesion' de la table de comptage
--     déjà utilisée par verify-pin et le porte-monnaie) : 10 soumissions par
--     heure et par empreinte d'IP ;
--   - fin de l'insertion anonyme directe (policy demandes_adhesion_insert_public) ;
--   - fin du trigger pg_net vers send-demande-confirmation (URL et clé de
--     staging en dur, fonction appelable avec un `record` fabriqué) : l'email
--     part maintenant de soumettre-demande-adhesion.
-- Lecture/mise à jour admin et bypass super-admin inchangés.
begin;

alter table public.acces_portefeuille_rate_limits
  drop constraint if exists acces_portefeuille_rate_limits_scope_check;

alter table public.acces_portefeuille_rate_limits
  add constraint acces_portefeuille_rate_limits_scope_check
  check (scope in ('etat', 'pdf', 'verify_pin', 'demande_adhesion'));

create or replace function public.verifier_limite_demande_adhesion(p_ip_hash text)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_attempt_count integer;
begin
  if p_ip_hash is null or p_ip_hash !~ '^[0-9a-f]{64}$' then
    return jsonb_build_object('ok', false, 'reason', 'ACCES_INVALIDE');
  end if;

  -- Sérialise les soumissions concurrentes de la même IP avant le comptage.
  perform pg_advisory_xact_lock(hashtextextended(
    'demande_adhesion:ip:' || p_ip_hash, 0
  ));

  delete from public.acces_portefeuille_rate_limits
  where scope = 'demande_adhesion'
    and ip_hash = p_ip_hash
    and created_at < clock_timestamp() - interval '1 day';

  insert into public.acces_portefeuille_rate_limits(ip_hash, portefeuille_id, scope)
  values (p_ip_hash, null, 'demande_adhesion');

  select count(*) into v_attempt_count
  from public.acces_portefeuille_rate_limits
  where scope = 'demande_adhesion'
    and ip_hash = p_ip_hash
    and created_at > clock_timestamp() - interval '1 hour';

  if v_attempt_count > 10 then
    return jsonb_build_object('ok', false, 'reason', 'RATE_LIMIT');
  end if;

  return jsonb_build_object('ok', true);
end;
$$;

revoke execute on function public.verifier_limite_demande_adhesion(text)
  from public, anon, authenticated;
grant execute on function public.verifier_limite_demande_adhesion(text)
  to service_role;

drop policy if exists demandes_adhesion_insert_public on public.demandes_adhesion;

drop trigger if exists trg_demandes_adhesion_send_confirmation on public.demandes_adhesion;
drop function if exists public.notify_send_demande_confirmation();

commit;
