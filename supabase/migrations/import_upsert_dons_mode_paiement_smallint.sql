-- Met à jour import_upsert_dons suite au changement de dons.mode_paiement
-- (text -> smallint, cf. dons_mode_paiement_smallint.sql) : seul le type de
-- colonne du temp table déclaré via jsonb_to_recordset change.
create or replace function import_upsert_dons(payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_org uuid := current_user_organisation_id();
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
    mode_paiement          smallint
  );

  v_total := (select count(*) from _import_dons where id is not null);

  -- Lignes dont les clés étrangères sont vérifiées appartenir à cette org
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
