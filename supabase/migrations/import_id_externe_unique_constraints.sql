-- Ajoute les contraintes uniques manquantes (organisation_id, id_externe)
-- sur profils_participant et activites : la colonne existe déjà mais
-- aucune contrainte ne garantit son unicité par organisation, ce qui est
-- nécessaire pour que l'import upsert (RPC import_upsert_participants /
-- import_upsert_activites) puisse détecter de façon fiable une ligne déjà
-- importée (insert vs update).
--
-- ⚠️ À exécuter uniquement après avoir vérifié l'absence de doublons :
--
--   select organisation_id, id_externe, count(*) from profils_participant
--   where id_externe is not null group by 1, 2 having count(*) > 1;
--
--   select organisation_id, id_externe, count(*) from activites
--   where id_externe is not null group by 1, 2 having count(*) > 1;
--
-- (si des doublons existent, les nettoyer manuellement avant de relancer
-- cette migration.)

alter table profils_participant
  add constraint profils_participant_organisation_id_externe_unique unique (organisation_id, id_externe);

alter table activites
  add constraint activites_organisation_id_externe_unique unique (organisation_id, id_externe);
