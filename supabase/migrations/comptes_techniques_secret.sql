-- Migration: comptes_techniques_secret.sql
-- Cadré 2026-10-24 (audit sécurité, carte Trello « Comptes bénévole/vendeur : secret distinct
-- du PIN + rotation réelle »). Le mot de passe des comptes techniques
-- (benevole-<org>@mothana.internal, vendeur-<org>@mothana.internal) valait le PIN : deviner le
-- PIN directement sur l'auth Supabase ouvrait une session, hors de la limite de verify-pin.
-- verify-pin ouvre désormais la session par un lien magique admin (generateLink + verifyOtp),
-- sans mot de passe ; le mot de passe devient un aléa jamais conservé.
begin;

-- 1. Neutralisation immédiate des mots de passe existants (= PIN) : aléa de 32 octets, haché
-- bcrypt, que personne ne connaît. Idempotent (rejouable à la promotion, à rejouer en prod).
update auth.users
set encrypted_password = extensions.crypt(encode(extensions.gen_random_bytes(32), 'hex'), extensions.gen_salt('bf'))
-- Motif strict (rôle + UUID d'organisation + domaine interne) : aucun compte admin ne peut
-- correspondre.
where email ~ '^(benevole|vendeur)-[0-9a-f-]{36}@mothana\.internal$';

-- 2. Rotation du PIN (update-pin) : retrouve le compte technique par son email (sans
-- auth.admin.listUsers, paginé) et révoque ses sessions (les refresh tokens suivent par
-- cascade). Un access token déjà émis reste valable jusqu'à son expiration.
create or replace function public.revoquer_sessions_compte_technique(p_email text)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_id uuid;
begin
  if p_email is null or p_email !~ '^(benevole|vendeur)-[0-9a-f-]{36}@mothana\.internal$' then
    raise exception 'COMPTE_TECHNIQUE_INVALIDE' using errcode = '22023';
  end if;
  select id into v_id from auth.users where email = p_email;
  if v_id is not null then
    delete from auth.sessions where user_id = v_id;
  end if;
  return v_id;
end;
$$;

revoke all on function public.revoquer_sessions_compte_technique(text) from public, anon, authenticated;
grant execute on function public.revoquer_sessions_compte_technique(text) to service_role;

commit;
