-- Coupon 2 — rattachement comptable d'un événement à une activité.
-- Le lien reste nullable pour les données existantes et disparaît si l'activité
-- est supprimée. La modale admin crée une activité d'un jour quand aucun lien
-- existant n'est choisi.
alter table public.evenements
  add column if not exists activite_id uuid
  references public.activites(id) on delete set null;

create index if not exists idx_evenements_activite_id
  on public.evenements(activite_id);
