-- Migration: adhesions.sql
-- Historisation des cycles d'adhésion (un enregistrement par année/cycle, par adhérent).
-- Dépend de adherents.sql (doit être exécutée après).

CREATE TABLE adhesions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  adherent_id uuid NOT NULL REFERENCES adherents(id) ON DELETE CASCADE,

  date_debut date NOT NULL,
  date_fin date,

  montant_cotisation numeric(10, 2),
  date_paiement_cotisation date,

  -- Réutilise l'enum mode de paiement existant des dons (même valeurs numériques que profils dons / Mode_paie_Cotis)
  -- Vérifié 2026-08-03 : dons.mode_paiement est bien smallint, contraint à [1,2,3,4]
  -- (1=Espèces, 2=Chèque, 3=Prélèvement-virement, 4=Autres) — même contrainte reprise ici.
  mode_paiement smallint
    CONSTRAINT adhesions_mode_paiement_check CHECK (mode_paiement = ANY (ARRAY[1, 2, 3, 4])),

  -- Calculé côté application (pas de saisie manuelle) : true si l'adhérent a déjà une adhésion antérieure
  renouvellement boolean NOT NULL DEFAULT false,

  droit_vote_ag boolean NOT NULL DEFAULT true,
  bulletin_signe boolean NOT NULL DEFAULT true,

  created_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT adhesions_dates_check CHECK (date_fin IS NULL OR date_fin >= date_debut)
);

CREATE INDEX idx_adhesions_adherent_id ON adhesions(adherent_id);
-- Utile pour "adhérents proches d'expiration" sur le futur dashboard organisation
CREATE INDEX idx_adhesions_date_fin ON adhesions(date_fin);

-- RLS : pas de organisation_id direct, on passe par adherent_id (même pattern que recus_fiscaux -> profils_participant)
ALTER TABLE adhesions ENABLE ROW LEVEL SECURITY;

-- Bypass super-admin : pas de fonction is_super_admin() dans ce projet (vérifié 2026-08-03) —
-- même expression inline que rls_auth_initplan_perf.sql/super_admin_rls.sql.
CREATE POLICY adhesions_select ON adhesions
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM adherents a
      WHERE a.id = adhesions.adherent_id
        AND (
          a.organisation_id = (select current_effective_organisation_id())
          OR (((select auth.jwt()) -> 'app_metadata' ->> 'is_super_admin'))::boolean = true
        )
    )
  );

CREATE POLICY adhesions_insert ON adhesions
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM adherents a
      WHERE a.id = adhesions.adherent_id
        AND (
          a.organisation_id = (select current_effective_organisation_id())
          OR (((select auth.jwt()) -> 'app_metadata' ->> 'is_super_admin'))::boolean = true
        )
    )
  );

CREATE POLICY adhesions_update ON adhesions
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM adherents a
      WHERE a.id = adhesions.adherent_id
        AND (
          a.organisation_id = (select current_effective_organisation_id())
          OR (((select auth.jwt()) -> 'app_metadata' ->> 'is_super_admin'))::boolean = true
        )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM adherents a
      WHERE a.id = adhesions.adherent_id
        AND (
          a.organisation_id = (select current_effective_organisation_id())
          OR (((select auth.jwt()) -> 'app_metadata' ->> 'is_super_admin'))::boolean = true
        )
    )
  );

CREATE POLICY adhesions_delete ON adhesions
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM adherents a
      WHERE a.id = adhesions.adherent_id
        AND (
          a.organisation_id = (select current_effective_organisation_id())
          OR (((select auth.jwt()) -> 'app_metadata' ->> 'is_super_admin'))::boolean = true
        )
    )
  );

COMMENT ON TABLE adhesions IS 'Cycles annuels d''adhésion, un adhérent peut en avoir plusieurs (historisation, pas d''update en place)';
COMMENT ON COLUMN adhesions.renouvellement IS 'Calculé côté application à l''insertion (existence d''une adhésion antérieure), jamais saisi manuellement';
COMMENT ON COLUMN adhesions.mode_paiement IS 'Réutilise l''enum mode de paiement existant des dons (1=Espèces, 2=Chèque, 3=Prélèvement-virement, 4=Autres)';
