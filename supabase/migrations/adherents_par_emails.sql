-- Rebonds Brevo : retrouver les adhérents d'une organisation par adresse, insensible à la casse
-- et aux espaces de bord (carte Trello WKQ93NUP), sur le modèle exact de
-- profils_donateur_par_emails (recus_email_brevo.sql). Utilisée par brevo-bounce-webhook, qui
-- marque ensuite les adhérents trouvés par id, toujours filtrés par l'organisation authentifiée.
-- Réservée au service_role. Aucune donnée existante modifiée. Ré-exécutable.
begin;

create or replace function public.adherents_par_emails(p_organisation_id uuid, p_emails text[])
returns table (adherent_id uuid, email_normalise text)
language sql
stable
security invoker
set search_path = ''
as $$
  select a.id, lower(btrim(a.courriel, E' \t\r\n'))
  from public.adherents a
  where a.organisation_id = p_organisation_id
    and a.courriel is not null
    and lower(btrim(a.courriel, E' \t\r\n')) in (select lower(btrim(e, E' \t\r\n')) from unnest(p_emails) as e);
$$;

revoke execute on function public.adherents_par_emails(uuid, text[]) from public, anon, authenticated;
grant execute on function public.adherents_par_emails(uuid, text[]) to service_role;

commit;
