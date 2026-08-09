-- Message de succès personnalisable du formulaire public de demande
-- d'adhésion (2026-08-09). Texte simple (pas de HTML/CSS comme l'en-tête et
-- le pied de page) : NULL = message par défaut affiché par le frontend.

alter table organisations
  add column if not exists formulaire_adhesion_message_succes text;

comment on column organisations.formulaire_adhesion_message_succes is
  'Message affiché après soumission du formulaire public de demande d''adhésion. NULL = message par défaut.';

-- Étend get_organisation_public (organisations_slug_statuts.sql,
-- formulaire_adhesion_header_footer.sql) pour exposer le message de succès.
-- drop requis : le type de retour change (nouvelle colonne OUT).
drop function if exists get_organisation_public(text);

create function get_organisation_public(p_slug text)
returns table (
  id uuid,
  nom text,
  statuts_url text,
  formulaire_adhesion_header_html text,
  formulaire_adhesion_footer_html text,
  formulaire_adhesion_css text,
  formulaire_adhesion_message_succes text,
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
    o.formulaire_adhesion_message_succes,
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
