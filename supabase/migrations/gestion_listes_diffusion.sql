-- Migration: gestion_listes_diffusion.sql
-- Gestion des listes depuis AdherentsPage (renommer/vider/supprimer, cadré
-- 2026-09-12) : listes_diffusion reste un simple registre de noms, la
-- véritable appartenance vit dans adherents.tags (array par adhérent) —
-- ces opérations doivent donc mettre à jour les deux en une seule requête
-- batch, pas de boucle par adhérent. Security invoker (défaut) : la RLS
-- de adherents/listes_diffusion s'applique normalement, p_organisation_id
-- est un filtre redondant volontaire (même convention que add_adherents_tag).

-- ---------------------------------------------------------------------------
-- list_listes_diffusion_avec_compte : alimente la modale "Gérer les listes"
-- (nom + nombre d'adhérents actuel, pour l'alerte de confirmation Vider/Supprimer).
-- ---------------------------------------------------------------------------

CREATE FUNCTION list_listes_diffusion_avec_compte(p_organisation_id uuid)
RETURNS TABLE(nom text, nombre_adherents bigint)
LANGUAGE sql
STABLE
AS $$
  select ld.nom, count(a.id) as nombre_adherents
  from listes_diffusion ld
  left join adherents a
    on a.organisation_id = ld.organisation_id
    and ld.nom = any(a.tags)
  where ld.organisation_id = p_organisation_id
  group by ld.nom
  order by ld.nom;
$$;

-- ---------------------------------------------------------------------------
-- renommer_liste_diffusion : met à jour le registre ET remplace le tag dans
-- adherents.tags pour tous les adhérents concernés. La contrainte unique
-- (organisation_id, nom) sur listes_diffusion bloque un renommage vers un nom
-- déjà utilisé (pas de fusion automatique, cf. cadrage) — l'update échoue et
-- remonte une erreur 23505 au client.
-- ---------------------------------------------------------------------------

CREATE FUNCTION renommer_liste_diffusion(
  p_organisation_id uuid,
  p_ancien_nom text,
  p_nouveau_nom text
)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE listes_diffusion
  SET nom = p_nouveau_nom
  WHERE organisation_id = p_organisation_id
    AND nom = p_ancien_nom;

  UPDATE adherents
  SET tags = array_replace(tags, p_ancien_nom, p_nouveau_nom)
  WHERE organisation_id = p_organisation_id
    AND p_ancien_nom = any(tags);
END;
$$;

-- ---------------------------------------------------------------------------
-- vider_liste_diffusion : retire le tag de tous les adhérents concernés,
-- la liste reste enregistrée (vide, réutilisable).
-- ---------------------------------------------------------------------------

CREATE FUNCTION vider_liste_diffusion(
  p_organisation_id uuid,
  p_nom text
)
RETURNS void
LANGUAGE sql
AS $$
  update adherents
  set tags = array_remove(tags, p_nom)
  where organisation_id = p_organisation_id
    and p_nom = any(tags);
$$;

-- ---------------------------------------------------------------------------
-- supprimer_liste_diffusion : vider_liste_diffusion + suppression du registre.
-- ---------------------------------------------------------------------------

CREATE FUNCTION supprimer_liste_diffusion(
  p_organisation_id uuid,
  p_nom text
)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE adherents
  SET tags = array_remove(tags, p_nom)
  WHERE organisation_id = p_organisation_id
    AND p_nom = any(tags);

  DELETE FROM listes_diffusion
  WHERE organisation_id = p_organisation_id
    AND nom = p_nom;
END;
$$;
