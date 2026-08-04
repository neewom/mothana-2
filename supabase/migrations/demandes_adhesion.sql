-- Migration: demandes_adhesion.sql
-- Demandes d'adhésion soumises via le formulaire public (/adhesion/{slug}),
-- en attente de ratification par le conseil d'administration.
-- Table séparée de `adherents`/`adhesions` : une demande n'est pas encore
-- un adhérent réel, seule la ratification déclenche la création (même
-- logique que AdherentModal/adhesion.ts, réutilisée côté admin).
-- Cadré 2026-08-05 : signature simple (dessinée, pas de valeur probante
-- eIDAS), pas de pièce d'identité, historique conservé en cas de refus.

CREATE TABLE demandes_adhesion (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,

  -- Mêmes champs que le formulaire adhérent existant (AdherentModal)
  civilite smallint NOT NULL DEFAULT 0
    CONSTRAINT demandes_adhesion_civilite_check CHECK (civilite IN (0, 1, 2)),
  nom text NOT NULL,
  prenom text,
  date_naissance date,
  adresse text,
  code_postal text,
  ville text,
  telephone text,
  courriel text,

  -- Signature dessinée (canvas), stockée en data URL base64 (image légère,
  -- pas de bucket Storage dédié nécessaire pour ce volume/usage).
  signature_data_url text NOT NULL,
  accepte_statuts boolean NOT NULL DEFAULT false
    CONSTRAINT demandes_adhesion_accepte_statuts_check CHECK (accepte_statuts = true),
  consent_rgpd boolean NOT NULL DEFAULT false
    CONSTRAINT demandes_adhesion_consent_rgpd_check CHECK (consent_rgpd = true),

  statut text NOT NULL DEFAULT 'en_attente'
    CONSTRAINT demandes_adhesion_statut_check CHECK (statut IN ('en_attente', 'ratifiee', 'refusee')),
  decided_at timestamptz,
  decided_by uuid REFERENCES auth.users(id),
  -- Renseigné à la ratification, pointe vers l'adhérent réellement créé
  adherent_id uuid REFERENCES adherents(id) ON DELETE SET NULL,

  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_demandes_adhesion_organisation_id ON demandes_adhesion(organisation_id);
CREATE INDEX idx_demandes_adhesion_statut ON demandes_adhesion(organisation_id, statut);

-- RLS
ALTER TABLE demandes_adhesion ENABLE ROW LEVEL SECURITY;

-- Insertion publique (formulaire anonyme) : aucune notion d'organisation
-- courante côté anon, seule l'existence de l'organisation (FK) et les
-- deux cases d'acceptation obligatoires sont vérifiées. Le statut ne peut
-- être forcé qu'à 'en_attente' à l'insertion.
CREATE POLICY demandes_adhesion_insert_public ON demandes_adhesion
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (
    statut = 'en_attente'
    AND accepte_statuts = true
    AND consent_rgpd = true
  );

-- Lecture/traitement réservés aux admins de l'organisation (+ bypass
-- super-admin, même pattern inline que adherents.sql/adhesions.sql).
CREATE POLICY demandes_adhesion_select ON demandes_adhesion
  FOR SELECT
  TO authenticated
  USING (
    organisation_id = (select current_effective_organisation_id())
    OR (((select auth.jwt()) -> 'app_metadata' ->> 'is_super_admin'))::boolean = true
  );

CREATE POLICY demandes_adhesion_update ON demandes_adhesion
  FOR UPDATE
  TO authenticated
  USING (
    organisation_id = (select current_effective_organisation_id())
    OR (((select auth.jwt()) -> 'app_metadata' ->> 'is_super_admin'))::boolean = true
  )
  WITH CHECK (
    organisation_id = (select current_effective_organisation_id())
    OR (((select auth.jwt()) -> 'app_metadata' ->> 'is_super_admin'))::boolean = true
  );

COMMENT ON TABLE demandes_adhesion IS 'Demandes d''adhésion soumises via le formulaire public, en attente de ratification par le CA';
COMMENT ON COLUMN demandes_adhesion.signature_data_url IS 'Signature dessinée par le demandeur (canvas), data URL base64 — signature simple, pas de valeur probante eIDAS';
COMMENT ON COLUMN demandes_adhesion.statut IS 'en_attente (soumise) / ratifiee (adhérent créé) / refusee (conservée pour historique, pas de suppression)';
