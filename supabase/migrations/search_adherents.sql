-- Module Adhérents, étape 3 (page liste) : recherche + pagination côté
-- serveur dès le premier jet, pour éviter de reproduire la lenteur constatée
-- sur Participants avant sa correction (PR #32). Exploite l'index trigram
-- idx_adherents_nom_prenom créé à l'étape 1 (adherents.sql), sur
-- l'expression `nom || ' ' || coalesce(prenom, '')`.
--
-- Recherche par tokens (AND, insensible à l'ordre) plutôt que par sous-chaîne
-- unique, pour que "Jean Dupont" et "Dupont Jean" trouvent tous les deux
-- l'adhérent Jean Dupont — même sémantique que matchesParticipantSearch
-- (src/lib/participantSearch.ts) côté client, ici appliquée côté serveur sur
-- l'expression exacte couverte par l'index (pas besoin d'un second index pour
-- l'ordre inverse).
--
-- Recherche par email ajoutée en OR de la recherche nom/prénom (sous-chaîne
-- simple sur la chaîne complète, pas de tokenisation : un email n'a pas
-- d'ordre de mots à gérer). Pas d'index dédié : volume adhérents trop faible
-- pour justifier un second index trigram.
--
-- security invoker (par défaut) : la RLS de la table `adherents` s'applique
-- normalement à l'appelant, le filtre p_organisation_id est redondant mais
-- volontaire (même convention que le reste de l'app qui filtre toujours
-- explicitement par organisation_id plutôt que de compter uniquement sur la RLS).
create or replace function search_adherents(
  p_organisation_id uuid,
  p_search text default null,
  p_statut text default null,
  p_limit int default 50,
  p_offset int default 0
)
returns table (
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
  created_at timestamptz,
  updated_at timestamptz,
  total_count bigint
)
language sql
stable
as $$
  select
    a.id, a.id_externe, a.civilite, a.nom, a.prenom, a.date_naissance,
    a.adresse, a.code_postal, a.ville, a.telephone, a.courriel,
    a.statut, a.statuts_acceptes, a.consent_rgpd, a.created_at, a.updated_at,
    count(*) over() as total_count
  from adherents a
  where a.organisation_id = p_organisation_id
    and (p_statut is null or a.statut = p_statut)
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
