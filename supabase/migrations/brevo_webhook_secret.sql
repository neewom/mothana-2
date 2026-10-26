-- Migration: brevo_webhook_secret.sql
-- Audit sécurité 2026-10-24, carte « Fonctions publiques » (https://trello.com/c/UOFogrry), partie 5b.
-- brevo-bounce-webhook est public (Brevo ne signe pas ses webhooks) et ne vérifiait que
-- ?org=<uuid> : n'importe qui pouvait marquer des adresses d'adhérents comme invalides, ce qui
-- les exclut des campagnes. Chaque organisation reçoit un secret aléatoire, ajouté à l'URL du
-- webhook par register-brevo-webhook et vérifié par brevo-bounce-webhook. Comme les autres
-- secrets, il vit dans organisation_secrets (aucune policy : service_role uniquement).
alter table public.organisation_secrets
  add column if not exists brevo_webhook_secret text
  check (brevo_webhook_secret is null or brevo_webhook_secret ~ '^[0-9a-f]{64}$');
