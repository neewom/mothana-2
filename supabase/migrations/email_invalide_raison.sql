-- Migration: email_invalide_raison.sql
-- Cadré 2026-10-23 (carte Trello « Emailing : ne plus marquer les destinataires
-- « Email invalide » sur une erreur d'expéditeur »). Le marquage d'une adresse
-- rejetée conserve désormais l'événement Brevo (normalisé : hard_bounce,
-- invalid_email, blocked, error) et la raison fournie par Brevo, affichés sur la
-- fiche adhérent. Les deux colonnes sont effacées avec email_invalide_at quand le
-- courriel change (trigger existant, repris de sa définition en place sur
-- staging, 2026-10-23 ; CREATE OR REPLACE, droits inchangés).
begin;

alter table public.adherents
  add column email_invalide_evenement text,
  add column email_invalide_raison text;

comment on column public.adherents.email_invalide_evenement is 'Événement à l''origine du marquage email_invalide_at (Brevo : hard_bounce, invalid_email, blocked, error ; confirmation_demande : rejet Resend de la confirmation de demande d''adhésion).';
comment on column public.adherents.email_invalide_raison is 'Raison du rejet telle que fournie par Brevo (texte libre, peut être nulle).';

CREATE OR REPLACE FUNCTION public.reset_adherent_email_invalide()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  IF NEW.courriel IS DISTINCT FROM OLD.courriel THEN
    NEW.email_invalide_at := NULL;
    NEW.email_invalide_evenement := NULL;
    NEW.email_invalide_raison := NULL;
  END IF;
  RETURN NEW;
END;
$function$;

commit;
