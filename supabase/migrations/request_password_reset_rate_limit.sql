-- Migration: request_password_reset_rate_limit.sql
-- Audit sécurité 2026-10-24, carte « Fonctions publiques » (https://trello.com/c/UOFogrry).
-- request-password-reset est public et n'avait aucune limite : envoi en rafale d'emails de
-- réinitialisation vers un admin, épuisement du quota Resend. Deux limites, sur la table de
-- limitation déjà utilisée par verify-pin et la demande d'adhésion :
--   - par IP (empreinte HMAC) : 5 demandes / 15 min, au-delà la fonction répond 429 ;
--   - par adresse (empreinte HMAC de l'email normalisé) : 3 envois / heure, au-delà la
--     demande est acceptée mais aucun email n'est envoyé (réponse identique : pas
--     d'énumération possible).
begin;

alter table public.acces_portefeuille_rate_limits
  drop constraint if exists acces_portefeuille_rate_limits_scope_check;

alter table public.acces_portefeuille_rate_limits
  add constraint acces_portefeuille_rate_limits_scope_check
  check (scope in ('etat', 'pdf', 'verify_pin', 'demande_adhesion', 'reset_mdp_ip', 'reset_mdp_email'));

create or replace function public.verifier_limite_reset_mdp(p_ip_hash text, p_email_hash text)
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

  perform pg_advisory_xact_lock(hashtextextended('reset_mdp:ip:' || p_ip_hash, 0));
  perform pg_advisory_xact_lock(hashtextextended('reset_mdp:email:' || p_email_hash, 0));

  delete from public.acces_portefeuille_rate_limits
  where scope in ('reset_mdp_ip', 'reset_mdp_email')
    and ip_hash in (p_ip_hash, p_email_hash)
    and created_at < clock_timestamp() - interval '1 day';

  insert into public.acces_portefeuille_rate_limits(ip_hash, portefeuille_id, scope)
  values (p_ip_hash, null, 'reset_mdp_ip');

  select count(*) into v_nb_ip
  from public.acces_portefeuille_rate_limits
  where scope = 'reset_mdp_ip'
    and ip_hash = p_ip_hash
    and created_at > clock_timestamp() - interval '15 minutes';

  if v_nb_ip > 5 then
    return jsonb_build_object('ok', false, 'reason', 'RATE_LIMIT');
  end if;

  select count(*) into v_nb_email
  from public.acces_portefeuille_rate_limits
  where scope = 'reset_mdp_email'
    and ip_hash = p_email_hash
    and created_at > clock_timestamp() - interval '1 hour';

  if v_nb_email >= 3 then
    return jsonb_build_object('ok', true, 'envoyer', false);
  end if;

  insert into public.acces_portefeuille_rate_limits(ip_hash, portefeuille_id, scope)
  values (p_email_hash, null, 'reset_mdp_email');

  return jsonb_build_object('ok', true, 'envoyer', true);
end;
$$;

revoke execute on function public.verifier_limite_reset_mdp(text, text)
  from public, anon, authenticated;
grant execute on function public.verifier_limite_reset_mdp(text, text)
  to service_role;

commit;
