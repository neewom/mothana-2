-- Migration: demande_adhesion_confirmation_webhook.sql
-- Cadré 2026-09-06 (carte "Détection d'emails adhérents invalides") :
-- aujourd'hui l'insert dans demandes_adhesion se fait en direct côté client
-- (DemandeAdhesionPage.tsx), aucun email n'est envoyé. Ce trigger appelle
-- l'edge function send-demande-confirmation juste après l'insert.
--
-- ⚠️ URL + clé publishable ("anon key") spécifiques à CE projet Supabase
-- (mothana-staging) — à adapter à la valeur du projet prod au moment de la
-- promotion dev → main (même geste manuel que les autres différences déjà
-- gérées à ce moment-là, cf. docs/environnement-recette.md). La clé
-- publishable n'est pas un secret (déjà exposée côté client, protégée par
-- RLS et non par confidentialité) — seul son rôle ici est de satisfaire la
-- vérification JWT par défaut de l'edge function (même pattern que
-- unsubscribe-mailing, appelé depuis une page publique avec cette même clé).
--
-- Utilise pg_net directement (pas supabase_functions.http_request, qui
-- suppose la fonctionnalité "Database Webhooks" déjà activée côté dashboard
-- — pas le cas sur ce projet) : même mécanisme sous le capot (net.http_post,
-- appel HTTP asynchrone, non bloquant pour la transaction).

CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

CREATE OR REPLACE FUNCTION notify_send_demande_confirmation()
RETURNS trigger AS $$
BEGIN
  PERFORM net.http_post(
    url := 'https://cxngcmvxktddhyxboyyx.supabase.co/functions/v1/send-demande-confirmation',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer sb_publishable_AWaowED0Bswpl-e8wyIcfQ_tcwQcX-S'
    ),
    body := jsonb_build_object('record', to_jsonb(NEW))
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = extensions, public;

CREATE TRIGGER trg_demandes_adhesion_send_confirmation
  AFTER INSERT ON demandes_adhesion
  FOR EACH ROW
  EXECUTE FUNCTION notify_send_demande_confirmation();

COMMENT ON FUNCTION notify_send_demande_confirmation() IS 'Appelle send-demande-confirmation (Resend) via pg_net, de façon asynchrone et non bloquante, à chaque nouvelle demande d''adhésion.';
