-- Migration: recus_lots_envoi.sql
-- 2026-11-04 (carte « Reçus en lot 4/5 : envoi en lot étalé selon le quota »,
-- https://trello.com/c/htWVqsUU). À appliquer après recus_lots.sql et recus_email_brevo.sql.
-- « Envoyer les reçus non envoyés » passe par la file d'attente des lots (recus_lots, type 'envoi'),
-- traitée par traiter-lots-recus à un rythme borné par organisation :
--   - lignes = reçus de l'année dont la dernière version n'a pas été envoyée (recus_envoi_lot) ;
--     exclus, avec la raison : donateur sans email ou au format invalide, email marqué invalide par un
--     rejet Brevo (profils_participant.email_invalide_at), envoi incertain lors d'un lot précédent ;
--   - rythme (organisations.modele_recu_pdf : envoi_lot_par_jour, défaut 250, et envoi_lot_par_minute,
--     défaut 5) : budget_envoi_lot_recus compte les envois de reçus de l'organisation sur 24 h
--     glissantes et sur la dernière minute (envois manuels compris : recus_fiscaux_versions.email_envoye_le)
--     et met le lot en attente (en_attente_jusqu_a) quand le quota du jour est atteint ;
--   - une ligne dont l'envoi est ambigu (erreur Brevo sans statut, ≥ 500, délai dépassé, exécution
--     interrompue pendant l'envoi) passe « a_verifier » : jamais de nouvelle tentative automatique ;
--   - un lot d'envoi ne se lance pas pendant une génération en lot de la même année (un reçu en cours
--     de génération n'est pas envoyé).
--   - envoi en lot réservé aux organisations qui ont configuré Brevo (clé API et expéditeur) :
--     lancer_lot_envoi_recus refuse sinon (BREVO_REQUIS), recapitulatif_envoi_lot_recus renvoie
--     brevo_configure pour l'écran ; un lot n'utilise jamais le secours Resend (l'envoi unitaire, si).
--   - un changement du quota du jour réévalue l'attente des lots d'envoi en cours (section 7).
-- Lecture organisation + bypass super-admin (policies de recus_lots.sql) ; aucune écriture client.
-- Ré-exécutable.

begin;

-- ---------------------------------------------------------------------------
-- 1. Colonnes
-- ---------------------------------------------------------------------------

alter table public.recus_lots drop constraint if exists recus_lots_type_check;
alter table public.recus_lots add constraint recus_lots_type_check check (type in ('generation', 'envoi'));

alter table public.recus_lots
  add column if not exists nb_a_verifier integer not null default 0,
  -- Lot d'envoi en pause jusqu'à cette date (quota du jour atteint) : ni la tâche planifiée ni
  -- traiter-lots-recus ne le prennent avant.
  add column if not exists en_attente_jusqu_a timestamptz;

comment on column public.recus_lots.en_attente_jusqu_a is
  'Lot d''envoi : quota d''envoi de l''organisation atteint, reprise à partir de cette date.';

alter table public.recus_lot_lignes drop constraint if exists recus_lot_lignes_statut_check;
alter table public.recus_lot_lignes add constraint recus_lot_lignes_statut_check
  check (statut in ('a_faire', 'en_cours', 'fait', 'echec', 'a_verifier'));

alter table public.recus_lot_lignes
  -- Lot d'envoi : version visée au lancement, puis version effectivement envoyée.
  add column if not exists version_id uuid references public.recus_fiscaux_versions(id),
  add column if not exists envoye_le timestamptz,
  add column if not exists email_canal text,
  -- Lot d'envoi : dernière version déjà envoyée entre-temps (envoi manuel) : ligne faite sans email.
  add column if not exists deja_envoye boolean not null default false;

-- Canal 'simulation' : adresse de test en .invalid (RFC 2606, jamais délivrable) avec la simulation
-- activée sur le projet (secret SIMULER_ENVOI_RECUS_INVALID de traiter-lots-recus, staging seulement) :
-- aucun email ne part, la version est marquée envoyée.
alter table public.recus_fiscaux drop constraint if exists recus_fiscaux_email_canal_check;
alter table public.recus_fiscaux add constraint recus_fiscaux_email_canal_check
  check (email_canal is null or email_canal in ('brevo', 'resend', 'simulation'));

-- Comptage des envois récents d'une organisation (quota).
create index if not exists recus_fiscaux_versions_envois_idx
  on public.recus_fiscaux_versions (organisation_id, email_envoye_le)
  where email_envoye_le is not null;

create index if not exists recus_lot_lignes_a_verifier_idx
  on public.recus_lot_lignes (organisation_id, modifie_le)
  where statut = 'a_verifier';

-- ---------------------------------------------------------------------------
-- 2. Rythme et envois récents (service_role)
-- ---------------------------------------------------------------------------

-- Rythme d'envoi en lot de l'organisation : modele_recu_pdf.envoi_lot_par_jour (1 à 10 000, défaut 250)
-- et envoi_lot_par_minute (1 à 60, défaut 5). Valeur absente ou hors bornes : défaut.
create or replace function public.rythme_envoi_recus(p_organisation_id uuid)
returns table (par_jour integer, par_minute integer)
language sql
stable
set search_path = ''
as $$
  with m as (
    select o.modele_recu_pdf ->> 'envoi_lot_par_jour' as j, o.modele_recu_pdf ->> 'envoi_lot_par_minute' as mi
      from public.organisations o where o.id = p_organisation_id
  )
  select
    coalesce((select case when j ~ '^\d{1,5}$' and j::integer between 1 and 10000 then j::integer end from m), 250),
    coalesce((select case when mi ~ '^\d{1,2}$' and mi::integer between 1 and 60 then mi::integer end from m), 5)
$$;

-- Envois de reçus de l'organisation depuis p_depuis : versions marquées envoyées (lots et envois
-- manuels), plus les envois incertains (peut-être partis) des lots.
create or replace function public.envois_recus_depuis(p_organisation_id uuid, p_depuis timestamptz)
returns integer
language sql
stable
set search_path = ''
as $$
  select (
    (select count(*) from public.recus_fiscaux_versions v
      where v.organisation_id = p_organisation_id and v.email_envoye_le > p_depuis)
    + (select count(*) from public.recus_lot_lignes g
      where g.organisation_id = p_organisation_id and g.statut = 'a_verifier' and g.modifie_le > p_depuis)
  )::integer
$$;

revoke execute on function public.rythme_envoi_recus(uuid) from public, anon, authenticated;
revoke execute on function public.envois_recus_depuis(uuid, timestamptz) from public, anon, authenticated;
grant execute on function public.rythme_envoi_recus(uuid) to service_role;
grant execute on function public.envois_recus_depuis(uuid, timestamptz) to service_role;

-- ---------------------------------------------------------------------------
-- 3. Reçus à envoyer d'une année (service_role)
-- ---------------------------------------------------------------------------

-- Un reçu par donateur : à envoyer si sa dernière version n'est pas marquée envoyée (reçu sans version,
-- antérieur aux versions : si recus_fiscaux.email_envoye_at est vide). raison non nulle = exclu.
-- rang : nom puis prénom (même ordre que les lots de génération).
create or replace function public.recus_envoi_lot(p_organisation_id uuid, p_annee integer)
returns table (profil_participant_id uuid, recu_id uuid, version_id uuid, rang integer, nom text, prenom text, raison text)
language sql
stable
set search_path = ''
as $$
  with candidats as (
    select rf.profil_participant_id, rf.id as recu_id, v.id as version_id,
           pe.nom, pe.prenom, btrim(coalesce(pe.email, ''), E' \t\r\n') as email,
           pp.email_invalide_at
      from public.recus_fiscaux rf
      join public.profils_participant pp on pp.id = rf.profil_participant_id
      join public.personnes pe on pe.id = pp.personne_id
      left join lateral (
        select v.id, v.email_envoye_le
          from public.recus_fiscaux_versions v
         where v.recu_id = rf.id
         order by v.version desc
         limit 1
      ) v on true
     where rf.organisation_id = p_organisation_id
       and rf.annee = p_annee
       and rf.fichier_url is not null
       and case when v.id is not null then v.email_envoye_le is null else rf.email_envoye_at is null end
       -- Version déjà envoyée par un lot dont le marquage de la version a échoué : pas de second envoi.
       and not exists (
         select 1 from public.recus_lot_lignes g
          where g.organisation_id = p_organisation_id and g.recu_id = rf.id and g.statut = 'fait'
            and not g.deja_envoye and g.version_id is not distinct from v.id
            and exists (select 1 from public.recus_lots l where l.id = g.lot_id and l.type = 'envoi')
       )
  )
  select c.profil_participant_id, c.recu_id, c.version_id,
         (row_number() over (
           order by c.nom collate "fr-x-icu", coalesce(c.prenom, '') collate "fr-x-icu", c.profil_participant_id
         ))::integer,
         c.nom, c.prenom,
         case
           when c.email = '' then 'Aucune adresse email'
           when c.email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then 'Adresse email au format invalide'
           when c.email_invalide_at is not null then
             'Email invalide : un envoi précédent n''a pas pu être délivré (le '
             || to_char(c.email_invalide_at at time zone 'Europe/Paris', 'DD/MM/YYYY') || ')'
           -- Ligne « a_verifier », ou restée « en_cours » (exécution interrompue pendant l'envoi, lot
           -- arrêté avant le classement) dans un lot d'envoi précédent : l'email a pu partir.
           when exists (
             select 1 from public.recus_lot_lignes g
               join public.recus_lots l on l.id = g.lot_id and l.type = 'envoi'
              where g.organisation_id = p_organisation_id
                and g.recu_id = c.recu_id
                and g.statut in ('a_verifier', 'en_cours')
                and g.version_id is not distinct from c.version_id
           ) then 'Envoi incertain lors d''un lot précédent : vérifiez (journal des emails de Brevo, ou auprès du donateur), puis envoyez-le depuis son détail si besoin'
         end
    from candidats c
$$;

revoke execute on function public.recus_envoi_lot(uuid, integer) from public, anon, authenticated;
grant execute on function public.recus_envoi_lot(uuid, integer) to service_role;

-- Classement d'une ligne d'envoi restée « en_cours » (exécution interrompue pendant l'envoi) : jamais
-- renvoyée ; faite si sa version a été marquée envoyée depuis la prise de la ligne, sinon « a_verifier ».
-- Utilisé par ligne_suivante_lot_recus (lot en cours) et lancer_lot_envoi_recus (lots arrêtés).
create or replace function public.classer_ligne_envoi_interrompue(p_ligne_id uuid)
returns void
language plpgsql
set search_path = ''
as $$
declare
  v_ligne public.recus_lot_lignes%rowtype;
  v_envoi record;
begin
  select * into v_ligne from public.recus_lot_lignes g where g.id = p_ligne_id and g.statut = 'en_cours' for update;
  if not found then
    return;
  end if;

  select v.id, v.email_envoye_le into v_envoi
    from public.recus_fiscaux_versions v
   where v.recu_id = v_ligne.recu_id and v.email_envoye_le >= v_ligne.modifie_le
   order by v.version desc
   limit 1;
  if found then
    update public.recus_lot_lignes
       set statut = 'fait', erreur = null, version_id = v_envoi.id, envoye_le = v_envoi.email_envoye_le, modifie_le = now()
     where id = v_ligne.id;
  else
    update public.recus_lot_lignes
       set statut = 'a_verifier', modifie_le = now(),
           erreur = 'Traitement interrompu pendant l''envoi : vérifiez (journal des emails de Brevo, ou auprès du donateur) si l''email est parti'
     where id = v_ligne.id;
  end if;
end;
$$;

revoke execute on function public.classer_ligne_envoi_interrompue(uuid) from public, anon, authenticated;
grant execute on function public.classer_ligne_envoi_interrompue(uuid) to service_role;

-- ---------------------------------------------------------------------------
-- 4. Récapitulatif et lancement (admin ou contributeur de l'organisation, ou super-admin)
-- ---------------------------------------------------------------------------

-- Envoi en lot réservé aux organisations qui ont configuré Brevo (décision utilisateur, 2026-11-04) :
-- clé API (organisation_secrets) et expéditeur (nom et adresse, organisations), comme
-- brevoConfigure (src/lib/brevoConfig.ts) et brevoUtilisable (_shared/envoiRecuEmail.ts). Le lot
-- n'utilise jamais le secours Resend ; l'envoi unitaire reste possible sans Brevo.
create or replace function public.brevo_configure_organisation(p_organisation_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce((
    select nullif(btrim(s.brevo_api_key), '') is not null
           and nullif(btrim(o.brevo_expediteur_nom), '') is not null
           and nullif(btrim(o.brevo_expediteur_email), '') is not null
      from public.organisations o
      left join public.organisation_secrets s on s.organisation_id = o.id
     where o.id = p_organisation_id
  ), false);
$$;

revoke execute on function public.brevo_configure_organisation(uuid) from public, anon, authenticated;
grant execute on function public.brevo_configure_organisation(uuid) to service_role;

-- Récapitulatif avant lancement : nombre de reçus à envoyer, exclus avec leur raison, rythme, envois
-- des dernières 24 h, Brevo configuré ou non.
create or replace function public.recapitulatif_envoi_lot_recus(p_organisation_id uuid, p_annee integer)
returns jsonb
language plpgsql
stable
security definer
-- public : les helpers d'identité n'ont pas de search_path propre.
set search_path = public, pg_temp
as $$
declare
  v_rythme record;
begin
  if not coalesce(
    public.is_current_user_super_admin()
    or (p_organisation_id = public.current_user_organisation_id()
        and public.current_user_role() in ('admin', 'contributeur')),
    false
  ) then
    raise exception 'ACCES_REFUSE' using errcode = '42501';
  end if;

  select * into v_rythme from public.rythme_envoi_recus(p_organisation_id);

  return jsonb_build_object(
    'a_envoyer', (select count(*) from public.recus_envoi_lot(p_organisation_id, p_annee) e where e.raison is null),
    'exclus', coalesce((
      select jsonb_agg(jsonb_build_object(
               'profil_participant_id', e.profil_participant_id, 'nom', e.nom, 'prenom', e.prenom, 'raison', e.raison)
             order by e.rang)
        from public.recus_envoi_lot(p_organisation_id, p_annee) e
       where e.raison is not null
    ), '[]'::jsonb),
    'par_jour', v_rythme.par_jour,
    'par_minute', v_rythme.par_minute,
    'envoyes_24h', public.envois_recus_depuis(p_organisation_id, now() - interval '24 hours'),
    'brevo_configure', public.brevo_configure_organisation(p_organisation_id)
  );
end;
$$;

revoke execute on function public.recapitulatif_envoi_lot_recus(uuid, integer) from public, anon;
grant execute on function public.recapitulatif_envoi_lot_recus(uuid, integer) to authenticated, service_role;

create or replace function public.lancer_lot_envoi_recus(p_organisation_id uuid, p_annee integer)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_lot_id uuid;
  v_total integer;
  v_ligne record;
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

  -- Envoi en lot réservé à Brevo (voir brevo_configure_organisation).
  if not coalesce(public.brevo_configure_organisation(p_organisation_id), false) then
    raise exception 'BREVO_REQUIS';
  end if;

  if exists (
    select 1 from public.recus_lots l
     where l.organisation_id = p_organisation_id and l.annee = p_annee
       and l.type = 'envoi' and l.statut = 'en_cours'
  ) then
    raise exception 'LOT_DEJA_EN_COURS';
  end if;

  -- Lot d'envoi arrêté dont une exécution tient encore le bail : l'email en cours d'envoi n'est pas
  -- encore marqué, la relance attend sa fin.
  if exists (
    select 1 from public.recus_lots l
     where l.organisation_id = p_organisation_id and l.annee = p_annee
       and l.type = 'envoi' and l.statut <> 'en_cours'
       and l.traitement_jusqu_a is not null and l.traitement_jusqu_a > now()
  ) then
    raise exception 'ENVOI_EN_COURS';
  end if;

  -- Lignes restées « en_cours » dans un lot d'envoi arrêté (exécution interrompue pendant l'envoi) :
  -- classées comme ligne_suivante_lot_recus le fait pour un lot en cours, avant de choisir les reçus.
  for v_ligne in
    select g.id, g.lot_id
      from public.recus_lot_lignes g
      join public.recus_lots l on l.id = g.lot_id
     where l.organisation_id = p_organisation_id and l.annee = p_annee
       and l.type = 'envoi' and l.statut <> 'en_cours' and g.statut = 'en_cours'
  loop
    perform public.classer_ligne_envoi_interrompue(v_ligne.id);
    perform public.recompter_lot_recus(v_ligne.lot_id);
  end loop;

  -- Génération en lot de la même année en cours (ou arrêtée avec un reçu encore en génération) :
  -- l'envoi attend sa fin.
  if exists (
    select 1 from public.recus_lots l
     where l.organisation_id = p_organisation_id and l.annee = p_annee and l.type = 'generation'
       and (l.statut = 'en_cours' or (l.traitement_jusqu_a is not null and l.traitement_jusqu_a > now()))
  ) then
    raise exception 'GENERATION_EN_COURS';
  end if;

  insert into public.recus_lots (organisation_id, annee, type, cree_par)
    values (p_organisation_id, p_annee, 'envoi', auth.uid())
    returning id into v_lot_id;

  insert into public.recus_lot_lignes (lot_id, organisation_id, profil_participant_id, rang, recu_id, version_id)
    select v_lot_id, p_organisation_id, e.profil_participant_id,
           (row_number() over (order by e.rang))::integer, e.recu_id, e.version_id
      from public.recus_envoi_lot(p_organisation_id, p_annee) e
     where e.raison is null;
  get diagnostics v_total = row_count;

  if v_total = 0 then
    raise exception 'AUCUN_RECU_A_ENVOYER';
  end if;

  update public.recus_lots set nb_total = v_total where id = v_lot_id;
  return v_lot_id;
exception
  when unique_violation then
    raise exception 'LOT_DEJA_EN_COURS';
end;
$$;

revoke execute on function public.lancer_lot_envoi_recus(uuid, integer) from public, anon;
grant execute on function public.lancer_lot_envoi_recus(uuid, integer) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 5. Traitement (service_role seulement : traiter-lots-recus)
-- ---------------------------------------------------------------------------

-- Compteurs d'un lot.
create or replace function public.recompter_lot_recus(p_lot_id uuid)
returns void
language sql
set search_path = ''
as $$
  update public.recus_lots l
     set nb_faits = (select count(*) from public.recus_lot_lignes g where g.lot_id = l.id and g.statut = 'fait'),
         nb_echecs = (select count(*) from public.recus_lot_lignes g where g.lot_id = l.id and g.statut = 'echec'),
         nb_a_verifier = (select count(*) from public.recus_lot_lignes g where g.lot_id = l.id and g.statut = 'a_verifier')
   where l.id = p_lot_id;
$$;

-- Nombre d'emails que cette exécution peut envoyer pour un lot d'envoi : min(rythme par minute moins
-- les envois des 45 dernières secondes, rythme par jour moins les envois des dernières 24 h). Quota du
-- jour atteint : le lot est mis en attente jusqu'à ce que le plus ancien envoi compté sorte de la
-- fenêtre de 24 h, et 0 est renvoyé.
create or replace function public.budget_envoi_lot_recus(p_lot_id uuid)
returns integer
language plpgsql
set search_path = ''
as $$
declare
  v_org uuid;
  v_rythme record;
  v_jour integer;
  v_minute integer;
  v_budget integer;
  v_plus_ancien timestamptz;
begin
  select l.organisation_id into v_org from public.recus_lots l where l.id = p_lot_id and l.type = 'envoi';
  if v_org is null then
    raise exception 'LOT_INTROUVABLE';
  end if;

  select * into v_rythme from public.rythme_envoi_recus(v_org);
  v_jour := v_rythme.par_jour - public.envois_recus_depuis(v_org, now() - interval '24 hours');
  -- Fenêtre de 45 s, plus courte que l'intervalle de la tâche planifiée (1 min) : les envois du passage
  -- précédent (faits dans ses premières secondes) n'en font plus partie, sinon le passage suivant, à
  -- quelques fractions de seconde près, les comptait et le débit réel alternait (1 puis 5 par minute).
  -- Une exécution supplémentaire rapprochée (lancement) reste bornée.
  v_minute := v_rythme.par_minute - public.envois_recus_depuis(v_org, now() - interval '45 seconds');
  v_budget := greatest(0, least(v_jour, v_minute));

  if v_jour <= 0 then
    select min(t) into v_plus_ancien from (
      select v.email_envoye_le as t from public.recus_fiscaux_versions v
       where v.organisation_id = v_org and v.email_envoye_le > now() - interval '24 hours'
      union all
      select g.modifie_le from public.recus_lot_lignes g
       where g.organisation_id = v_org and g.statut = 'a_verifier' and g.modifie_le > now() - interval '24 hours'
    ) s;
    update public.recus_lots
       set en_attente_jusqu_a = coalesce(v_plus_ancien, now()) + interval '24 hours' + interval '1 minute'
     where id = p_lot_id;
  elsif v_budget > 0 then
    update public.recus_lots set en_attente_jusqu_a = null where id = p_lot_id and en_attente_jusqu_a is not null;
  end if;

  return v_budget;
end;
$$;

-- prendre_lot_recus : renvoie aussi le type ; un lot d'envoi en attente de quota n'est pas pris.
drop function if exists public.prendre_lot_recus(integer, uuid[]);
create function public.prendre_lot_recus(p_bail_secondes integer, p_exclure uuid[] default '{}')
returns table (lot_id uuid, organisation_id uuid, annee integer, cree_par uuid, type text)
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
     and (l.en_attente_jusqu_a is null or l.en_attente_jusqu_a < now())
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

  return query select v_lot.id, v_lot.organisation_id, v_lot.annee, v_lot.cree_par, v_lot.type;
end;
$$;

-- ligne_suivante_lot_recus : comme recus_lots.sql pour la génération. Lot d'envoi : une ligne restée
-- « en_cours » (exécution interrompue pendant l'envoi) n'est jamais renvoyée : faite si sa version a
-- été marquée envoyée depuis la prise de la ligne, sinon « a_verifier ».
create or replace function public.ligne_suivante_lot_recus(p_lot_id uuid, p_bail_secondes integer)
returns table (ligne_id uuid, profil_participant_id uuid, tentatives integer)
language plpgsql
set search_path = ''
as $$
declare
  v_lot public.recus_lots%rowtype;
  v_ligne public.recus_lot_lignes%rowtype;
begin
  select * into v_lot from public.recus_lots l where l.id = p_lot_id for update;
  if v_lot.statut is distinct from 'en_cours' then
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
      perform public.recompter_lot_recus(p_lot_id);
      update public.recus_lots
         set statut = 'termine', termine_le = now(), traitement_jusqu_a = null, en_attente_jusqu_a = null
       where id = p_lot_id;
      return;
    end if;

    if v_lot.type = 'envoi' and v_ligne.statut = 'en_cours' then
      perform public.classer_ligne_envoi_interrompue(v_ligne.id);
      perform public.recompter_lot_recus(p_lot_id);
      continue;
    end if;

    exit when v_ligne.tentatives < 3;

    update public.recus_lot_lignes
       set statut = 'echec', modifie_le = now(),
           erreur = coalesce(v_ligne.erreur, 'Traitement interrompu à plusieurs reprises')
     where id = v_ligne.id;
    perform public.recompter_lot_recus(p_lot_id);
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

-- terminer_ligne_lot_recus : résultat 'a_verifier' (envoi ambigu, définitif sans nouvelle tentative) et
-- détail de l'envoi (version, date, canal, déjà envoyé). La correction « reçu préexistant » de la
-- génération ne s'applique qu'aux lots de génération.
drop function if exists public.terminer_ligne_lot_recus(uuid, text, text, uuid, boolean);
create or replace function public.terminer_ligne_lot_recus(
  p_ligne_id uuid,
  p_resultat text,
  p_erreur text default null,
  p_recu_id uuid default null,
  p_recu_preexistant boolean default false,
  p_version_id uuid default null,
  p_envoye_le timestamptz default null,
  p_email_canal text default null,
  p_deja_envoye boolean default false
)
returns text
language plpgsql
set search_path = ''
as $$
declare
  v_ligne public.recus_lot_lignes%rowtype;
  v_type text;
  v_statut text;
  v_preexistant boolean;
begin
  select * into v_ligne from public.recus_lot_lignes where id = p_ligne_id for update;
  if not found then
    raise exception 'LIGNE_INTROUVABLE';
  end if;
  select l.type into v_type from public.recus_lots l where l.id = v_ligne.lot_id;

  v_statut := case
    when p_resultat = 'fait' then 'fait'
    when p_resultat = 'echec' then 'echec'
    when p_resultat = 'a_verifier' and v_type = 'envoi' then 'a_verifier'
    when p_resultat = 'reessayer' and v_ligne.tentatives >= 3 then 'echec'
    when p_resultat = 'reessayer' then 'a_faire'
  end;
  if v_statut is null then
    raise exception 'RESULTAT_INVALIDE: %', p_resultat;
  end if;

  v_preexistant := v_type = 'generation' and v_statut = 'fait' and coalesce(p_recu_preexistant, false);
  if v_preexistant and v_ligne.tentatives > 1 and p_recu_id is not null then
    select not exists (
      select 1
        from public.recus_lots l
        join lateral (
          select v.genere_par, v.genere_le
            from public.recus_fiscaux_versions v
           where v.recu_id = p_recu_id
           order by v.version
           limit 1
        ) premiere on true
       where l.id = v_ligne.lot_id
         and premiere.genere_par is not distinct from l.cree_par
         and premiere.genere_le >= l.cree_le
    ) into v_preexistant;
  end if;

  update public.recus_lot_lignes
     set statut = v_statut,
         erreur = case when v_statut = 'fait' then null else p_erreur end,
         recu_id = coalesce(p_recu_id, recu_id),
         recu_preexistant = v_preexistant,
         version_id = coalesce(p_version_id, version_id),
         envoye_le = case when v_statut = 'fait' then coalesce(p_envoye_le, envoye_le) else envoye_le end,
         email_canal = case when v_statut = 'fait' then coalesce(p_email_canal, email_canal) else email_canal end,
         deja_envoye = v_type = 'envoi' and v_statut = 'fait' and coalesce(p_deja_envoye, false),
         modifie_le = now()
   where id = p_ligne_id;

  perform public.recompter_lot_recus(v_ligne.lot_id);

  return v_statut;
end;
$$;

-- liberer_lot_recus : inchangé, mais en_attente_jusqu_a est effacé à la fin du lot.
create or replace function public.liberer_lot_recus(p_lot_id uuid)
returns void
language plpgsql
set search_path = ''
as $$
declare
  v_fini boolean;
begin
  select l.statut = 'en_cours' and not exists (
           select 1 from public.recus_lot_lignes g where g.lot_id = l.id and g.statut in ('a_faire', 'en_cours'))
    into v_fini
    from public.recus_lots l where l.id = p_lot_id;

  update public.recus_lots l
     set traitement_jusqu_a = null,
         statut = case when v_fini then 'termine' else l.statut end,
         termine_le = case when v_fini then now() else l.termine_le end,
         en_attente_jusqu_a = case when v_fini then null else l.en_attente_jusqu_a end
   where l.id = p_lot_id;
end;
$$;

revoke execute on function public.recompter_lot_recus(uuid) from public, anon, authenticated;
revoke execute on function public.budget_envoi_lot_recus(uuid) from public, anon, authenticated;
revoke execute on function public.prendre_lot_recus(integer, uuid[]) from public, anon, authenticated;
revoke execute on function public.ligne_suivante_lot_recus(uuid, integer) from public, anon, authenticated;
revoke execute on function public.terminer_ligne_lot_recus(uuid, text, text, uuid, boolean, uuid, timestamptz, text, boolean) from public, anon, authenticated;
revoke execute on function public.liberer_lot_recus(uuid) from public, anon, authenticated;
grant execute on function public.recompter_lot_recus(uuid) to service_role;
grant execute on function public.budget_envoi_lot_recus(uuid) to service_role;
grant execute on function public.prendre_lot_recus(integer, uuid[]) to service_role;
grant execute on function public.ligne_suivante_lot_recus(uuid, integer) to service_role;
grant execute on function public.terminer_ligne_lot_recus(uuid, text, text, uuid, boolean, uuid, timestamptz, text, boolean) to service_role;
grant execute on function public.liberer_lot_recus(uuid) to service_role;

-- ---------------------------------------------------------------------------
-- 6. Tâche planifiée : un lot d'envoi en attente de quota ne déclenche pas d'appel
-- ---------------------------------------------------------------------------

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
  if not exists (
    select 1 from public.recus_lots l
     where l.statut = 'en_cours'
       and (l.traitement_jusqu_a is null or l.traitement_jusqu_a < now())
       and (l.en_attente_jusqu_a is null or l.en_attente_jusqu_a < now())
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

-- ---------------------------------------------------------------------------
-- 7. Changement du quota du jour : un lot d'envoi en attente est réévalué aussitôt
-- ---------------------------------------------------------------------------

-- Test de charge (docs/recus-lot-test-charge.md § 4.3) : en_attente_jusqu_a n'était recalculé que pour
-- un lot pris, et un lot en attente n'est jamais pris ; une hausse du quota ne le réveillait donc pas
-- avant la fin de l'attente calculée avec l'ancien quota. Quand envoi_lot_par_jour change, l'attente
-- des lots d'envoi en cours de l'organisation est effacée si le quota du jour, recalculé avec le
-- nouveau rythme, n'est plus atteint : le passage suivant prend le lot, et budget_envoi_lot_recus
-- (qui recompte toujours les envois des dernières 24 h) borne l'envoi au nouveau quota. Une baisse,
-- ou une hausse qui ne suffit pas, laisse l'attente telle quelle. Le rythme par minute n'intervient pas
-- dans l'attente. security definer : l'admin qui enregistre le rythme n'écrit pas dans recus_lots.
create or replace function public.reevaluer_attente_lots_envoi_recus()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_rythme record;
begin
  if (new.modele_recu_pdf ->> 'envoi_lot_par_jour') is not distinct from (old.modele_recu_pdf ->> 'envoi_lot_par_jour') then
    return null;
  end if;
  if not exists (
    select 1 from public.recus_lots l
     where l.organisation_id = new.id and l.type = 'envoi' and l.statut = 'en_cours' and l.en_attente_jusqu_a > now()
  ) then
    return null;
  end if;

  select * into v_rythme from public.rythme_envoi_recus(new.id);
  if v_rythme.par_jour - public.envois_recus_depuis(new.id, now() - interval '24 hours') > 0 then
    update public.recus_lots l
       set en_attente_jusqu_a = null
     where l.organisation_id = new.id and l.type = 'envoi' and l.statut = 'en_cours' and l.en_attente_jusqu_a is not null;
  end if;
  return null;
end;
$$;

revoke execute on function public.reevaluer_attente_lots_envoi_recus() from public, anon, authenticated;

drop trigger if exists trg_organisations_reevaluer_attente_lots_envoi on public.organisations;
create trigger trg_organisations_reevaluer_attente_lots_envoi
  after update of modele_recu_pdf on public.organisations
  for each row execute function public.reevaluer_attente_lots_envoi_recus();

commit;
