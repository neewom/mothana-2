-- Migration: campagnes_courrier_detail.sql
-- Carte « Courrier : détail figé et notes de chaque campagne dans l'historique »
-- (https://trello.com/c/SxdypAs1) — même modèle que campagnes_mailing_detail.sql.
--
-- 1. campagnes_courrier gagne le libellé figé de la liste exclue (« Sauf liste : X »,
--    construit côté serveur par generate-campagne-courrier, nom relu en base), un
--    marqueur detail_enregistre (selection_label existait déjà, NOT NULL : il ne peut pas
--    servir à reconnaître une campagne antérieure comme côté Emailing) et des notes
--    libres, modifiables par la RPC modifier_note_campagne_courrier (aucune policy
--    UPDATE client).
-- 2. campagnes_courrier_destinataires : destinataires et exclus (raison : adresse postale
--    incomplète) de chaque campagne, nom et adresse figés à la génération. Écrite
--    uniquement par generate-campagne-courrier ; lecture seule pour l'organisation
--    (bypass super-admin), fermée à anon. adherent_id ON DELETE CASCADE (même décision
--    que l'Emailing) : la ligne disparaît avec l'adhérent, les compteurs restent.
--
-- Lignes existantes : exclusion_label et notes nulles, detail_enregistre = false ;
-- l'écran affiche « Non enregistré (campagne antérieure) ».

alter table public.campagnes_courrier
  add column if not exists exclusion_label text,
  add column if not exists detail_enregistre boolean not null default false,
  add column if not exists notes text;

comment on column public.campagnes_courrier.exclusion_label is 'Libellé figé de la liste exclue (« Sauf liste : X »), null si aucune exclusion ou campagne antérieure';
comment on column public.campagnes_courrier.detail_enregistre is 'true si la génération a enregistré l''exclusion et la liste des destinataires (carte détail) — false pour une campagne antérieure';
comment on column public.campagnes_courrier.notes is 'Notes libres de l''organisation sur la campagne — modifiées par la RPC modifier_note_campagne_courrier';

create table if not exists public.campagnes_courrier_destinataires (
  id uuid primary key default gen_random_uuid(),
  campagne_id uuid not null references public.campagnes_courrier(id) on delete cascade,
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  adherent_id uuid not null references public.adherents(id) on delete cascade,
  nom text not null,
  adresse text,
  statut text not null check (statut in ('genere', 'exclu')),
  raison_exclusion text check (raison_exclusion in ('adresse_incomplete')),
  constraint campagnes_courrier_destinataires_raison_coherente
    check ((statut = 'genere' and raison_exclusion is null) or (statut = 'exclu' and raison_exclusion is not null))
);

create index if not exists idx_campagnes_courrier_destinataires_campagne
  on public.campagnes_courrier_destinataires(campagne_id, statut, nom);
-- Suppression d'un adhérent (cascade) sans parcours complet de la table.
create index if not exists idx_campagnes_courrier_destinataires_adherent
  on public.campagnes_courrier_destinataires(adherent_id);

alter table public.campagnes_courrier_destinataires enable row level security;

-- Même portée que campagnes_courrier_select (restreinte aux profils d'organisation par
-- rls_benevole_restreint.sql : pas de lecture par le compte technique bénévole).
drop policy if exists campagnes_courrier_destinataires_select on public.campagnes_courrier_destinataires;
create policy campagnes_courrier_destinataires_select on public.campagnes_courrier_destinataires
  for select
  to authenticated
  using (
    organisation_id = (select public.current_user_organisation_id())
    or (((select auth.jwt()) -> 'app_metadata' ->> 'is_super_admin'))::boolean = true
  );

-- Aucune écriture client (écrite en service role) ; fermée à anon.
revoke all on public.campagnes_courrier_destinataires from anon;
revoke insert, update, delete, truncate on public.campagnes_courrier_destinataires from authenticated;
grant select on public.campagnes_courrier_destinataires to authenticated;

comment on table public.campagnes_courrier_destinataires is 'Destinataires et exclus figés de chaque campagne courrier — écrite uniquement par l''Edge Function generate-campagne-courrier ; ligne supprimée avec l''adhérent (compteurs de la campagne inchangés)';

-- Notes d'une campagne : admin ou contributeur de l'organisation de la campagne, ou
-- super-admin (mode Consulter). Bénévole, vendeur et autre organisation refusés.
create or replace function public.modifier_note_campagne_courrier(p_campagne_id uuid, p_notes text)
returns void
language plpgsql
security definer
-- public : les helpers d'identité n'ont pas de search_path propre.
set search_path = public, pg_temp
as $$
declare
  v_organisation_id uuid;
  v_notes text := nullif(btrim(coalesce(p_notes, '')), '');
begin
  select organisation_id into v_organisation_id
    from public.campagnes_courrier
   where id = p_campagne_id;

  if not coalesce(
    public.is_current_user_super_admin()
    or (v_organisation_id is not null
        and v_organisation_id = public.current_user_organisation_id()
        and public.current_user_role() in ('admin', 'contributeur')),
    false
  ) then
    raise exception 'ACCES_REFUSE' using errcode = '42501';
  end if;

  if v_organisation_id is null then
    raise exception 'CAMPAGNE_INTROUVABLE';
  end if;

  if char_length(v_notes) > 5000 then
    raise exception 'NOTES_TROP_LONGUES';
  end if;

  update public.campagnes_courrier set notes = v_notes where id = p_campagne_id;
end;
$$;

revoke execute on function public.modifier_note_campagne_courrier(uuid, text) from public, anon;
grant execute on function public.modifier_note_campagne_courrier(uuid, text) to authenticated, service_role;

-- Recherche paginée des destinataires d'une campagne courrier (panneau de l'historique) :
-- même règle que rechercher_destinataires_campagne (Emailing) — sans accents ni casse, chaque
-- mot doit figurer dans le nom ou l'adresse, ignorée sous 2 caractères. SECURITY INVOKER : la
-- RLS de la table (organisation + bypass super-admin, bénévole exclu) reste la garde.
create or replace function public.rechercher_destinataires_campagne_courrier(
  p_campagne_id uuid,
  p_statut text,
  p_recherche text default null,
  p_limit int default 50,
  p_offset int default 0
)
returns table (
  id uuid,
  nom text,
  adresse text,
  raison_exclusion text,
  total_count bigint
)
language sql
stable
security invoker
set search_path = public, extensions
as $$
  select d.id, d.nom, d.adresse, d.raison_exclusion, count(*) over () as total_count
  from public.campagnes_courrier_destinataires d
  where d.campagne_id = p_campagne_id
    and d.statut = p_statut
    and (
      p_recherche is null
      or length(trim(p_recherche)) < 2
      or not exists (
        select 1
        from unnest(string_to_array(unaccent(lower(trim(p_recherche))), ' ')) as tok
        where tok <> ''
          and unaccent(lower(concat_ws(' ', d.nom, d.adresse)))
              not like '%' || replace(replace(replace(tok, '\', '\\'), '%', '\%'), '_', '\_') || '%'
      )
    )
  order by d.nom, d.id
  limit least(greatest(coalesce(p_limit, 50), 1), 200)
  offset greatest(coalesce(p_offset, 0), 0);
$$;

revoke execute on function public.rechercher_destinataires_campagne_courrier(uuid, text, text, int, int) from public, anon;
grant execute on function public.rechercher_destinataires_campagne_courrier(uuid, text, text, int, int) to authenticated, service_role;
