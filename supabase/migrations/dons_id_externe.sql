-- Ajoute id_externe à dons pour permettre la ré-importation idempotente
-- des dons legacy (même principe que profils_participant.id_externe /
-- activites.id_externe déjà en place).
alter table dons add column id_externe text;

-- Les dons créés manuellement (DonModal) laissent id_externe à NULL ;
-- Postgres autorise plusieurs NULL dans une contrainte unique, donc
-- seuls les doublons non-NULL (id_externe en conflit dans une même org)
-- sont bloqués.
alter table dons
  add constraint dons_organisation_id_externe_unique unique (organisation_id, id_externe);
