-- Recherche globale de la barre du haut (carte « Recherche globale », batch Navigation).
-- Une seule RPC, scopée à l'organisation de l'appelant, qui respecte les modules activés.
-- Recherche `ilike` sur unaccent(lower(...)) filtrée d'abord par organisation : volumes d'une
-- association (quelques milliers de lignes au plus), pas d'index trigram (pg_trgm n'est créé
-- par aucune migration). À revoir si une organisation dépasse ~50 000 lignes. Rejouable.
begin;

create or replace function public.rechercher_global(p_terme text, p_organisation_id uuid default null)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_org uuid;
  v_flags jsonb;
  v_dons boolean;
  v_adherents boolean;
  v_evenements boolean;
  v_terme text := btrim(coalesce(p_terme, ''));
  v_pattern text;
  v_personnes jsonb;
  v_portefeuilles jsonb;
  v_activites jsonb;
  v_vide constant jsonb := jsonb_build_object('personnes', '[]'::jsonb, 'portefeuilles', '[]'::jsonb, 'activites', '[]'::jsonb);
begin
  if auth.uid() is null then
    return v_vide;
  end if;

  -- Organisation : celle du compte admin/contributeur ; un super-admin ne voit que
  -- l'organisation qu'il consulte (paramètre ignoré pour tout autre appelant). Comptes
  -- bénévole et vendeur : pas de profil d'organisation, donc aucun résultat.
  if public.is_current_user_super_admin() then
    v_org := p_organisation_id;
  else
    v_org := public.current_user_organisation_id();
  end if;

  if v_org is null or char_length(v_terme) < 2 then
    return v_vide;
  end if;

  select coalesce(fonctionnalites_activees, '{}'::jsonb) into v_flags
  from public.organisations
  where id = v_org;

  -- Mêmes défauts que DEFAULT_FONCTIONNALITES côté front.
  v_dons := coalesce((v_flags ->> 'dons')::boolean, true);
  v_adherents := coalesce((v_flags ->> 'adherents')::boolean, true);
  v_evenements := coalesce((v_flags ->> 'evenements')::boolean, false);

  -- Terme normalisé ; les jokers LIKE saisis par l'utilisateur sont échappés.
  v_pattern := '%' || replace(replace(replace(lower(unaccent(v_terme)), '\', '\\'), '%', '\%'), '_', '\_') || '%';

  -- Personnes : donateurs (module dons) et adhérents (module adhérents), fusionnés en une
  -- seule ligne quand ils désignent visiblement la même personne (affichage seul, rien n'est
  -- lié en base) :
  --   - même email non vide ;
  --   - ou même nom + prénom normalisés (accents, casse, espaces), même si les emails diffèrent
  --     (ex. hotmail.fr / hotmail.com), à condition que ce nom + prénom soit UNIQUE parmi les
  --     donateurs ET parmi les adhérents de l'organisation : de vrais homonymes restent séparés.
  with donateurs as (
    select
      pp.id as participant_id,
      p.nom,
      p.prenom,
      nullif(lower(btrim(p.email)), '') as email,
      regexp_replace(lower(unaccent(btrim(p.nom) || ' ' || coalesce(btrim(p.prenom), ''))), '\s+', ' ', 'g') as cle
    from public.profils_participant pp
    join public.personnes p on p.id = pp.personne_id
    where v_dons
      and pp.organisation_id = v_org
      and (
        lower(unaccent(p.nom || ' ' || coalesce(p.prenom, ''))) like v_pattern escape '\'
        or lower(unaccent(coalesce(p.prenom, '') || ' ' || p.nom)) like v_pattern escape '\'
        or lower(coalesce(p.email, '')) like v_pattern escape '\'
      )
    order by p.nom, p.prenom
    limit 25
  ),
  adh as (
    select
      a.id as adherent_id,
      a.nom,
      a.prenom,
      nullif(lower(btrim(a.courriel)), '') as email,
      a.statut,
      regexp_replace(lower(unaccent(btrim(a.nom) || ' ' || coalesce(btrim(a.prenom), ''))), '\s+', ' ', 'g') as cle
    from public.adherents a
    where v_adherents
      and a.organisation_id = v_org
      and (
        lower(unaccent(a.nom || ' ' || coalesce(a.prenom, ''))) like v_pattern escape '\'
        or lower(unaccent(coalesce(a.prenom, '') || ' ' || a.nom)) like v_pattern escape '\'
        or lower(coalesce(a.courriel, '')) like v_pattern escape '\'
      )
    order by a.nom, a.prenom
    limit 25
  ),
  -- Nombre de porteurs de chaque nom + prénom dans toute l'organisation (pas seulement parmi
  -- les résultats), pour la règle d'unicité.
  homonymes_donateurs as (
    select k.cle, count(*) as n
    from (
      select regexp_replace(lower(unaccent(btrim(p.nom) || ' ' || coalesce(btrim(p.prenom), ''))), '\s+', ' ', 'g') as cle
      from public.profils_participant pp
      join public.personnes p on p.id = pp.personne_id
      where pp.organisation_id = v_org
    ) k
    where k.cle in (select cle from donateurs)
    group by k.cle
  ),
  homonymes_adherents as (
    select k.cle, count(*) as n
    from (
      select regexp_replace(lower(unaccent(btrim(a.nom) || ' ' || coalesce(btrim(a.prenom), ''))), '\s+', ' ', 'g') as cle
      from public.adherents a
      where a.organisation_id = v_org
    ) k
    where k.cle in (select cle from adh)
    group by k.cle
  ),
  paires as (
    select d.participant_id, a.adherent_id
    from donateurs d
    join adh a
      on (d.email is not null and d.email = a.email)
      or (
        d.cle = a.cle
        and (select n from homonymes_donateurs h where h.cle = d.cle) = 1
        and (select n from homonymes_adherents h where h.cle = a.cle) = 1
      )
  ),
  -- Une association au plus par donateur et par adhérent.
  par_donateur as (
    select distinct on (participant_id) participant_id, adherent_id
    from paires
    order by participant_id, adherent_id
  ),
  appariements as (
    select distinct on (adherent_id) participant_id, adherent_id
    from par_donateur
    order by adherent_id, participant_id
  ),
  lignes as (
    select d.participant_id, ap.adherent_id, d.nom, d.prenom, coalesce(d.email, a.email) as email, a.statut as adherent_statut
    from donateurs d
    left join appariements ap on ap.participant_id = d.participant_id
    left join adh a on a.adherent_id = ap.adherent_id
    union all
    select null::uuid, a.adherent_id, a.nom, a.prenom, a.email, a.statut
    from adh a
    where not exists (select 1 from appariements ap where ap.adherent_id = a.adherent_id)
  )
  select coalesce(jsonb_agg(jsonb_build_object(
    'participant_id', l.participant_id,
    'adherent_id', l.adherent_id,
    'nom', l.nom,
    'prenom', l.prenom,
    'email', l.email,
    'adherent_statut', l.adherent_statut
  ) order by l.nom, l.prenom), '[]'::jsonb)
  into v_personnes
  from (select * from lignes order by nom, prenom limit 5) l;

  -- Portefeuilles (module evenements) : par code public ou par email ; un acheteur anonymisé
  -- n'est jamais retrouvé par son adresse de remplacement, qui n'est pas renvoyée.
  select coalesce(jsonb_agg(row_data order by created_at desc), '[]'::jsonb)
  into v_portefeuilles
  from (
    select
      w.created_at,
      jsonb_build_object(
        'id', w.id,
        'evenement_id', w.evenement_id,
        'evenement_nom', e.nom,
        'email', case when w.anonymise_le is null then w.email end,
        'code_public', w.code_public,
        'solde_centimes', w.solde_centimes,
        'anonymise', w.anonymise_le is not null
      ) as row_data
    from public.portefeuilles w
    join public.evenements e on e.id = w.evenement_id
    where v_evenements
      and w.organisation_id = v_org
      and (
        lower(w.code_public) like v_pattern escape '\'
        or (w.anonymise_le is null and lower(w.email) like v_pattern escape '\')
      )
    order by w.created_at desc
    limit 5
  ) t;

  -- Activités (modules dons ou adhérents, comme leur page).
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', t.id,
    'nom', t.nom,
    'date_debut', t.date_debut
  ) order by t.date_debut desc nulls last, t.nom), '[]'::jsonb)
  into v_activites
  from (
    select ac.id, ac.nom, ac.date_debut
    from public.activites ac
    where (v_dons or v_adherents)
      and ac.organisation_id = v_org
      and lower(unaccent(ac.nom)) like v_pattern escape '\'
    order by ac.date_debut desc nulls last, ac.nom
    limit 5
  ) t;

  return jsonb_build_object('personnes', v_personnes, 'portefeuilles', v_portefeuilles, 'activites', v_activites);
end;
$$;

revoke execute on function public.rechercher_global(text, uuid) from public, anon;
grant execute on function public.rechercher_global(text, uuid) to authenticated;

commit;
