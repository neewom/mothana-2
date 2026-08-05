-- Personnalisation du formulaire public de demande d'adhésion (2026-08-05).
-- Le formulaire lui-même (champs centraux) reste inchangé ; seuls un en-tête
-- et un pied de page HTML/CSS deviennent personnalisables, avec les mêmes
-- placeholders {{asset_<identifiant>}} que les templates Cerfa/carte adhérent.
-- NULL = pas encore personnalisé -> le frontend affiche l'en-tête par défaut
-- (titre "Demande d'adhésion" + nom de l'organisation), pas de pied de page.

alter table organisations
  add column if not exists formulaire_adhesion_header_html text,
  add column if not exists formulaire_adhesion_footer_html text,
  add column if not exists formulaire_adhesion_css text;

comment on column organisations.formulaire_adhesion_header_html is
  'En-tête HTML personnalisé du formulaire public de demande d''adhésion. NULL = en-tête par défaut (titre + nom organisation).';
comment on column organisations.formulaire_adhesion_footer_html is
  'Pied de page HTML personnalisé du formulaire public de demande d''adhésion. NULL/vide = pas de pied de page.';
comment on column organisations.formulaire_adhesion_css is
  'CSS partagé de l''en-tête et du pied de page personnalisés, rendu dans un shadow DOM isolé du reste de l''app.';

-- Étend get_organisation_public (organisations_slug_statuts.sql) pour exposer
-- l'en-tête/pied de page personnalisés et les assets de l'organisation
-- (bypass RLS via security definer, nécessaire car le formulaire est vu par
-- des visiteurs anonymes qui n'ont pas accès à organisation_assets).
-- drop requis : le type de retour change (nouvelles colonnes OUT), impossible
-- avec un simple create or replace.
drop function if exists get_organisation_public(text);

create function get_organisation_public(p_slug text)
returns table (
  id uuid,
  nom text,
  statuts_url text,
  formulaire_adhesion_header_html text,
  formulaire_adhesion_footer_html text,
  formulaire_adhesion_css text,
  assets jsonb
)
language sql
stable
security definer
set search_path = public
as $$
  select
    o.id,
    o.nom,
    o.statuts_url,
    o.formulaire_adhesion_header_html,
    o.formulaire_adhesion_footer_html,
    o.formulaire_adhesion_css,
    coalesce(
      (
        select jsonb_agg(jsonb_build_object('identifiant', a.identifiant, 'url', a.url))
        from organisation_assets a
        where a.organisation_id = o.id
      ),
      '[]'::jsonb
    ) as assets
  from organisations o
  where o.slug = p_slug;
$$;

grant execute on function get_organisation_public(text) to anon, authenticated;
