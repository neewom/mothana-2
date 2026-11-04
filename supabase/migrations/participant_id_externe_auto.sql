-- Blocage trouvé en testant la PR #320 (format de numéro de reçu « année +
-- numéro de donateur ») : un donateur sans profils_participant.id_externe ne
-- peut pas recevoir de reçu dans ce format. Le numéro n'était attribué que par
-- ParticipantModal (RPC next_participant_id_externe, réservée à l'admin) et
-- l'import ; pas pour un donateur créé depuis l'espace bénévole (insert
-- direct, refusé par la garde de la RPC), par transposition d'un adhérent
-- (adherentTranspose.ts) ni par le jeu de démo (demoOrgSeed.ts).
--
-- Correctif : attribution en base, par un trigger BEFORE INSERT, avec la même
-- séquence par organisation que next_participant_id_externe
-- (participant_id_externe_seq_<org>, resynchronisée sur le plus grand
-- id_externe numérique existant). Un id_externe fourni explicitement (import,
-- ParticipantModal) n'est jamais modifié. Puis rattrapage des donateurs
-- existants sans numéro. Ré-exécutable.

-- Concurrence : l'attribution (trigger) et la RPC next_participant_id_externe
-- prennent le même verrou consultatif transactionnel, clé = nom de la
-- séquence de l'organisation. Deux attributions simultanées dans une même
-- organisation sont ainsi sérialisées : la seconde attend le commit de la
-- première, relit le max à jour et ne peut ni tirer le même numéro ni
-- échouer sur la création de la séquence (un `create sequence if not exists`
-- ne suffisait pas : face à une création concurrente non encore validée, il
-- échoue sur la contrainte d'unicité du catalogue au lieu de l'ignorer).

-- Fonction interne : pas de garde utilisateur (appelée uniquement par le
-- trigger, dans un insert déjà autorisé par la RLS, et par le rattrapage).
-- Non exécutable par anon/authenticated.
create or replace function public.attribuer_participant_id_externe(p_organisation_id uuid)
returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  seq_name text;
  next_val bigint;
  current_max bigint;
begin
  seq_name := 'participant_id_externe_seq_' || replace(p_organisation_id::text, '-', '_');
  perform pg_advisory_xact_lock(hashtext(seq_name));

  select coalesce(max(id_externe::bigint), 0)
  into current_max
  from profils_participant
  where organisation_id = p_organisation_id
    and id_externe ~ '^[0-9]{1,18}$';

  if not exists (select 1 from pg_sequences where schemaname = 'public' and sequencename = seq_name) then
    -- Création sérialisée par le verrou consultatif ci-dessus.
    execute format('create sequence public.%I start %s', seq_name, current_max + 1);
  else
    execute format(
      'select setval(%L, GREATEST(last_value, %s)) from public.%I',
      'public.' || seq_name, current_max, seq_name
    );
  end if;

  execute format('select nextval(%L)', 'public.' || seq_name) into next_val;
  return next_val::text;
end;
$$;

revoke execute on function public.attribuer_participant_id_externe(uuid) from public, anon, authenticated;
grant execute on function public.attribuer_participant_id_externe(uuid) to service_role;

create or replace function public.profils_participant_attribuer_id_externe()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_existant text;
begin
  if nullif(btrim(new.id_externe), '') is not null or new.organisation_id is null then
    return new;
  end if;

  -- Upsert (import : on conflict (id) do update set id_externe = excluded.id_externe)
  -- d'un donateur déjà numéroté sans numéro fourni : excluded porte la valeur
  -- posée ici, on reprend donc le numéro existant plutôt que d'en brûler un neuf.
  select pp.id_externe into v_existant
  from profils_participant pp
  where pp.id = new.id and pp.organisation_id = new.organisation_id;

  if nullif(btrim(v_existant), '') is not null then
    new.id_externe := v_existant;
  else
    new.id_externe := public.attribuer_participant_id_externe(new.organisation_id);
  end if;
  return new;
end;
$$;

revoke execute on function public.profils_participant_attribuer_id_externe() from public, anon, authenticated;

drop trigger if exists profils_participant_attribuer_id_externe on public.profils_participant;
create trigger profils_participant_attribuer_id_externe
  before insert on public.profils_participant
  for each row execute function public.profils_participant_attribuer_id_externe();

-- RPC appelée par ParticipantModal et l'import (collision « Créer un
-- nouveau ») : même verrou que l'attribution automatique. Garde et droits
-- inchangés (create or replace conserve les grants). Le max est désormais lu
-- comme dans attribuer_participant_id_externe (bigint, 1 à 18 chiffres) :
-- l'ancien cast ::int échouait sur un numéro au-delà de 2^31.
create or replace function public.next_participant_id_externe(p_organisation_id uuid)
returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  seq_name text;
  next_val bigint;
  current_max bigint;
begin
  if auth.uid() is null or not coalesce(
    public.is_current_user_super_admin()
    or p_organisation_id = public.current_user_organisation_id(),
    false
  ) then
    raise exception 'ACCES_INTERDIT' using errcode = '42501';
  end if;

  seq_name := 'participant_id_externe_seq_' || replace(p_organisation_id::text, '-', '_');
  perform pg_advisory_xact_lock(hashtext(seq_name));

  select coalesce(max(id_externe::bigint), 0)
  into current_max
  from profils_participant
  where organisation_id = p_organisation_id
    and id_externe ~ '^[0-9]{1,18}$';

  if not exists (select 1 from pg_sequences where schemaname = 'public' and sequencename = seq_name) then
    execute format('create sequence public.%I start %s', seq_name, current_max + 1);
  else
    execute format(
      'select setval(%L, GREATEST(last_value, %s)) from public.%I',
      'public.' || seq_name, current_max, seq_name
    );
  end if;

  execute format('select nextval(%L)', 'public.' || seq_name) into next_val;
  return next_val::text;
end;
$$;

-- Import : une ligne sans numéro reçoit max + 1 à l'insertion (trigger) ; si
-- une ligne suivante du même appel porte ce numéro, la contrainte
-- profils_participant_organisation_id_externe_unique rejetterait tout le lot.
-- Les lignes numérotées sont donc insérées d'abord (le trigger d'une ligne
-- voit les lignes déjà insérées par la même commande et se recale sur leur
-- max). Le front trie aussi le fichier entier avant le découpage en lots
-- (orderRowsWithIdExterneFirst, runImport.ts). Seule différence avec la
-- définition précédente (super_admin_bypass_import_rpc.sql) : l'order by.
create or replace function public.import_upsert_participants(payload jsonb, p_organisation_id uuid default null)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_org uuid := coalesce(current_user_organisation_id(), case when is_current_user_super_admin() then p_organisation_id end);
  v_total int;
  v_existing_profil_ids uuid[];
  v_created int;
  v_updated int;
begin
  if v_org is null then
    raise exception 'Unauthorized: no organisation context';
  end if;

  create temporary table _import_participants on commit drop as
  select * from jsonb_to_recordset(payload) as r(
    personne_id  uuid,
    profil_id    uuid,
    id_externe   text,
    nom          text,
    prenom       text,
    civilite     smallint,
    email        text,
    telephone    text,
    adresse      text,
    code_postal  text,
    ville        text,
    pays         text,
    nom2         text,
    prenom2      text,
    notes        text
  );

  v_total := (select count(*) from _import_participants where personne_id is not null and profil_id is not null);

  select array_agg(pp.id) into v_existing_profil_ids
  from profils_participant pp
  join _import_participants t on t.profil_id = pp.id
  where pp.organisation_id = v_org;

  insert into personnes (id, nom, prenom, civilite, email, telephone, adresse, code_postal, ville, pays, nom2, prenom2)
  select personne_id, nom, prenom, civilite, email, telephone, adresse, code_postal, ville, pays, nom2, prenom2
  from _import_participants
  where personne_id is not null and profil_id is not null
  on conflict (id) do update set
    nom = excluded.nom,
    prenom = excluded.prenom,
    civilite = excluded.civilite,
    email = excluded.email,
    telephone = excluded.telephone,
    adresse = excluded.adresse,
    code_postal = excluded.code_postal,
    ville = excluded.ville,
    pays = excluded.pays,
    nom2 = excluded.nom2,
    prenom2 = excluded.prenom2
  where exists (
    select 1 from profils_participant pp
    where pp.personne_id = personnes.id and pp.organisation_id = v_org
  );

  insert into profils_participant (id, personne_id, organisation_id, notes, id_externe)
  select profil_id, personne_id, v_org, notes, id_externe
  from _import_participants
  where personne_id is not null and profil_id is not null
  order by (nullif(btrim(id_externe), '') is null)
  on conflict (id) do update set
    notes = excluded.notes,
    id_externe = excluded.id_externe
  where profils_participant.organisation_id = v_org;

  v_updated := coalesce(array_length(v_existing_profil_ids, 1), 0);
  v_created := v_total - v_updated;

  return jsonb_build_object('created', v_created, 'updated', v_updated, 'total', v_total);
end;
$$;

-- Rattrapage : chaque donateur sans numéro, organisation par organisation,
-- dans l'ordre created_at puis id, à la suite du plus grand numéro (la
-- fonction resynchronise la séquence à chaque appel, elle reste donc calée).
do $$
declare
  r record;
begin
  for r in
    select id, organisation_id
    from public.profils_participant
    where nullif(btrim(id_externe), '') is null
    order by organisation_id, created_at, id
  loop
    update public.profils_participant
    set id_externe = public.attribuer_participant_id_externe(r.organisation_id)
    where id = r.id;
  end loop;
end;
$$;
