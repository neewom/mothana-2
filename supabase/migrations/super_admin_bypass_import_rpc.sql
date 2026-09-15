-- Cadré 2026-09-15 (carte Trello "Cerfa/super-admin : lever les blocages
-- Supabase pour l'onboarding") — les 4 RPC d'import dérivent l'organisation
-- uniquement via current_user_organisation_id() (profils_organisation de
-- l'utilisateur connecté), sans jamais accepter de paramètre du client. Un
-- super-admin n'a pas de ligne profils_organisation : ces RPC échouent
-- systématiquement en mode "Consulter", contrairement à l'accès direct aux
-- tables (RLS a déjà un bypass complet is_super_admin, cf. super_admin_rls.sql).
--
-- is_current_user_super_admin() : même pattern que current_user_organisation_id()
-- (rls_auth_initplan_perf.sql), pour ne pas dupliquer la lecture du JWT dans
-- les 4 fonctions ci-dessous.
create or replace function is_current_user_super_admin()
returns boolean as $$
  select coalesce(((select auth.jwt()) -> 'app_metadata' ->> 'is_super_admin')::boolean, false);
$$ language sql stable;

-- Chaque fonction est droppée puis recréée (pas un simple "create or replace")
-- car l'ajout d'un paramètre change la signature — un create or replace avec
-- une liste d'arguments différente créerait une 2e fonction surchargée au
-- lieu de remplacer l'existante.

drop function if exists import_upsert_participants(jsonb);
create function import_upsert_participants(payload jsonb, p_organisation_id uuid default null)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_org uuid := coalesce(current_user_organisation_id(), case when is_current_user_super_admin() then p_organisation_id end);
  v_total int;
  v_existing_profil_ids uuid[];
  v_created int;
  v_updated int;
begin
  if v_org is null then
    raise exception 'Unauthorized: no organisation context';
  end if;

  create temporary table _import_participants on commit drop as
  select * from jsonb_to_recordset(payload) as r(
    personne_id  uuid,
    profil_id    uuid,
    id_externe   text,
    nom          text,
    prenom       text,
    civilite     smallint,
    email        text,
    telephone    text,
    adresse      text,
    code_postal  text,
    ville        text,
    pays         text,
    nom2         text,
    prenom2      text,
    notes        text
  );

  v_total := (select count(*) from _import_participants where personne_id is not null and profil_id is not null);

  select array_agg(pp.id) into v_existing_profil_ids
  from profils_participant pp
  join _import_participants t on t.profil_id = pp.id
  where pp.organisation_id = v_org;

  insert into personnes (id, nom, prenom, civilite, email, telephone, adresse, code_postal, ville, pays, nom2, prenom2)
  select personne_id, nom, prenom, civilite, email, telephone, adresse, code_postal, ville, pays, nom2, prenom2
  from _import_participants
  where personne_id is not null and profil_id is not null
  on conflict (id) do update set
    nom = excluded.nom,
    prenom = excluded.prenom,
    civilite = excluded.civilite,
    email = excluded.email,
    telephone = excluded.telephone,
    adresse = excluded.adresse,
    code_postal = excluded.code_postal,
    ville = excluded.ville,
    pays = excluded.pays,
    nom2 = excluded.nom2,
    prenom2 = excluded.prenom2
  where exists (
    select 1 from profils_participant pp
    where pp.personne_id = personnes.id and pp.organisation_id = v_org
  );

  insert into profils_participant (id, personne_id, organisation_id, notes, id_externe)
  select profil_id, personne_id, v_org, notes, id_externe
  from _import_participants
  where personne_id is not null and profil_id is not null
  on conflict (id) do update set
    notes = excluded.notes,
    id_externe = excluded.id_externe
  where profils_participant.organisation_id = v_org;

  v_updated := coalesce(array_length(v_existing_profil_ids, 1), 0);
  v_created := v_total - v_updated;

  return jsonb_build_object('created', v_created, 'updated', v_updated, 'total', v_total);
end;
$$;

drop function if exists import_upsert_adherents(jsonb);
create function import_upsert_adherents(payload jsonb, p_organisation_id uuid default null)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
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
  select adhesion_id, adherent_id, date_debut, (date_debut + interval '1 year')::date, montant_cotisation, date_paiement_cotisation, mode_paiement,
         coalesce(renouvellement, false), coalesce(droit_vote_ag, true), coalesce(bulletin_signe, true)
  from _import_adherents
  where adhesion_id is not null and adherent_id is not null;

  v_updated := coalesce(array_length(v_existing_ids, 1), 0);
  v_created := v_total - v_updated;
  v_adhesions_created := (select count(*) from _import_adherents where adhesion_id is not null);

  return jsonb_build_object('created', v_created, 'updated', v_updated, 'total', v_total, 'adhesions_created', v_adhesions_created);
end;
$$;

drop function if exists import_upsert_activites(jsonb);
create function import_upsert_activites(payload jsonb, p_organisation_id uuid default null)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_org uuid := coalesce(current_user_organisation_id(), case when is_current_user_super_admin() then p_organisation_id end);
  v_total int;
  v_existing_ids uuid[];
  v_created int;
  v_updated int;
begin
  if v_org is null then
    raise exception 'Unauthorized: no organisation context';
  end if;

  create temporary table _import_activites on commit drop as
  select * from jsonb_to_recordset(payload) as r(
    id          uuid,
    id_externe  text,
    nom         text,
    date_debut  date,
    date_fin    date
  );

  v_total := (select count(*) from _import_activites where id is not null);

  select array_agg(a.id) into v_existing_ids
  from activites a
  join _import_activites t on t.id = a.id
  where a.organisation_id = v_org;

  insert into activites (id, organisation_id, nom, id_externe, date_debut, date_fin)
  select id, v_org, nom, id_externe, date_debut, date_fin
  from _import_activites
  where id is not null
  on conflict (id) do update set
    nom = excluded.nom,
    id_externe = excluded.id_externe,
    date_debut = excluded.date_debut,
    date_fin = excluded.date_fin
  where activites.organisation_id = v_org;

  v_updated := coalesce(array_length(v_existing_ids, 1), 0);
  v_created := v_total - v_updated;

  return jsonb_build_object('created', v_created, 'updated', v_updated, 'total', v_total);
end;
$$;

drop function if exists import_upsert_dons(jsonb);
create function import_upsert_dons(payload jsonb, p_organisation_id uuid default null)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_org uuid := coalesce(current_user_organisation_id(), case when is_current_user_super_admin() then p_organisation_id end);
  v_total int;
  v_valid int;
  v_existing_ids uuid[];
  v_created int;
  v_updated int;
  v_skipped int;
begin
  if v_org is null then
    raise exception 'Unauthorized: no organisation context';
  end if;

  create temporary table _import_dons on commit drop as
  select * from jsonb_to_recordset(payload) as r(
    id                     uuid,
    id_externe             text,
    profil_participant_id  uuid,
    activite_id            uuid,
    montant                numeric(10,2),
    date                   date,
    mode_paiement          text
  );

  v_total := (select count(*) from _import_dons where id is not null);

  create temporary table _import_dons_valid on commit drop as
  select t.*
  from _import_dons t
  join profils_participant pp on pp.id = t.profil_participant_id and pp.organisation_id = v_org
  left join activites a on a.id = t.activite_id and a.organisation_id = v_org
  where t.id is not null
    and (t.activite_id is null or a.id is not null);

  v_valid := (select count(*) from _import_dons_valid);
  v_skipped := v_total - v_valid;

  select array_agg(d.id) into v_existing_ids
  from dons d
  join _import_dons_valid t on t.id = d.id
  where d.organisation_id = v_org;

  insert into dons (id, organisation_id, profil_participant_id, activite_id, montant, date, mode_paiement, id_externe, created_by_role)
  select id, v_org, profil_participant_id, activite_id, montant, date, mode_paiement, id_externe, 'admin'
  from _import_dons_valid
  on conflict (id) do update set
    profil_participant_id = excluded.profil_participant_id,
    activite_id = excluded.activite_id,
    montant = excluded.montant,
    date = excluded.date,
    mode_paiement = excluded.mode_paiement,
    id_externe = excluded.id_externe
  where dons.organisation_id = v_org;

  v_updated := coalesce(array_length(v_existing_ids, 1), 0);
  v_created := v_valid - v_updated;

  return jsonb_build_object('created', v_created, 'updated', v_updated, 'skipped', v_skipped, 'total', v_total);
end;
$$;
