-- Commentaires des colonnes email_invalide_evenement : ajout de soft_bounce (Brevo, domaine du
-- destinataire introuvable, carte Trello tr1BGQ5M, 2026-11-08). Aucun changement de schéma ni de
-- données. Ré-exécutable.
begin;

comment on column public.adherents.email_invalide_evenement is 'Événement à l''origine du marquage email_invalide_at (Brevo : hard_bounce, soft_bounce (domaine introuvable uniquement), invalid_email, blocked, error ; confirmation_demande : rejet Resend de la confirmation de demande d''adhésion).';

comment on column public.profils_participant.email_invalide_evenement is
  'Événement Brevo à l''origine du marquage (hard_bounce, soft_bounce (domaine introuvable uniquement), invalid_email, blocked, error).';

commit;
