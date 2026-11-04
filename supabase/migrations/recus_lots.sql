-- Migration: recus_lots.sql
-- 2026-11-04 (carte « Reçus en lot 1/5 : file d'attente et génération côté serveur »,
-- https://trello.com/c/L20reGaP). « Générer les reçus manquants » tournait dans le navigateur (onglet
-- obligatoire, rechargement complet après chaque reçu). Un lot de génération vit désormais en base et
-- est traité côté serveur, par paquets, même onglet fermé :
--   - recus_lots / recus_lot_lignes : la file (lecture organisation + bypass super-admin, aucune
--     écriture client : tout passe par les fonctions ci-dessous) ;
--   - lancer_lot_recus / arreter_lot_recus : appelées par un admin (ou contributeur) de l'organisation,
--     ou par le super-admin ;
--   - prendre_lot_recus / ligne_suivante_lot_recus / terminer_ligne_lot_recus / liberer_lot_recus :
--     service_role seulement, appelées par l'Edge Function traiter-lots-recus ;
--   - planifier_traitement_lots_recus : appelée chaque minute par pg_cron ; une seule lecture (index
--     partiel) quand aucun lot n'attend, sinon appel HTTP asynchrone (pg_net) de traiter-lots-recus.
--
-- Règle des reçus manquants : recus_manquants_lot, réécriture exacte de recusAGenerer.ts +
-- comparerOrdreAttribution (src/lib/recusAGenerer.ts) et de la construction des lignes de
-- RecusFiscauxPage (donateurs ayant au moins un don de l'année dans l'organisation, sans reçu pour
-- l'année, fiche complète au sens de validateParticipantCerfa ; aucun si l'organisation est incomplète
-- au sens de validateOrganisationCerfa). Ordre : nom puis prénom en collation française (fr-x-icu, même
-- résultat que localeCompare('fr')), puis id du profil. Les numéros d'un lot sont attribués dans cet
-- ordre : une seule exécution à la fois par lot (bail traitement_jusqu_a), lignes prises par rang.
--
-- Secrets (jamais dans le dépôt) : l'URL de la fonction et le secret partagé sont lus dans Supabase
-- Vault (noms traiter_lots_recus_url et traiter_lots_recus_secret) ; le même secret est posé côté
-- fonction (secret TRAITER_LOTS_RECUS_SECRET). Procédure dans l'en-tête de
-- supabase/functions/traiter-lots-recus/index.ts. Sans ces secrets, la tâche planifiée ne fait rien
-- (avertissement dans les journaux Postgres). Ré-exécutable.

begin;

-- ---------------------------------------------------------------------------
-- 1. Tables
-- ---------------------------------------------------------------------------

create table if not exists public.recus_lots (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  annee integer not null,
  type text not null default 'generation' check (type in ('generation')),
  statut text not null default 'en_cours' check (statut in ('en_cours', 'arrete', 'termine')),
  -- auth.users.id (sans clé étrangère, comme recus_fiscaux_versions.genere_par)
  cree_par uuid,
  cree_le timestamptz not null default now(),
  arrete_par uuid,
  arrete_le timestamptz,
  termine_le timestamptz,
  nb_total integer not null default 0,
  nb_faits integer not null default 0,
  nb_echecs integer not null default 0,
  -- Bail d'exécution : tant qu'il court, une exécution de traiter-lots-recus traite ce lot (une seule à
  -- la fois, pour attribuer les numéros dans l'ordre des lignes).
  traitement_jusqu_a timestamptz
);

comment on table public.recus_lots is
  'Lots de génération de reçus fiscaux traités côté serveur (traiter-lots-recus). Écriture par les fonctions recus_lots seulement.';

-- Un seul lot en cours par organisation, année et type ; sert aussi à la lecture de la tâche planifiée.
create unique index if not exists recus_lots_un_en_cours
  on public.recus_lots (organisation_id, annee, type)
  where statut = 'en_cours';

create index if not exists recus_lots_organisation_idx
  on public.recus_lots (organisation_id, annee, cree_le desc);

create table if not exists public.recus_lot_lignes (
  id uuid primary key default gen_random_uuid(),
  lot_id uuid not null references public.recus_lots(id) on delete cascade,
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  profil_participant_id uuid not null references public.profils_participant(id) on delete cascade,
  rang integer not null,
  statut text not null default 'a_faire' check (statut in ('a_faire', 'en_cours', 'fait', 'echec')),
  tentatives integer not null default 0,
  erreur text,
  recu_id uuid references public.recus_fiscaux(id) on delete set null,
  -- Reçu déjà émis au moment du traitement (génération manuelle entre-temps) : ligne faite sans nouvelle version.
  recu_preexistant boolean not null default false,
  modifie_le timestamptz not null default now(),
  unique (lot_id, rang),
  unique (lot_id, profil_participant_id)
);

comment on table public.recus_lot_lignes is
  'Lignes d''un lot de reçus (un donateur chacune, rang = ordre d''attribution des numéros).';

create index if not exists recus_lot_lignes_a_traiter_idx
  on public.recus_lot_lignes (lot_id, rang)
  where statut in ('a_faire', 'en_cours');

-- ---------------------------------------------------------------------------
-- 2. RLS : lecture organisation + bypass super-admin ; aucune écriture client
-- ---------------------------------------------------------------------------

alter table public.recus_lots enable row level security;
alter table public.recus_lot_lignes enable row level security;

drop policy if exists recus_lots_select on public.recus_lots;
create policy recus_lots_select on public.recus_lots
  for select
  to authenticated
  using (
    organisation_id = (select public.current_user_organisation_id())
    or ((select auth.jwt()) -> 'app_metadata' ->> 'is_super_admin')::boolean = true
  );

drop policy if exists recus_lot_lignes_select on public.recus_lot_lignes;
create policy recus_lot_lignes_select on public.recus_lot_lignes
  for select
  to authenticated
  using (
    organisation_id = (select public.current_user_organisation_id())
    or ((select auth.jwt()) -> 'app_metadata' ->> 'is_super_admin')::boolean = true
  );

revoke all on public.recus_lots, public.recus_lot_lignes from anon;
revoke insert, update, delete, truncate, references, trigger on public.recus_lots, public.recus_lot_lignes from authenticated;
grant select on public.recus_lots, public.recus_lot_lignes to authenticated;
grant select, insert, update on public.recus_lots, public.recus_lot_lignes to service_role;

-- ---------------------------------------------------------------------------
-- 3. Reçus manquants d'une année (même règle et même ordre que recusAGenerer.ts)
-- ---------------------------------------------------------------------------

create or replace function public.recus_manquants_lot(p_organisation_id uuid, p_annee integer)
returns table (profil_participant_id uuid, rang integer)
language sql
stable
set search_path = ''
as $$
  with org as (
    -- validateOrganisationCerfa : adresse, code postal, ville, RNA ou SIREN, objet social, mention légale
    select 1
      from public.organisations o
     where o.id = p_organisation_id
       and coalesce(o.adresse, '') <> ''
       and coalesce(o.code_postal, '') <> ''
       and coalesce(o.ville, '') <> ''
       and (coalesce(o.modele_recu_pdf ->> 'rna', '') <> '' or coalesce(o.modele_recu_pdf ->> 'siren', '') <> '')
       and coalesce(o.modele_recu_pdf ->> 'objet_social', '') <> ''
       and coalesce(o.modele_recu_pdf ->> 'mention_legale', '') <> ''
  ),
  donateurs as (
    select distinct d.profil_participant_id
      from public.dons d
     where d.organisation_id = p_organisation_id
       and d.date >= make_date(p_annee, 1, 1)
       and d.date <= make_date(p_annee, 12, 31)
  )
  select pp.id,
         (row_number() over (
           order by pe.nom collate "fr-x-icu", coalesce(pe.prenom, '') collate "fr-x-icu", pp.id
         ))::integer
    from donateurs dn
    join public.profils_participant pp on pp.id = dn.profil_participant_id
    join public.personnes pe on pe.id = pp.personne_id
   where exists (select 1 from org)
     and not exists (
       select 1 from public.recus_fiscaux rf
        where rf.organisation_id = p_organisation_id
          and rf.profil_participant_id = pp.id
          and rf.annee = p_annee
     )
     -- validateParticipantCerfa : civilité renseignée (ni 0 ni famille), nom, adresse, code postal,
     -- ville, prénom pour les particuliers (1 à 4)
     and coalesce(pe.civilite, 0) not in (0, 7)
     and coalesce(pe.nom, '') <> ''
     and coalesce(pe.adresse, '') <> ''
     and coalesce(pe.code_postal, '') <> ''
     and coalesce(pe.ville, '') <> ''
     and (pe.civilite not in (1, 2, 3, 4) or coalesce(pe.prenom, '') <> '')
$$;

revoke execute on function public.recus_manquants_lot(uuid, integer) from public, anon, authenticated;
grant execute on function public.recus_manquants_lot(uuid, integer) to service_role;

-- ---------------------------------------------------------------------------
-- 4. Lancer / arrêter un lot (admin ou contributeur de l'organisation, ou super-admin)
-- ---------------------------------------------------------------------------

create or replace function public.lancer_lot_recus(p_organisation_id uuid, p_annee integer)
returns uuid
language plpgsql
security definer
-- public : les helpers d'identité (current_user_organisation_id, current_user_role) n'ont pas de
-- search_path propre et lisent profils_organisation sans schéma.
set search_path = public, pg_temp
as $$
declare
  v_lot_id uuid;
  v_total integer;
begin
  if not coalesce(
    public.is_current_user_super_admin()
    or (p_organisation_id = public.current_user_organisation_id()
        and public.current_user_role() in ('admin', 'contributeur')),
    false
  ) then
    raise exception 'ACCES_REFUSE' using errcode = '42501';
  end if;

  if p_annee is null or p_annee < 2000 or p_annee > 2100 then
    raise exception 'ANNEE_INVALIDE';
  end if;

  if exists (
    select 1 from public.recus_lots l
     where l.organisation_id = p_organisation_id and l.annee = p_annee
       and l.type = 'generation' and l.statut = 'en_cours'
  ) then
    raise exception 'LOT_DEJA_EN_COURS';
  end if;

  insert into public.recus_lots (organisation_id, annee, type, cree_par)
    values (p_organisation_id, p_annee, 'generation', auth.uid())
    returning id into v_lot_id;

  insert into public.recus_lot_lignes (lot_id, organisation_id, profil_participant_id, rang)
    select v_lot_id, p_organisation_id, m.profil_participant_id, m.rang
      from public.recus_manquants_lot(p_organisation_id, p_annee) m;
  get diagnostics v_total = row_count;

  if v_total = 0 then
    raise exception 'AUCUN_RECU_MANQUANT';
  end if;

  update public.recus_lots set nb_total = v_total where id = v_lot_id;
  return v_lot_id;
exception
  -- Deux lancements simultanés : l'index unique partiel tranche.
  when unique_violation then
    raise exception 'LOT_DEJA_EN_COURS';
end;
$$;

revoke execute on function public.lancer_lot_recus(uuid, integer) from public, anon;
grant execute on function public.lancer_lot_recus(uuid, integer) to authenticated, service_role;

create or replace function public.arreter_lot_recus(p_lot_id uuid)
returns void
language plpgsql
security definer
-- public : les helpers d'identité (current_user_organisation_id, current_user_role) n'ont pas de
-- search_path propre et lisent profils_organisation sans schéma.
set search_path = public, pg_temp
as $$
declare
  v_lot public.recus_lots%rowtype;
begin
  select * into v_lot from public.recus_lots where id = p_lot_id for update;

  if not coalesce(
    public.is_current_user_super_admin()
    or (v_lot.organisation_id = public.current_user_organisation_id()
        and public.current_user_role() in ('admin', 'contributeur')),
    false
  ) then
    raise exception 'ACCES_REFUSE' using errcode = '42501';
  end if;

  if v_lot.statut <> 'en_cours' then
    raise exception 'LOT_NON_EN_COURS';
  end if;

  update public.recus_lots
     set statut = 'arrete', arrete_par = auth.uid(), arrete_le = now()
   where id = p_lot_id;
end;
$$;

revoke execute on function public.arreter_lot_recus(uuid) from public, anon;
grant execute on function public.arreter_lot_recus(uuid) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 5. Traitement (service_role seulement : Edge Function traiter-lots-recus)
-- ---------------------------------------------------------------------------

-- Prend le plus ancien lot en cours dont le bail est libre (ou expiré) et pose un bail.
create or replace function public.prendre_lot_recus(p_bail_secondes integer, p_exclure uuid[] default '{}')
returns table (lot_id uuid, organisation_id uuid, annee integer, cree_par uuid)
language plpgsql
set search_path = ''
as $$
declare
  v_lot public.recus_lots%rowtype;
begin
  select * into v_lot
    from public.recus_lots l
   where l.statut = 'en_cours'
     and (l.traitement_jusqu_a is null or l.traitement_jusqu_a < now())
     and not (l.id = any (coalesce(p_exclure, '{}')))
   order by l.cree_le
   limit 1
   for update skip locked;

  if not found then
    return;
  end if;

  update public.recus_lots
     set traitement_jusqu_a = now() + make_interval(secs => p_bail_secondes)
   where id = v_lot.id;

  return query select v_lot.id, v_lot.organisation_id, v_lot.annee, v_lot.cree_par;
end;
$$;

-- Ligne suivante du lot (par rang), marquée en cours, tentative comptée, bail prolongé. Rien si le lot
-- n'est plus en cours (arrêté) ou s'il est terminé (passé alors à « termine »). Une ligne restée
-- « en_cours » (exécution interrompue) est reprise ; au-delà de 3 tentatives elle passe en échec.
create or replace function public.ligne_suivante_lot_recus(p_lot_id uuid, p_bail_secondes integer)
returns table (ligne_id uuid, profil_participant_id uuid, tentatives integer)
language plpgsql
set search_path = ''
as $$
declare
  v_statut text;
  v_ligne public.recus_lot_lignes%rowtype;
begin
  select l.statut into v_statut from public.recus_lots l where l.id = p_lot_id for update;
  if v_statut is distinct from 'en_cours' then
    return;
  end if;

  loop
    select * into v_ligne
      from public.recus_lot_lignes g
     where g.lot_id = p_lot_id and g.statut in ('a_faire', 'en_cours')
     order by g.rang
     limit 1
     for update;

    if not found then
      update public.recus_lots
         set statut = 'termine', termine_le = now(), traitement_jusqu_a = null,
             nb_faits = (select count(*) from public.recus_lot_lignes g where g.lot_id = p_lot_id and g.statut = 'fait'),
             nb_echecs = (select count(*) from public.recus_lot_lignes g where g.lot_id = p_lot_id and g.statut = 'echec')
       where id = p_lot_id;
      return;
    end if;

    exit when v_ligne.tentatives < 3;

    update public.recus_lot_lignes
       set statut = 'echec', modifie_le = now(),
           erreur = coalesce(v_ligne.erreur, 'Traitement interrompu à plusieurs reprises')
     where id = v_ligne.id;
    update public.recus_lots set nb_echecs = nb_echecs + 1 where id = p_lot_id;
  end loop;

  update public.recus_lot_lignes
     set statut = 'en_cours', tentatives = v_ligne.tentatives + 1, modifie_le = now()
   where id = v_ligne.id;
  update public.recus_lots
     set traitement_jusqu_a = now() + make_interval(secs => p_bail_secondes)
   where id = p_lot_id;

  return query select v_ligne.id, v_ligne.profil_participant_id, v_ligne.tentatives + 1;
end;
$$;

-- Résultat d'une ligne : 'fait', 'echec' (définitif) ou 'reessayer' (erreur passagère : la ligne revient
-- « a_faire » pour le passage suivant, ou passe en échec après la 3e tentative). Renvoie le statut final.
create or replace function public.terminer_ligne_lot_recus(
  p_ligne_id uuid,
  p_resultat text,
  p_erreur text default null,
  p_recu_id uuid default null,
  p_recu_preexistant boolean default false
)
returns text
language plpgsql
set search_path = ''
as $$
declare
  v_ligne public.recus_lot_lignes%rowtype;
  v_statut text;
begin
  select * into v_ligne from public.recus_lot_lignes where id = p_ligne_id for update;
  if not found then
    raise exception 'LIGNE_INTROUVABLE';
  end if;

  v_statut := case
    when p_resultat = 'fait' then 'fait'
    when p_resultat = 'echec' then 'echec'
    when p_resultat = 'reessayer' and v_ligne.tentatives >= 3 then 'echec'
    when p_resultat = 'reessayer' then 'a_faire'
  end;
  if v_statut is null then
    raise exception 'RESULTAT_INVALIDE: %', p_resultat;
  end if;

  update public.recus_lot_lignes
     set statut = v_statut,
         erreur = case when v_statut = 'fait' then null else p_erreur end,
         recu_id = coalesce(p_recu_id, recu_id),
         recu_preexistant = (v_statut = 'fait' and p_recu_preexistant),
         modifie_le = now()
   where id = p_ligne_id;

  update public.recus_lots l
     set nb_faits = (select count(*) from public.recus_lot_lignes g where g.lot_id = l.id and g.statut = 'fait'),
         nb_echecs = (select count(*) from public.recus_lot_lignes g where g.lot_id = l.id and g.statut = 'echec')
   where l.id = v_ligne.lot_id;

  return v_statut;
end;
$$;

-- Fin d'exécution : libère le bail ; un lot en cours sans plus aucune ligne à traiter passe « termine ».
create or replace function public.liberer_lot_recus(p_lot_id uuid)
returns void
language plpgsql
set search_path = ''
as $$
begin
  update public.recus_lots l
     set traitement_jusqu_a = null,
         statut = case
           when l.statut = 'en_cours' and not exists (
             select 1 from public.recus_lot_lignes g where g.lot_id = l.id and g.statut in ('a_faire', 'en_cours')
           ) then 'termine' else l.statut end,
         termine_le = case
           when l.statut = 'en_cours' and not exists (
             select 1 from public.recus_lot_lignes g where g.lot_id = l.id and g.statut in ('a_faire', 'en_cours')
           ) then now() else l.termine_le end
   where l.id = p_lot_id;
end;
$$;

revoke execute on function public.prendre_lot_recus(integer, uuid[]) from public, anon, authenticated;
revoke execute on function public.ligne_suivante_lot_recus(uuid, integer) from public, anon, authenticated;
revoke execute on function public.terminer_ligne_lot_recus(uuid, text, text, uuid, boolean) from public, anon, authenticated;
revoke execute on function public.liberer_lot_recus(uuid) from public, anon, authenticated;
grant execute on function public.prendre_lot_recus(integer, uuid[]) to service_role;
grant execute on function public.ligne_suivante_lot_recus(uuid, integer) to service_role;
grant execute on function public.terminer_ligne_lot_recus(uuid, text, text, uuid, boolean) to service_role;
grant execute on function public.liberer_lot_recus(uuid) to service_role;

-- ---------------------------------------------------------------------------
-- 6. Tâche planifiée : une seule lecture si aucun lot n'attend, sinon appel de traiter-lots-recus
-- ---------------------------------------------------------------------------

create extension if not exists pg_net with schema extensions;

create or replace function public.planifier_traitement_lots_recus()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_url text;
  v_secret text;
begin
  -- Lecture légère (index partiel recus_lots_un_en_cours) : rien à faire, ou un traitement en cours.
  if not exists (
    select 1 from public.recus_lots l
     where l.statut = 'en_cours'
       and (l.traitement_jusqu_a is null or l.traitement_jusqu_a < now())
  ) then
    return;
  end if;

  select s.decrypted_secret into v_url from vault.decrypted_secrets s where s.name = 'traiter_lots_recus_url';
  select s.decrypted_secret into v_secret from vault.decrypted_secrets s where s.name = 'traiter_lots_recus_secret';
  if v_url is null or v_secret is null then
    raise warning 'planifier_traitement_lots_recus : secrets Vault traiter_lots_recus_url / traiter_lots_recus_secret absents, lot non traité';
    return;
  end if;

  perform net.http_post(
    url := v_url,
    body := '{}'::jsonb,
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-traitement-secret', v_secret),
    timeout_milliseconds := 10000
  );
end;
$$;

revoke execute on function public.planifier_traitement_lots_recus() from public, anon, authenticated;

commit;

-- ---------------------------------------------------------------------------
-- 7. Planification chaque minute (hors transaction ; cron.schedule remplace un job existant du même
--    nom, donc rejouable). À appliquer aussi en prod à la promotion (pg_cron y est déjà utilisé par
--    purger-donnees-evenements, migration coupon_rgpd_anonymisation.sql), après avoir posé les secrets.
-- ---------------------------------------------------------------------------

create extension if not exists pg_cron;
select cron.schedule(
  'traiter-lots-recus',
  '* * * * *',
  $$select public.planifier_traitement_lots_recus()$$
);
