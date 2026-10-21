-- Migration: adhesion_duree_reglable.sql
-- Cadré 2026-10-21 (carte Trello « Adhésions : durée réglable par organisation (fin au
-- 31/12, bascule en décembre) »). La date de fin d'une adhésion devient calculée en base,
-- au même endroit pour toutes les sources (saisie, renouvellement, validation d'une
-- demande, import), selon une règle réglable par organisation :
--   - 'glissante' (défaut, comportement actuel) : date d'adhésion + 1 an ;
--   - 'annee_civile' : 31/12 de l'année d'adhésion, ou de l'année suivante si le mois
--     d'adhésion est >= au mois de bascule (Wat : décembre).
-- Le garde trg_organisations_fonctionnalites_super_admin ne surveille que
-- fonctionnalites_activees : les nouvelles colonnes restent modifiables par l'admin
-- (policy org_update_admin), comme le reste de Paramètres → Adhésions.
begin;

alter table public.organisations
  add column adhesion_regle_fin text not null default 'glissante'
    constraint organisations_adhesion_regle_fin_check check (adhesion_regle_fin in ('glissante', 'annee_civile')),
  add column adhesion_mois_bascule smallint not null default 12
    constraint organisations_adhesion_mois_bascule_check check (adhesion_mois_bascule between 1 and 12);

comment on column public.organisations.adhesion_regle_fin is 'Règle de fin des adhésions : glissante (date d''adhésion + 1 an) ou annee_civile (31/12, voir adhesion_mois_bascule).';
comment on column public.organisations.adhesion_mois_bascule is 'Règle annee_civile : à partir de ce mois (1-12), une adhésion vaut aussi l''année suivante.';

-- Security invoker : l'appelant lit sa propre organisation (policy org_select, admins et
-- bénévoles) ; l'import (security definer) la lit aussi. Null si l'organisation n'est pas
-- lisible : le trigger le refuse plutôt que de poser une date de fin vide (= « à jour »).
create or replace function public.calculer_date_fin_adhesion(p_organisation_id uuid, p_date_debut date)
returns date
language sql
stable
set search_path = public, pg_temp
as $$
  select case
    when o.adhesion_regle_fin = 'annee_civile' then
      make_date(
        extract(year from p_date_debut)::int
          + case when extract(month from p_date_debut)::int >= o.adhesion_mois_bascule then 1 else 0 end,
        12, 31)
    else (p_date_debut + interval '1 year')::date
  end
  from public.organisations o
  where o.id = p_organisation_id;
$$;

-- Source de vérité : toute adhésion insérée (ou dont la date d'adhésion change) reçoit la
-- date de fin de la règle de son organisation, quelle que soit la valeur envoyée.
create or replace function public.adhesions_poser_date_fin()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
declare
  v_organisation_id uuid;
begin
  select a.organisation_id into v_organisation_id from public.adherents a where a.id = new.adherent_id;
  new.date_fin := public.calculer_date_fin_adhesion(v_organisation_id, new.date_debut);
  if new.date_fin is null then
    raise exception 'REGLE_ADHESION_INTROUVABLE' using errcode = '42501';
  end if;
  return new;
end;
$$;

create trigger trg_adhesions_poser_date_fin
  before insert or update of date_debut on public.adhesions
  for each row execute function public.adhesions_poser_date_fin();

-- Aperçu du recalage (confirmation dans Paramètres → Adhésions) : nombre d'adhésions de
-- l'organisation et nombre dont la date de fin changerait avec la règle en vigueur.
create or replace function public.apercu_recalage_adhesions(p_organisation_id uuid)
returns jsonb
language plpgsql
stable
set search_path = public, pg_temp
as $$
begin
  if not (public.is_current_user_super_admin() or p_organisation_id = public.current_user_organisation_id()) then
    raise exception 'ACCES_REFUSE' using errcode = '42501';
  end if;
  return (
    select jsonb_build_object(
      'total', count(*),
      'a_modifier', count(*) filter (
        where h.date_fin is distinct from public.calculer_date_fin_adhesion(p_organisation_id, h.date_debut)
      )
    )
    from public.adhesions h
    join public.adherents a on a.id = h.adherent_id
    where a.organisation_id = p_organisation_id
  );
end;
$$;

-- Recalage : recalcule la date de fin de toutes les adhésions de l'organisation selon la
-- règle en vigueur, journalise l'opération et renvoie le nombre d'adhésions modifiées.
-- Security invoker : la RLS d'adhesions (bypass super-admin) borne la mise à jour ; le
-- contrôle explicite écarte les comptes bénévoles (même règle que org_update_admin).
create or replace function public.recalculer_dates_fin_adhesions(p_organisation_id uuid)
returns integer
language plpgsql
set search_path = public, pg_temp
as $$
declare
  v_modifiees integer;
  v_regle text;
  v_mois smallint;
begin
  if not (public.is_current_user_super_admin() or p_organisation_id = public.current_user_organisation_id()) then
    raise exception 'ACCES_REFUSE' using errcode = '42501';
  end if;

  select adhesion_regle_fin, adhesion_mois_bascule into v_regle, v_mois
  from public.organisations where id = p_organisation_id;
  if v_regle is null then
    raise exception 'ORGANISATION_INTROUVABLE' using errcode = '42501';
  end if;

  update public.adhesions h
  set date_fin = public.calculer_date_fin_adhesion(p_organisation_id, h.date_debut)
  from public.adherents a
  where a.id = h.adherent_id
    and a.organisation_id = p_organisation_id
    and h.date_fin is distinct from public.calculer_date_fin_adhesion(p_organisation_id, h.date_debut);
  get diagnostics v_modifiees = row_count;

  insert into public.journal_modifications (organisation_id, table_cible, ligne_id, action, details, auteur_id)
  values (
    p_organisation_id, 'organisations', p_organisation_id, 'recalage_adhesions',
    jsonb_build_object('adhesions_modifiees', v_modifiees, 'regle_fin', v_regle, 'mois_bascule', v_mois),
    auth.uid()
  );

  return v_modifiees;
end;
$$;

revoke execute on function public.apercu_recalage_adhesions(uuid) from public, anon;
revoke execute on function public.recalculer_dates_fin_adhesions(uuid) from public, anon;
grant execute on function public.apercu_recalage_adhesions(uuid) to authenticated, service_role;
grant execute on function public.recalculer_dates_fin_adhesions(uuid) to authenticated, service_role;

-- Import : la date de fin suit la même règle (le trigger la poserait de toute façon) —
-- repart de la définition en place sur staging (pg_get_functiondef, 2026-10-21), seule la
-- date de fin change ; CREATE OR REPLACE, droits inchangés.
CREATE OR REPLACE FUNCTION public.import_upsert_adherents(payload jsonb, p_organisation_id uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_org uuid := coalesce(current_user_organisation_id(), case when is_current_user_super_admin() then p_organisation_id end);
  v_total int;
  v_existing_ids uuid[];
  v_created int;
  v_updated int;
  v_adhesions_created int;
begin
  if v_org is null then
    raise exception 'Unauthorized: no organisation context';
  end if;

  create temporary table _import_adherents on commit drop as
  select * from jsonb_to_recordset(payload) as r(
    adherent_id              uuid,
    id_externe               text,
    civilite                 smallint,
    nom                      text,
    prenom                   text,
    date_naissance           date,
    adresse                  text,
    code_postal              text,
    ville                    text,
    telephone                text,
    courriel                 text,
    adhesion_id              uuid,
    date_debut               date,
    montant_cotisation       numeric,
    date_paiement_cotisation date,
    mode_paiement            smallint,
    droit_vote_ag            boolean,
    bulletin_signe           boolean,
    renouvellement           boolean
  );

  v_total := (select count(*) from _import_adherents where adherent_id is not null);

  select array_agg(a.id) into v_existing_ids
  from adherents a
  join _import_adherents t on t.adherent_id = a.id
  where a.organisation_id = v_org;

  insert into adherents (id, organisation_id, id_externe, civilite, nom, prenom, date_naissance, adresse, code_postal, ville, telephone, courriel)
  select adherent_id, v_org, id_externe, coalesce(civilite, 0), nom, prenom, date_naissance, adresse, code_postal, ville, telephone, courriel
  from _import_adherents
  where adherent_id is not null
  on conflict (id) do update set
    id_externe = excluded.id_externe,
    civilite = excluded.civilite,
    nom = excluded.nom,
    prenom = excluded.prenom,
    date_naissance = excluded.date_naissance,
    adresse = excluded.adresse,
    code_postal = excluded.code_postal,
    ville = excluded.ville,
    telephone = excluded.telephone,
    courriel = excluded.courriel
  where adherents.organisation_id = v_org;

  insert into adhesions (id, adherent_id, date_debut, date_fin, montant_cotisation, date_paiement_cotisation, mode_paiement, renouvellement, droit_vote_ag, bulletin_signe)
  select adhesion_id, adherent_id, date_debut, public.calculer_date_fin_adhesion(v_org, date_debut), montant_cotisation, date_paiement_cotisation, mode_paiement,
         coalesce(renouvellement, false), coalesce(droit_vote_ag, true), coalesce(bulletin_signe, true)
  from _import_adherents
  where adhesion_id is not null and adherent_id is not null;

  v_updated := coalesce(array_length(v_existing_ids, 1), 0);
  v_created := v_total - v_updated;
  v_adhesions_created := (select count(*) from _import_adherents where adhesion_id is not null);

  return jsonb_build_object('created', v_created, 'updated', v_updated, 'total', v_total, 'adhesions_created', v_adhesions_created);
end;
$function$;

commit;
