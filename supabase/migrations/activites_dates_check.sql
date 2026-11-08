-- Refuse une activité dont la date de fin précède la date de début
-- (carte Trello JaknySME, 2026-11-09).
--
-- Posée NOT VALID (décision utilisateur) : elle s'applique à toute insertion et
-- toute modification à partir de maintenant, sans vérifier ni bloquer les lignes
-- existantes. Une ligne existante incohérente reste lisible ; la modifier sans
-- corriger ses dates sera refusée. Pas de VALIDATE CONSTRAINT : les lignes
-- incohérentes en prod sont listées et corrigées à la main avant tout VALIDATE.
--
-- Même règle que adhesions_dates_check ; une date absente n'est pas contrôlée.

alter table public.activites
  drop constraint if exists activites_dates_check;

alter table public.activites
  add constraint activites_dates_check
  check (date_fin is null or date_debut is null or date_fin >= date_debut)
  not valid;
