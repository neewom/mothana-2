-- Fonction d'import en masse des activités, appelée par l'assistant d'import
-- (Paramètres > Import de données legacy). Même principe que
-- import_upsert_participants : le client décide insert (id généré) vs
-- update (id existant retrouvé par id_externe), l'organisation est dérivée
-- côté serveur via current_user_organisation_id().
create or replace function import_upsert_activites(payload jsonb)
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
