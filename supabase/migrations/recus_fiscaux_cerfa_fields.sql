-- Refonte Cerfa (§1.4 docs/brief-cerfa.md) : numéro d'ordre définitif,
-- type de Cerfa utilisé, template appliqué, et snapshot des données
-- donateur/organisation au moment de la génération (traçabilité — les
-- infos du reçu ne doivent pas changer rétroactivement si le donateur ou
-- l'organisation sont modifiés ensuite).
alter table recus_fiscaux
  add column if not exists numero_ordre text,
  add column if not exists type_cerfa text check (type_cerfa in ('11580', '16216')),
  add column if not exists template_id uuid references templates_recu(id) on delete set null,
  add column if not exists snapshot_donateur jsonb,
  add column if not exists snapshot_organisation jsonb,
  add column if not exists email_envoye_at timestamptz;
