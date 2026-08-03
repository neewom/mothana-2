-- Fonction d'import en masse des adhérents (adherents + adhesions),
-- appelée par l'assistant d'import (module Adhérents, étape 4).
--
-- Plus simple que import_upsert_participants.sql : adherents a déjà
-- organisation_id directement (pas de table personnes séparée partagée entre
-- organisations à garder).
--
-- Le client décide déjà, ligne par ligne (src/lib/import/buildBatch.ts,
-- buildAdherentsBatch), s'il s'agit d'un insert ou d'une update pour
-- adherents (upsert par id_externe pré-résolu), et surtout si une NOUVELLE
-- ligne adhesions doit être créée pour cette ligne (adhesion_id non nul) —
-- jamais recalculé côté serveur. Une adhésion n'est jamais mise à jour en
-- place (historisation, cf. adhesions.sql) : soit une nouvelle ligne est
-- insérée, soit rien n'est fait pour le cycle sur cette ligne.
--
-- security definer : contourne délibérément les RLS pour faire un upsert
-- set-based en un seul appel. L'organisation est dérivée côté serveur via
-- current_user_organisation_id() (jamais un paramètre fourni par le client).
create or replace function import_upsert_adherents(payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_org uuid := current_user_organisation_id();
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

  -- Adhérents déjà existants dans cette org, avant l'upsert (pour compter créés/mis à jour)
  select array_agg(a.id) into v_existing_ids
  from adherents a
  join _import_adherents t on t.adherent_id = a.id
  where a.organisation_id = v_org;

  -- 1) upsert adherents — garde : seule une ligne déjà rattachée à cette
  --    organisation peut être mise à jour (empêche l'écrasement d'un
  --    adherent_id forgé appartenant à une autre organisation).
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

  -- 2) insert adhesions — uniquement les lignes où le client a déterminé
  --    qu'un nouveau cycle est nécessaire (adhesion_id non nul). Jamais
  --    d'update : chaque ligne est un nouveau cycle historisé.
  insert into adhesions (id, adherent_id, date_debut, montant_cotisation, date_paiement_cotisation, mode_paiement, renouvellement, droit_vote_ag, bulletin_signe)
  select adhesion_id, adherent_id, date_debut, montant_cotisation, date_paiement_cotisation, mode_paiement,
         coalesce(renouvellement, false), coalesce(droit_vote_ag, true), coalesce(bulletin_signe, true)
  from _import_adherents
  where adhesion_id is not null and adherent_id is not null;

  v_updated := coalesce(array_length(v_existing_ids, 1), 0);
  v_created := v_total - v_updated;
  v_adhesions_created := (select count(*) from _import_adherents where adhesion_id is not null);

  return jsonb_build_object('created', v_created, 'updated', v_updated, 'total', v_total, 'adhesions_created', v_adhesions_created);
end;
$$;
