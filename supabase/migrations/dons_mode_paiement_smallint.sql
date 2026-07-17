-- Remplace le mode_paiement texte (virement/cheque/especes) par un code
-- numérique aligné sur la classification des données legacy à importer :
--   1 = Espèces, 2 = Chèque, 3 = Prélèvement - virement, 4 = Autres
-- Même pattern que personnes.civilite (smallint + fichier de libellés
-- séparé côté client, src/lib/modePaiement.ts).

alter table dons drop constraint dons_mode_paiement_check;

alter table dons
  alter column mode_paiement type smallint
  using (
    case mode_paiement
      when 'virement' then 3
      when 'cheque' then 2
      when 'especes' then 1
    end
  );

alter table dons
  add constraint dons_mode_paiement_check check (mode_paiement in (1, 2, 3, 4));
