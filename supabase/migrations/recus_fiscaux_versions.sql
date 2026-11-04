-- Migration: recus_fiscaux_versions.sql
-- 2026-11-04 (carte https://trello.com/c/0ppNYlOz). Chaque génération / régénération d'un reçu fiscal
-- crée une nouvelle version conservée : l'association doit garder une copie de chaque reçu émis
-- pendant 6 ans (docs/regles-recus-fiscaux.md §5 et §7). recus_fiscaux reste la fiche du reçu (numéro
-- définitif) et pointe sur la dernière version ; recus_fiscaux_versions garde toutes les versions.
--
-- Immutabilité tenue en base, pour tous les rôles (service_role et super-admin compris) :
--   - aucune mise à jour d'une version, sauf email_envoye_le (send-recu-email) ;
--   - aucune suppression (ni directe, ni par cascade participant / organisation / reçu), ni TRUNCATE.
--   Une migration de correction devra désactiver explicitement le trigger
--   recus_fiscaux_versions_immuables le temps de l'opération.
-- Lecture : membres de l'organisation + bypass super-admin ; écriture : service_role seulement, via
-- la fonction enregistrer_version_recu (appelée par l'Edge Function generate-recu).
-- Storage : le bucket recus-fiscaux n'a qu'une policy de lecture (aucun insert / update / delete client) ;
-- elle reçoit ici le bypass super-admin en lecture.
-- Reprise de l'existant : une version 1 par reçu existant, pointant sur son fichier actuel (les versions
-- déjà écrasées avant cette migration sont perdues) ; elle n'est marquée envoyée que si l'email est
-- postérieur à la génération du fichier actuel. Ré-exécutable.
begin;

-- ---------------------------------------------------------------------------
-- 1. Table
-- ---------------------------------------------------------------------------

create table if not exists public.recus_fiscaux_versions (
  id uuid primary key default gen_random_uuid(),
  recu_id uuid not null references public.recus_fiscaux(id) on delete cascade,
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  version integer not null check (version >= 1),
  fichier_url text not null,
  numero_ordre text,
  montant_total numeric not null,
  type_cerfa text,
  template_id uuid,
  snapshot_donateur jsonb,
  snapshot_organisation jsonb,
  genere_le timestamptz not null default now(),
  -- auth.users.id de l'auteur (sans clé étrangère : un compte supprimé ne doit pas modifier la version).
  genere_par uuid,
  email_envoye_le timestamptz,
  unique (recu_id, version)
);

comment on table public.recus_fiscaux_versions is
  'Versions successives d''un reçu fiscal (une par génération). Immuable sauf email_envoye_le, jamais supprimée (conservation 6 ans).';

create index if not exists recus_fiscaux_versions_organisation_idx
  on public.recus_fiscaux_versions (organisation_id);

-- ---------------------------------------------------------------------------
-- 2. Immutabilité
-- ---------------------------------------------------------------------------

create or replace function public.recus_fiscaux_versions_immuables()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' then
    if (to_jsonb(new) - 'email_envoye_le') is distinct from (to_jsonb(old) - 'email_envoye_le') then
      raise exception 'Version % du reçu fiscal % : une version émise ne peut pas être modifiée (seule la date d''envoi par email peut l''être)',
        old.version, old.recu_id
        using errcode = 'check_violation';
    end if;
    return new;
  end if;

  if tg_op = 'DELETE' then
    raise exception 'Version % du reçu fiscal % : les versions d''un reçu émis sont conservées (obligation de conservation de 6 ans) et ne peuvent pas être supprimées',
      old.version, old.recu_id
      using errcode = 'check_violation';
  end if;

  -- TRUNCATE (trigger de niveau instruction)
  raise exception 'Les versions des reçus fiscaux ne peuvent pas être supprimées (obligation de conservation de 6 ans)'
    using errcode = 'check_violation';
end;
$$;

revoke execute on function public.recus_fiscaux_versions_immuables() from public, anon, authenticated;

drop trigger if exists recus_fiscaux_versions_immuables on public.recus_fiscaux_versions;
create trigger recus_fiscaux_versions_immuables
  before update or delete on public.recus_fiscaux_versions
  for each row
  execute function public.recus_fiscaux_versions_immuables();

drop trigger if exists recus_fiscaux_versions_immuables_truncate on public.recus_fiscaux_versions;
create trigger recus_fiscaux_versions_immuables_truncate
  before truncate on public.recus_fiscaux_versions
  for each statement
  execute function public.recus_fiscaux_versions_immuables();

-- ---------------------------------------------------------------------------
-- 3. RLS : lecture organisation + bypass super-admin ; aucune écriture client
-- ---------------------------------------------------------------------------

alter table public.recus_fiscaux_versions enable row level security;

drop policy if exists recus_versions_select on public.recus_fiscaux_versions;
create policy recus_versions_select on public.recus_fiscaux_versions
  for select
  to authenticated
  using (
    organisation_id = (select public.current_user_organisation_id())
    or ((select auth.jwt()) -> 'app_metadata' ->> 'is_super_admin')::boolean = true
  );

revoke insert, update, delete, truncate on public.recus_fiscaux_versions from anon, authenticated;
revoke all on public.recus_fiscaux_versions from anon;
grant select on public.recus_fiscaux_versions to authenticated;
grant select, insert, update on public.recus_fiscaux_versions to service_role;

-- ---------------------------------------------------------------------------
-- 4. Écriture d'une génération : fiche du reçu + nouvelle version, dans une même transaction
-- ---------------------------------------------------------------------------

drop function if exists public.enregistrer_version_recu(uuid, uuid, integer, integer, numeric, text, text, text, uuid, jsonb, jsonb, uuid);

create function public.enregistrer_version_recu(
  p_profil_participant_id uuid,
  p_organisation_id uuid,
  p_annee integer,
  p_version integer,
  p_montant_total numeric,
  p_fichier_url text,
  p_numero_ordre text,
  p_type_cerfa text,
  p_template_id uuid,
  p_snapshot_donateur jsonb,
  p_snapshot_organisation jsonb,
  p_genere_par uuid
)
returns table (recu_id uuid, version integer)
language plpgsql
set search_path = ''
as $$
declare
  v_ancien public.recus_fiscaux%rowtype;
  v_recu_id uuid;
  v_attendue integer;
  v_maintenant timestamptz := now();
begin
  -- Verrou de la fiche existante : deux régénérations simultanées s'ordonnent ici.
  select * into v_ancien
    from public.recus_fiscaux rf
   where rf.profil_participant_id = p_profil_participant_id and rf.annee = p_annee
   for update;

  -- Reçu antérieur aux versions (créé avant cette migration ou entre la migration et le déploiement
  -- de generate-recu) : son fichier actuel devient la version 1 avant d'être supplanté.
  if found and v_ancien.fichier_url is not null and not exists (
    select 1 from public.recus_fiscaux_versions v where v.recu_id = v_ancien.id
  ) then
    insert into public.recus_fiscaux_versions (recu_id, organisation_id, version, fichier_url, numero_ordre,
        montant_total, type_cerfa, template_id, snapshot_donateur, snapshot_organisation, genere_le, email_envoye_le)
      values (v_ancien.id, v_ancien.organisation_id, 1, v_ancien.fichier_url, v_ancien.numero_ordre,
        v_ancien.montant_total, v_ancien.type_cerfa, v_ancien.template_id, v_ancien.snapshot_donateur,
        v_ancien.snapshot_organisation, coalesce(v_ancien.date_generation, v_maintenant),
        case when v_ancien.email_envoye_at >= v_ancien.date_generation then v_ancien.email_envoye_at end);
  end if;

  select coalesce(max(v.version), 0) + 1 into v_attendue
    from public.recus_fiscaux_versions v
   where v.recu_id = v_ancien.id;

  if p_version is distinct from v_attendue then
    raise exception 'Reçu fiscal : version % proposée, version % attendue (génération simultanée)', p_version, v_attendue
      using errcode = 'unique_violation';
  end if;

  insert into public.recus_fiscaux as rf (profil_participant_id, organisation_id, annee, montant_total, fichier_url,
      date_generation, numero_ordre, type_cerfa, template_id, snapshot_donateur, snapshot_organisation)
    values (p_profil_participant_id, p_organisation_id, p_annee, p_montant_total, p_fichier_url,
      v_maintenant, p_numero_ordre, p_type_cerfa, p_template_id, p_snapshot_donateur, p_snapshot_organisation)
    on conflict (profil_participant_id, annee) do update set
      organisation_id = excluded.organisation_id,
      montant_total = excluded.montant_total,
      fichier_url = excluded.fichier_url,
      date_generation = excluded.date_generation,
      numero_ordre = excluded.numero_ordre,
      type_cerfa = excluded.type_cerfa,
      template_id = excluded.template_id,
      snapshot_donateur = excluded.snapshot_donateur,
      snapshot_organisation = excluded.snapshot_organisation
    returning rf.id into v_recu_id;

  insert into public.recus_fiscaux_versions (recu_id, organisation_id, version, fichier_url, numero_ordre,
      montant_total, type_cerfa, template_id, snapshot_donateur, snapshot_organisation, genere_le, genere_par)
    values (v_recu_id, p_organisation_id, p_version, p_fichier_url, p_numero_ordre, p_montant_total,
      p_type_cerfa, p_template_id, p_snapshot_donateur, p_snapshot_organisation, v_maintenant, p_genere_par);

  return query select v_recu_id, p_version;
end;
$$;

revoke execute on function public.enregistrer_version_recu(uuid, uuid, integer, integer, numeric, text, text, text, uuid, jsonb, jsonb, uuid)
  from public, anon, authenticated;
grant execute on function public.enregistrer_version_recu(uuid, uuid, integer, integer, numeric, text, text, text, uuid, jsonb, jsonb, uuid)
  to service_role;

-- ---------------------------------------------------------------------------
-- 5. Reprise de l'existant : version 1 = fichier actuel (ré-exécutable)
-- ---------------------------------------------------------------------------

insert into public.recus_fiscaux_versions (recu_id, organisation_id, version, fichier_url, numero_ordre,
    montant_total, type_cerfa, template_id, snapshot_donateur, snapshot_organisation, genere_le, email_envoye_le)
  select rf.id, rf.organisation_id, 1, rf.fichier_url, rf.numero_ordre, rf.montant_total, rf.type_cerfa,
         rf.template_id, rf.snapshot_donateur, rf.snapshot_organisation, coalesce(rf.date_generation, now()),
         case when rf.email_envoye_at >= rf.date_generation then rf.email_envoye_at end
    from public.recus_fiscaux rf
   where rf.fichier_url is not null
     and not exists (select 1 from public.recus_fiscaux_versions v where v.recu_id = rf.id);

-- Un email envoyé avant la date de génération du fichier actuel portait un PDF depuis écrasé : la
-- version reprise n'est pas celle qui a été envoyée (la date d'envoi reste sur recus_fiscaux).
-- Correction des versions déjà reprises par une première exécution (seule colonne modifiable).
update public.recus_fiscaux_versions v
   set email_envoye_le = null
 where v.version = 1 and v.genere_par is null and v.email_envoye_le < v.genere_le;

-- ---------------------------------------------------------------------------
-- 6. Storage : lecture des PDF de reçus avec bypass super-admin (aucune écriture client)
-- ---------------------------------------------------------------------------

drop policy if exists "admins read own org receipts" on storage.objects;
create policy "admins read own org receipts" on storage.objects
  for select
  using (
    bucket_id = 'recus-fiscaux'
    and (
      (storage.foldername(name))[1] = (
        select profils_organisation.organisation_id::text
          from public.profils_organisation
         where profils_organisation.utilisateur_id = (select auth.uid())
         limit 1
      )
      or ((select auth.jwt()) -> 'app_metadata' ->> 'is_super_admin')::boolean = true
    )
  );

commit;
