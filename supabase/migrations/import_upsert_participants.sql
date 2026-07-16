-- Fonction d'import en masse des participants (personnes + profils_participant),
-- appelée par l'assistant d'import (Paramètres > Import de données legacy).
--
-- Le client décide déjà, ligne par ligne, s'il s'agit d'un insert (UUIDs
-- personne_id/profil_id générés côté client via src/lib/uuid.ts) ou d'une
-- update (ids existants, retrouvés via une pré-recherche par id_externe) —
-- même convention que ParticipantModal.tsx (évite le problème de RETURNING
-- bloqué par les policies RLS SELECT).
--
-- security definer : contourne délibérément les RLS pour faire un upsert
-- set-based en un seul appel. L'organisation est dérivée côté serveur via
-- current_user_organisation_id() (jamais un paramètre fourni par le client).
--
-- Sécurité : personnes n'a pas de organisation_id (table partagée entre
-- organisations). La garde sur son update reproduit exactement la policy
-- RLS "personnes_update" que cette fonction contourne : sans elle, un admin
-- pourrait écraser la personne d'une autre organisation via un personne_id
-- forgé dans le payload.
create or replace function import_upsert_participants(payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_org uuid := current_user_organisation_id();
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

  -- Profils déjà existants dans cette org, avant l'upsert (pour compter créés/mis à jour)
  select array_agg(pp.id) into v_existing_profil_ids
  from profils_participant pp
  join _import_participants t on t.profil_id = pp.id
  where pp.organisation_id = v_org;

  -- 1) upsert personnes — garde : seule une personne déjà rattachée à un
  --    profils_participant de cette organisation peut être mise à jour.
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

  -- 2) upsert profils_participant — garde : organisation_id = v_org
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
