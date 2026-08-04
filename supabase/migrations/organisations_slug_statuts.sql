-- Cadrage formulaire public de demande d'adhésion (2026-08-05).
-- Ajoute un identifiant public (slug) par organisation, utilisé dans
-- l'URL du formulaire public (/adhesion/{slug}), et l'URL des statuts
-- de l'organisation (PDF, affiché/téléchargeable sur ce formulaire).

alter table organisations
  add column if not exists slug text,
  add column if not exists statuts_url text;

-- Backfill des organisations existantes : slug dérivé du nom.
-- Vérifié 2026-08-05 : extension unaccent pas déjà installée sur ce projet
-- (même schéma "extensions" que pg_trgm, cf. adherents.sql).
create extension if not exists unaccent with schema extensions;

update organisations
set slug = trim(both '-' from regexp_replace(lower(extensions.unaccent(nom)), '[^a-z0-9]+', '-', 'g'))
where slug is null;

alter table organisations
  alter column slug set not null,
  add constraint organisations_slug_unique unique (slug);

comment on column organisations.slug is 'Identifiant public dans l''URL du formulaire de demande d''adhésion (/adhesion/{slug})';
comment on column organisations.statuts_url is 'URL du PDF des statuts de l''organisation, affiché sur le formulaire public de demande d''adhésion';

-- Résolution publique slug -> organisation pour le formulaire anonyme,
-- sans exposer le reste des colonnes de `organisations` (RLS actuelle de
-- la table réservée aux membres de l'organisation, cf. super_admin_rls.sql).
create or replace function get_organisation_public(p_slug text)
returns table (id uuid, nom text, statuts_url text)
language sql
stable
security definer
set search_path = public
as $$
  select o.id, o.nom, o.statuts_url
  from organisations o
  where o.slug = p_slug;
$$;

grant execute on function get_organisation_public(text) to anon, authenticated;
