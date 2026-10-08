-- Coupon 2 — plage de dates des événements, alignée sur les activités.
begin;

alter table public.evenements
  add column if not exists date_fin date;

update public.evenements
set date_fin = date_evenement
where date_fin is null;

alter table public.evenements
  alter column date_fin set not null;

alter table public.evenements
  drop constraint if exists evenements_date_fin_check;
alter table public.evenements
  add constraint evenements_date_fin_check check (date_fin >= date_evenement);

-- La page publique de Coupon 4 aura besoin des deux bornes.
drop function if exists public.get_evenement_public(text, text);
create function public.get_evenement_public(p_org_slug text, p_slug text)
returns table (
  id uuid,
  nom text,
  date_evenement date,
  date_fin date,
  montants_credit_centimes integer[],
  nom_organisation text
)
language sql stable security definer set search_path = public, pg_temp as $$
  select e.id, e.nom, e.date_evenement, e.date_fin, e.montants_credit_centimes, o.nom
  from public.evenements e join public.organisations o on o.id = e.organisation_id
  where o.slug = p_org_slug and e.slug = p_slug and e.statut = 'ouvert'
    and o.fonctionnalites_activees -> 'evenements' = 'true'::jsonb;
$$;
revoke execute on function public.get_evenement_public(text, text) from public, anon, authenticated;
grant execute on function public.get_evenement_public(text, text) to anon, authenticated, service_role;

commit;
