-- Migration: simuler_achat_evenement_rate_limit.sql
-- Audit sécurité 2026-10-24, carte « Sécurité : limiter simuler-achat-evenement »
-- (https://trello.com/c/TiHLIvVR). simuler-achat-evenement est public : sans limite, n'importe
-- qui peut lui faire générer un PDF et envoyer un email Samakan vers n'importe quelle adresse.
-- Deux limites, sur la table de limitation déjà utilisée par verify-pin, la demande d'adhésion
-- et la réinitialisation de mot de passe (modèle : request_password_reset_rate_limit.sql) :
--   - par IP (empreinte HMAC) : 5 achats simulés / heure ;
--   - par adresse (empreinte HMAC de l'email normalisé) : 3 achats simulés / jour.
-- Au-delà de l'une ou l'autre, la fonction répond 429 sans rien créer ni envoyer.
-- Une demande refusée par l'IP n'est pas comptée contre l'adresse, et inversement une demande
-- refusée par l'adresse reste comptée contre l'IP (anti-énumération en rafale).
begin;

alter table public.acces_portefeuille_rate_limits
  drop constraint if exists acces_portefeuille_rate_limits_scope_check;

alter table public.acces_portefeuille_rate_limits
  add constraint acces_portefeuille_rate_limits_scope_check
  check (scope in ('etat', 'pdf', 'verify_pin', 'demande_adhesion', 'reset_mdp_ip', 'reset_mdp_email',
                   'simulation_achat_ip', 'simulation_achat_email'));

create or replace function public.verifier_limite_simulation_achat(p_ip_hash text, p_email_hash text)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_nb_ip integer;
  v_nb_email integer;
begin
  if p_ip_hash is null or p_ip_hash !~ '^[0-9a-f]{64}$'
     or p_email_hash is null or p_email_hash !~ '^[0-9a-f]{64}$' then
    return jsonb_build_object('ok', false, 'reason', 'ACCES_INVALIDE');
  end if;

  perform pg_advisory_xact_lock(hashtextextended('simulation_achat:ip:' || p_ip_hash, 0));
  perform pg_advisory_xact_lock(hashtextextended('simulation_achat:email:' || p_email_hash, 0));

  delete from public.acces_portefeuille_rate_limits
  where scope in ('simulation_achat_ip', 'simulation_achat_email')
    and ip_hash in (p_ip_hash, p_email_hash)
    and created_at < clock_timestamp() - interval '2 days';

  insert into public.acces_portefeuille_rate_limits(ip_hash, portefeuille_id, scope)
  values (p_ip_hash, null, 'simulation_achat_ip');

  select count(*) into v_nb_ip
  from public.acces_portefeuille_rate_limits
  where scope = 'simulation_achat_ip'
    and ip_hash = p_ip_hash
    and created_at > clock_timestamp() - interval '1 hour';

  if v_nb_ip > 5 then
    return jsonb_build_object('ok', false, 'reason', 'RATE_LIMIT');
  end if;

  select count(*) into v_nb_email
  from public.acces_portefeuille_rate_limits
  where scope = 'simulation_achat_email'
    and ip_hash = p_email_hash
    and created_at > clock_timestamp() - interval '1 day';

  if v_nb_email >= 3 then
    return jsonb_build_object('ok', false, 'reason', 'RATE_LIMIT');
  end if;

  insert into public.acces_portefeuille_rate_limits(ip_hash, portefeuille_id, scope)
  values (p_email_hash, null, 'simulation_achat_email');

  return jsonb_build_object('ok', true);
end;
$$;

revoke execute on function public.verifier_limite_simulation_achat(text, text)
  from public, anon, authenticated;
grant execute on function public.verifier_limite_simulation_achat(text, text)
  to service_role;

commit;
