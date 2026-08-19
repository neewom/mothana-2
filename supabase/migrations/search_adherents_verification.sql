-- Migration: search_adherents_verification.sql
-- Cadré 2026-08-08 (carte Trello "Vérification carte adhérent par nom/prénom
-- (espace bénévole)") : recherche nom/prénom accessible aux bénévoles, mais
-- volontairement restreinte à nom/prénom/statut/date de fin de validité —
-- pas la fiche complète (adresse/téléphone/email), même pour un bénévole
-- authentifié. D'où une RPC dédiée plutôt que la réutilisation telle quelle
-- de search_adherents (qui renvoie tous les champs de la table) : ça évite
-- que les champs sensibles transitent sur le réseau jusqu'au client, pas
-- seulement qu'ils soient cachés côté UI.
--
-- Réutilise la même logique de recherche par tokens (AND, insensible à
-- l'ordre) que search_adherents.sql, sur le même index trigram
-- idx_adherents_nom_prenom. Recherche vide = aucun résultat (volontaire :
-- pas de listing complet des adhérents pour un bénévole, seulement une
-- vérification ciblée).
--
-- security invoker (par défaut) : la RLS de la table `adherents` s'applique
-- normalement à l'appelant (admin ou bénévole via current_effective_organisation_id()),
-- le filtre p_organisation_id est redondant mais volontaire (même convention
-- que le reste de l'app).
create or replace function search_adherents_verification(
  p_organisation_id uuid,
  p_search text,
  p_limit int default 20
)
returns table (
  nom text,
  prenom text,
  statut text,
  date_fin date
)
language sql
stable
as $$
  select
    a.nom, a.prenom, a.statut, ad.date_fin
  from adherents a
  left join lateral (
    select date_fin from adhesions where adherent_id = a.id order by date_debut desc limit 1
  ) ad on true
  where a.organisation_id = p_organisation_id
    and trim(coalesce(p_search, '')) <> ''
    and (a.nom || ' ' || coalesce(a.prenom, '')) ilike all (
      array(
        select '%' || tok || '%'
        from unnest(string_to_array(trim(p_search), ' ')) as tok
        where tok <> ''
      )
    )
  order by a.nom asc, a.prenom asc
  limit p_limit;
$$;
