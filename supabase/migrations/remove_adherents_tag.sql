-- Migration: remove_adherents_tag.sql
-- Symétrique de add_adherents_tag (adherents_tags.sql) : retrait en masse d'une
-- liste sur la sélection courante d'AdherentsPage (cadré 2026-09-12). Ne touche
-- pas au registre listes_diffusion (une liste reste enregistrée même si plus
-- aucun adhérent sélectionné ne la porte — cf. gestion_listes_diffusion.sql
-- pour vider/supprimer une liste dans son ensemble).

CREATE FUNCTION remove_adherents_tag(
  p_organisation_id uuid,
  p_adherent_ids uuid[],
  p_tag text
)
RETURNS void
LANGUAGE sql
AS $$
  update adherents
  set tags = array_remove(tags, p_tag)
  where organisation_id = p_organisation_id
    and id = any(p_adherent_ids);
$$;
