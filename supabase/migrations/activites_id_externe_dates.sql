-- Ajoute à activites les colonnes nécessaires pour l'import legacy :
-- id_externe (rattachement des dons legacy à la bonne activité) et dates de début/fin.
alter table activites
  add column id_externe text,
  add column date_debut date,
  add column date_fin date;
