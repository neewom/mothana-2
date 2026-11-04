-- Migration: recus_email_brevo.sql
-- 2026-11-04 (carte https://trello.com/c/RVdWXFH1, « Reçus en lot 3/5 »). send-recu-email envoie par
-- le compte Brevo de l'organisation, Resend en secours.
--   1. recus_fiscaux.email_canal : canal du dernier envoi par email ('brevo' ou 'resend'). Posé sur la
--      fiche du reçu (modifiable) et non sur recus_fiscaux_versions, immuable sauf email_envoye_le.
--   2. Rebonds d'un email de reçu : marqués sur le profil du donateur dans l'organisation
--      (profils_participant), pas sur la personne, partagée entre organisations — un webhook Brevo
--      authentifié pour une organisation ne doit rien écrire chez une autre. Mêmes colonnes que
--      adherents (email_invalide_at / _evenement / _raison), effacées quand l'email de la personne
--      change (comme le trigger reset_adherent_email_invalide pour adherents.courriel).
--   3. profils_donateur_par_emails : repli du webhook (rejet sans tag de profil) qui retrouve les
--      profils d'une organisation par adresse, insensible à la casse et aux espaces de bord
--      (relecture PR #339). Réservée au service_role.
-- Les policies existantes de profils_participant (bypass super-admin compris) couvrent les nouvelles
-- colonnes ; recus_fiscaux n'est écrit que par le service_role. Ré-exécutable.
begin;

alter table public.recus_fiscaux
  add column if not exists email_canal text;

alter table public.recus_fiscaux
  drop constraint if exists recus_fiscaux_email_canal_check;
alter table public.recus_fiscaux
  add constraint recus_fiscaux_email_canal_check check (email_canal is null or email_canal in ('brevo', 'resend'));

comment on column public.recus_fiscaux.email_canal is
  'Canal du dernier envoi par email (send-recu-email) : brevo (compte Brevo de l''organisation) ou resend (secours Samakan).';

alter table public.profils_participant
  add column if not exists email_invalide_at timestamptz,
  add column if not exists email_invalide_evenement text,
  add column if not exists email_invalide_raison text;

comment on column public.profils_participant.email_invalide_at is
  'Posé par brevo-bounce-webhook quand un email de reçu fiscal envoyé par le Brevo de l''organisation est rejeté. Effacé quand l''email de la personne change.';
comment on column public.profils_participant.email_invalide_evenement is
  'Événement Brevo à l''origine du marquage (hard_bounce, invalid_email, blocked, error).';
comment on column public.profils_participant.email_invalide_raison is
  'Raison du rejet fournie par Brevo (texte libre, peut être nulle).';

-- Effacement à tous les profils de la personne : l'adresse est portée par la personne, partagée.
-- security definer : l'auteur de la modification ne voit que les profils de son organisation (RLS).
create or replace function public.reset_profil_email_invalide()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.email is distinct from old.email then
    update public.profils_participant
      set email_invalide_at = null, email_invalide_evenement = null, email_invalide_raison = null
      where personne_id = new.id and email_invalide_at is not null;
  end if;
  return new;
end;
$$;

revoke execute on function public.reset_profil_email_invalide() from public, anon, authenticated;

drop trigger if exists trg_personnes_reset_email_invalide on public.personnes;
create trigger trg_personnes_reset_email_invalide
  after update of email on public.personnes
  for each row
  execute function public.reset_profil_email_invalide();

-- Profils de l'organisation dont la personne a l'une de ces adresses, comparées sur
-- lower(btrim(...)) des deux côtés (espaces, tabulations, retours à la ligne). email_normalise permet à l'appelant de retrouver l'événement.
-- security invoker et exécution réservée au service_role (brevo-bounce-webhook) : pas de garde
-- d'identité à écrire, aucune session utilisateur ne peut l'appeler.
create or replace function public.profils_donateur_par_emails(p_organisation_id uuid, p_emails text[])
returns table (profil_id uuid, email_normalise text)
language sql
stable
security invoker
set search_path = ''
as $$
  select pp.id, lower(btrim(pe.email, E' \t\r\n'))
  from public.profils_participant pp
  join public.personnes pe on pe.id = pp.personne_id
  where pp.organisation_id = p_organisation_id
    and pe.email is not null
    and lower(btrim(pe.email, E' \t\r\n')) in (select lower(btrim(e, E' \t\r\n')) from unnest(p_emails) as e);
$$;

revoke execute on function public.profils_donateur_par_emails(uuid, text[]) from public, anon, authenticated;
grant execute on function public.profils_donateur_par_emails(uuid, text[]) to service_role;

commit;
