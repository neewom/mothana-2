-- Migration: organisation_secrets_retrait_colonnes.sql (2/2)
-- Suite de organisation_secrets.sql, à appliquer APRÈS le déploiement des Edge Functions
-- (verify-pin, update-pin, send-mailing-brevo, register-brevo-webhook) et du front qui lisent
-- organisation_secrets : les secrets quittent définitivement `organisations`.
begin;

drop trigger if exists trg_organisations_synchroniser_secrets on public.organisations;
drop function if exists public.synchroniser_secrets_organisation();

alter table public.organisations
  drop column if exists brevo_api_key,
  drop column if exists code_pin_benevole,
  drop column if exists code_pin_vendeur_evenement;

commit;
