-- Backfill des nouvelles colonnes adresse/code_postal/ville (refonte Cerfa
-- §1.1) à partir de l'ancienne adresse combinée en une seule chaîne dans
-- modele_recu_pdf.adresse (format "rue, CP Ville"), pour ne pas perdre la
-- donnée déjà saisie par Wat Velouvanaram avant l'ajout des colonnes
-- structurées. Seule cette organisation a une adresse renseignée à ce jour ;
-- les autres champs de modele_recu_pdf (siret, objet_association) n'ont pas
-- de données réelles exploitables (valeurs vides ou placeholder "...") et
-- seront ressaisis lors de l'étape 2 (rna/siren/objet_social).
update organisations
set
  adresse = trim(split_part(modele_recu_pdf->>'adresse', ',', 1)),
  code_postal = (regexp_match(modele_recu_pdf->>'adresse', '(\d{5})'))[1],
  ville = trim(regexp_replace(modele_recu_pdf->>'adresse', '^.*\d{5}\s*', ''))
where adresse is null
  and coalesce(modele_recu_pdf->>'adresse', '') != '';
