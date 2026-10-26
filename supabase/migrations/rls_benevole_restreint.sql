-- Migration: rls_benevole_restreint.sql
-- Audit sécurité 2026-10-24, carte « RLS bénévole » (https://trello.com/c/aSKiYaaa),
-- PR-b. Le compte technique bénévole (benevole-<org>@mothana.internal, sans
-- profils_organisation) héritait, via current_effective_organisation_id(), de
-- presque tous les droits admin de son organisation : CRUD adhérents/adhésions,
-- listes de diffusion, modèles d'emails, de reçus et de cartes, journal,
-- demandes d'adhésion, modification des personnes. Un code PIN divulgué
-- donnait donc accès à toute la base de l'association.
--
-- Après cette migration, le bénévole ne garde que ce dont l'écran /benevole a
-- besoin (décision validée par le lead tech) :
--   - lecture : organisation, activités, donateurs (profils_participant +
--     personnes), fichiers de dons, événements et demandes de paiement ;
--   - écriture : création de donateur (personnes, profils_participant), de don,
--     de fichier de don ;
--   - vérification d'adhésion via search_adherents_verification (SECURITY
--     DEFINER ci-dessous, colonnes restreintes) au lieu d'un SELECT adherents.
-- Les policies ci-dessous passent de current_effective_organisation_id() à
-- current_user_organisation_id() (profils_organisation uniquement) ; leur
-- bypass super-admin est conservé tel quel.

do $$
declare
  v_cible record;
  v_qual text;
  v_check text;
  v_sql text;
begin
  for v_cible in
    select * from (values
      ('adherents', 'adherents_select'),
      ('adherents', 'adherents_insert'),
      ('adherents', 'adherents_update'),
      ('adherents', 'adherents_delete'),
      ('adhesions', 'adhesions_select'),
      ('adhesions', 'adhesions_insert'),
      ('adhesions', 'adhesions_update'),
      ('adhesions', 'adhesions_delete'),
      ('campagnes_courrier', 'campagnes_courrier_select'),
      ('campagnes_mailing', 'campagnes_mailing_select'),
      ('demandes_adhesion', 'demandes_adhesion_select'),
      ('demandes_adhesion', 'demandes_adhesion_update'),
      ('journal_modifications', 'journal_modifications_select'),
      ('journal_modifications', 'journal_modifications_insert'),
      ('listes_diffusion', 'listes_diffusion_select'),
      ('listes_diffusion', 'listes_diffusion_insert'),
      ('listes_diffusion', 'listes_diffusion_update'),
      ('listes_diffusion', 'listes_diffusion_delete'),
      ('mailing_templates', 'mailing_templates_select'),
      ('mailing_templates', 'mailing_templates_insert'),
      ('mailing_templates', 'mailing_templates_update'),
      ('mailing_templates', 'mailing_templates_delete'),
      ('organisation_assets', 'organisation_assets_org'),
      ('templates_carte_adherent', 'templates_carte_adherent_org'),
      ('templates_recu', 'templates_recu_org'),
      ('personnes', 'personnes_update')
    ) as t(tablename, policyname)
  loop
    select p.qual, p.with_check into v_qual, v_check
    from pg_policies p
    where p.schemaname = 'public'
      and p.tablename = v_cible.tablename
      and p.policyname = v_cible.policyname;

    if not found then
      raise exception 'Policy %.% introuvable', v_cible.tablename, v_cible.policyname;
    end if;

    if coalesce(v_qual, '') || coalesce(v_check, '') !~ 'current_effective_organisation_id' then
      -- Déjà restreinte (migration rejouée) : rien à faire.
      raise notice 'Policy %.% déjà restreinte', v_cible.tablename, v_cible.policyname;
      continue;
    end if;

    v_sql := format('alter policy %I on public.%I', v_cible.policyname, v_cible.tablename);
    if v_qual is not null then
      v_sql := v_sql || ' using (' ||
        replace(v_qual, 'current_effective_organisation_id', 'current_user_organisation_id') || ')';
    end if;
    if v_check is not null then
      v_sql := v_sql || ' with check (' ||
        replace(v_check, 'current_effective_organisation_id', 'current_user_organisation_id') || ')';
    end if;
    execute v_sql;
  end loop;
end $$;

-- Vérification d'adhésion par le bénévole : la fonction était SECURITY INVOKER
-- et s'appuyait donc sur adherents_select, que le bénévole perd ci-dessus. Elle
-- passe en SECURITY DEFINER avec sa propre garde d'organisation (membre ou
-- bénévole de l'organisation demandée, ou super-admin). La garde est dans le
-- WHERE : un helper NULL (session sans organisation) filtre tout.
create or replace function search_adherents_verification(
  p_organisation_id uuid,
  p_search text,
  p_limit int default 20
)
returns table (
  nom text,
  prenom text,
  id_externe text,
  statut text,
  date_fin date
)
language sql
stable
security definer
set search_path = public
as $$
  select
    a.nom, a.prenom, a.id_externe, a.statut, ad.date_fin
  from adherents a
  left join lateral (
    select date_fin from adhesions where adherent_id = a.id order by date_debut desc limit 1
  ) ad on true
  where a.organisation_id = p_organisation_id
    and (
      coalesce(is_current_user_super_admin(), false)
      or p_organisation_id = current_effective_organisation_id()
    )
    and trim(coalesce(p_search, '')) <> ''
    and (a.nom || ' ' || coalesce(a.prenom, '')) ilike all (
      array(
        select '%' || tok || '%'
        from unnest(string_to_array(trim(p_search), ' ')) as tok
        where tok <> ''
      )
    )
  order by a.nom asc, a.prenom asc
  limit p_limit;
$$;

revoke execute on function search_adherents_verification(uuid, text, int) from public, anon;
grant execute on function search_adherents_verification(uuid, text, int) to authenticated, service_role;
