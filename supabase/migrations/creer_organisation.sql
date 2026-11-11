-- Création d'organisation côté serveur, en une opération (carte https://trello.com/c/3sMxN5w5).
--
-- Remplace l'enchaînement d'insertions que lançait le navigateur du super-admin (organisation,
-- puis modèles de reçus, puis modèle de carte) : un appel de fonction est une seule instruction,
-- donc une seule transaction — si un modèle échoue, l'organisation n'est pas créée.
--
-- Appelée par l'Edge Function creer-organisation (cœur supabase/functions/_shared/creerOrganisation.ts),
-- qui vérifie elle-même le droit de l'appelant (super-admin ; plus tard l'inscription publique).
-- Exécutable par service_role seulement : aucune garde d'identité ici, la fonction ne fait
-- confiance à aucune session.
--
-- Paramètres optionnels (inutilisés par le super-admin, prévus pour l'inscription) :
-- p_fonctionnalites_activees et p_modele_recu_pdf (RNA, SIREN…) ; NULL = valeur par défaut de la colonne.
-- Le slug est fourni par l'appelant (règle slugifyUrl côté Edge Function) ; un doublon lève
-- unique_violation (23505, contrainte organisations_slug_unique), traduit par l'Edge Function.

create or replace function public.creer_organisation(
  p_nom text,
  p_slug text,
  p_templates_recu jsonb,
  p_template_carte jsonb,
  p_fonctionnalites_activees jsonb default null,
  p_modele_recu_pdf jsonb default null
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_id uuid;
begin
  if coalesce(btrim(p_nom), '') = '' then
    raise exception 'NOM_INVALIDE' using errcode = '22023';
  end if;
  if coalesce(p_slug, '') !~ '^[a-z0-9]+(-[a-z0-9]+)*$' then
    raise exception 'SLUG_INVALIDE' using errcode = '22023';
  end if;
  if jsonb_typeof(p_templates_recu) is distinct from 'array' or jsonb_array_length(p_templates_recu) = 0 then
    raise exception 'TEMPLATES_RECU_INVALIDES' using errcode = '22023';
  end if;
  if jsonb_typeof(p_template_carte) is distinct from 'object' then
    raise exception 'TEMPLATE_CARTE_INVALIDE' using errcode = '22023';
  end if;
  if p_fonctionnalites_activees is not null and jsonb_typeof(p_fonctionnalites_activees) <> 'object' then
    raise exception 'FONCTIONNALITES_INVALIDES' using errcode = '22023';
  end if;
  if p_modele_recu_pdf is not null and jsonb_typeof(p_modele_recu_pdf) <> 'object' then
    raise exception 'MODELE_RECU_PDF_INVALIDE' using errcode = '22023';
  end if;

  insert into public.organisations (nom, slug)
  values (p_nom, p_slug)
  returning id into v_id;

  -- Mises à jour dans la même transaction (le trigger des fonctionnalités ne bloque pas :
  -- aucune session, auth.uid() vaut NULL sous service_role).
  if p_fonctionnalites_activees is not null then
    update public.organisations
      set fonctionnalites_activees = fonctionnalites_activees || p_fonctionnalites_activees
      where id = v_id;
  end if;
  if p_modele_recu_pdf is not null then
    update public.organisations
      set modele_recu_pdf = coalesce(modele_recu_pdf, '{}'::jsonb) || p_modele_recu_pdf
      where id = v_id;
  end if;

  insert into public.templates_recu (organisation_id, nom, type_cerfa, html_template, css, is_active)
  select v_id, t.nom, t.type_cerfa, t.html_template, t.css, true
  from jsonb_to_recordset(p_templates_recu) as t(nom text, type_cerfa text, html_template text, css text);

  insert into public.templates_carte_adherent (organisation_id, nom, html_template, css, is_active)
  values (
    v_id,
    p_template_carte ->> 'nom',
    p_template_carte ->> 'html_template',
    p_template_carte ->> 'css',
    true
  );

  return v_id;
end;
$$;

revoke execute on function public.creer_organisation(text, text, jsonb, jsonb, jsonb, jsonb) from public, anon, authenticated;
grant execute on function public.creer_organisation(text, text, jsonb, jsonb, jsonb, jsonb) to service_role;

comment on function public.creer_organisation(text, text, jsonb, jsonb, jsonb, jsonb) is
  'Crée une organisation et ses modèles par défaut (reçus, carte) en une transaction. service_role seulement (Edge Function creer-organisation).';
