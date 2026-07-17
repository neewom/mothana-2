-- Refonte Cerfa (§1.1 docs/brief-cerfa.md) : adresse structurée de
-- l'organisation, nécessaire à l'en-tête des reçus fiscaux (11580/16216).
alter table organisations
  add column if not exists adresse text,
  add column if not exists code_postal text,
  add column if not exists ville text,
  add column if not exists pays text default 'France';
