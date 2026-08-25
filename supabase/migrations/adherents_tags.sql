-- Migration: adherents_tags.sql
-- Listes de diffusion (tags adhérents), cadré le 2026-08-25 (carte Trello
-- "Listes de diffusion (tags adhérents)"). Modèle "array de tags" retenu
-- plutôt qu'une table normalisée mailing_listes : les tags émergent de
-- l'usage, pas de "liste vide" pré-déclarable (une liste n'existe que si
-- au moins un adhérent la porte déjà).

ALTER TABLE adherents ADD COLUMN tags text[] NOT NULL DEFAULT '{}';

-- Index GIN pour les filtres par tag (search_adherents, send-mailing-brevo) :
-- appartenance (tag = any(tags)) et exclusion.
CREATE INDEX idx_adherents_tags ON adherents USING gin (tags);

COMMENT ON COLUMN adherents.tags IS 'Listes de diffusion libres (mailing) : array de tags, pas de table dédiée — une liste n''existe que si au moins un adhérent la porte';

-- ---------------------------------------------------------------------------
-- search_adherents étendue : filtre p_tag (inclusion) / p_exclude_tag
-- (exclusion, un seul tag à la fois en v1) + colonne tags en sortie
-- (nuage de tags affiché dans AdherentModal). CREATE OR REPLACE ne permet
-- pas de changer la liste de colonnes en sortie, d'où le DROP explicite
-- (même pattern que search_adherents_mailing_opt_out.sql).
-- ---------------------------------------------------------------------------

DROP FUNCTION IF EXISTS search_adherents(uuid, text, text, int, int);

CREATE FUNCTION search_adherents(
  p_organisation_id uuid,
  p_search text default null,
  p_statut text default null,
  p_limit int default 50,
  p_offset int default 0,
  p_tag text default null,
  p_exclude_tag text default null
)
RETURNS TABLE (
  id uuid,
  id_externe text,
  civilite smallint,
  nom text,
  prenom text,
  date_naissance date,
  adresse text,
  code_postal text,
  ville text,
  telephone text,
  courriel text,
  statut text,
  statuts_acceptes boolean,
  consent_rgpd boolean,
  mailing_opt_out boolean,
  mailing_opt_out_at timestamptz,
  tags text[],
  created_at timestamptz,
  updated_at timestamptz,
  total_count bigint
)
LANGUAGE sql
STABLE
AS $$
  select
    a.id, a.id_externe, a.civilite, a.nom, a.prenom, a.date_naissance,
    a.adresse, a.code_postal, a.ville, a.telephone, a.courriel,
    a.statut, a.statuts_acceptes, a.consent_rgpd, a.mailing_opt_out, a.mailing_opt_out_at,
    a.tags, a.created_at, a.updated_at,
    count(*) over() as total_count
  from adherents a
  where a.organisation_id = p_organisation_id
    and (p_statut is null or a.statut = p_statut)
    and (p_tag is null or p_tag = any(a.tags))
    and (p_exclude_tag is null or not (p_exclude_tag = any(a.tags)))
    and (
      p_search is null or trim(p_search) = ''
      or (a.nom || ' ' || coalesce(a.prenom, '')) ilike all (
        array(
          select '%' || tok || '%'
          from unnest(string_to_array(trim(p_search), ' ')) as tok
          where tok <> ''
        )
      )
      or a.courriel ilike '%' || trim(p_search) || '%'
    )
  order by a.nom asc, a.prenom asc
  limit p_limit offset p_offset;
$$;

-- ---------------------------------------------------------------------------
-- list_adherent_tags : tags distincts déjà utilisés par l'organisation,
-- pour peupler les puces d'autocomplétion (AdherentModal, modale
-- d'affectation en masse) et les menus déroulants de filtre (Adhérents,
-- Mailing) — jamais de "liste vide" proposée.
-- ---------------------------------------------------------------------------

CREATE FUNCTION list_adherent_tags(p_organisation_id uuid)
RETURNS TABLE (tag text)
LANGUAGE sql
STABLE
AS $$
  select distinct t
  from adherents a, unnest(a.tags) as t
  where a.organisation_id = p_organisation_id
  order by t;
$$;

-- ---------------------------------------------------------------------------
-- add_adherents_tag : affectation en masse depuis AdherentsPage (sélection
-- multiple existante, réutilisée pour l'impression de cartes). Une seule
-- requête batch (pas de boucle par adhérent) : fusion + déduplication du
-- tag dans l'array existant de chaque adhérent ciblé.
-- security invoker (défaut) : la RLS de la table adherents s'applique
-- normalement, p_organisation_id est un filtre redondant volontaire (même
-- convention que search_adherents).
-- ---------------------------------------------------------------------------

CREATE FUNCTION add_adherents_tag(
  p_organisation_id uuid,
  p_adherent_ids uuid[],
  p_tag text
)
RETURNS void
LANGUAGE sql
AS $$
  update adherents
  set tags = (
    select array_agg(distinct t order by t)
    from unnest(tags || array[p_tag]) as t
  )
  where organisation_id = p_organisation_id
    and id = any(p_adherent_ids);
$$;
