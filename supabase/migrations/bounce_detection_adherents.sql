-- Migration: bounce_detection_adherents.sql
-- Recadré 2026-09-06 (carte Trello "Détection d'emails adhérents invalides
-- (bounce)") : abandon du double opt-in actif (lien à cliquer) au profit
-- d'une détection passive des bounces sur les emails réellement envoyés.
-- Scope : population adhérents uniquement (demande d'adhésion → ratification
-- → campagnes mailing Brevo), pas les donateurs/reçus fiscaux.

-- Remplace l'ancien couple email_verification_token/email_verifie_at du
-- cadrage double opt-in du 2026-08-08, jamais implémenté (aucune colonne
-- créée) — rien à migrer/supprimer.
ALTER TABLE demandes_adhesion ADD COLUMN email_bounced_at timestamptz;
COMMENT ON COLUMN demandes_adhesion.email_bounced_at IS 'Posé par resend-bounce-webhook si l''email de confirmation de réception (send-demande-confirmation) a bouncé — signal non bloquant pour la ratification.';

ALTER TABLE adherents ADD COLUMN email_invalide_at timestamptz;
COMMENT ON COLUMN adherents.email_invalide_at IS 'Copié depuis demandes_adhesion.email_bounced_at à la ratification, puis mis à jour indépendamment par les bounces Brevo sur les campagnes mailing (brevo-bounce-webhook). Remis à null automatiquement si le courriel est modifié.';

-- Remise à null automatique dès que le courriel change (nouvelle adresse
-- jamais testée) — évite de conserver un badge "email invalide" périmé
-- après correction par l'admin.
CREATE OR REPLACE FUNCTION reset_adherent_email_invalide()
RETURNS trigger AS $$
BEGIN
  IF NEW.courriel IS DISTINCT FROM OLD.courriel THEN
    NEW.email_invalide_at := NULL;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_adherents_reset_email_invalide
  BEFORE UPDATE OF courriel ON adherents
  FOR EACH ROW
  EXECUTE FUNCTION reset_adherent_email_invalide();
