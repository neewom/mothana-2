-- Migration: campagnes_mailing_detail.sql
-- Carte « Emailing : détail figé et notes de chaque campagne dans l'historique »
-- (https://trello.com/c/oRptwoyy, décisions utilisateur du 2026-11-09).
--
-- 1. campagnes_mailing gagne le détail figé de l'envoi : libellé de la sélection
--    (« Envoyer à »), de la liste exclue, nombre de pièces jointes — écrits par
--    l'Edge Function send-mailing-brevo (service role), libellés construits côté
--    serveur — et des notes libres, modifiables par la RPC
--    modifier_note_campagne_mailing (aucune policy UPDATE client).
-- 2. campagnes_mailing_destinataires : destinataires et exclus (avec raison) de
--    chaque campagne, nom et email figés au moment de l'envoi. Écrite uniquement
--    par send-mailing-brevo ; lecture seule pour l'organisation (bypass
--    super-admin), fermée à anon. adherent_id ON DELETE CASCADE (décision
--    utilisateur) : la ligne disparaît avec l'adhérent, les compteurs de la
--    campagne (nombre_destinataires / nombre_exclus) restent.
--
-- Lignes existantes : nouvelles colonnes nulles (aucune reprise possible), l'écran
-- affiche « Non enregistré (campagne antérieure) ».

alter table public.campagnes_mailing
  add column if not exists selection_label text,
  add column if not exists exclusion_label text,
  add column if not exists nombre_pieces_jointes int,
  add column if not exists notes text,
  add column if not exists pieces_jointes_noms text[];

comment on column public.campagnes_mailing.selection_label is 'Libellé figé de la sélection « Envoyer à » (ex. « Tous sauf archivés », « Liste : X ») — null pour une campagne antérieure à la carte détail';
comment on column public.campagnes_mailing.exclusion_label is 'Libellé figé de la liste exclue (« Sauf liste : X »), null si aucune exclusion ou campagne antérieure';
comment on column public.campagnes_mailing.nombre_pieces_jointes is 'Nombre de pièces jointes envoyées — null pour une campagne antérieure';
comment on column public.campagnes_mailing.pieces_jointes_noms is 'Noms des pièces jointes envoyées (3 au plus, 255 caractères chacun), sans les fichiers — tableau vide si aucune, null pour une campagne antérieure';
comment on column public.campagnes_mailing.notes is 'Notes libres de l''organisation sur la campagne — modifiées par la RPC modifier_note_campagne_mailing';
comment on column public.campagnes_mailing.nombre_exclus is 'Nombre d''adhérents exclus de l''envoi (email manquant, format invalide ou adresse rejetée)';

create table if not exists public.campagnes_mailing_destinataires (
  id uuid primary key default gen_random_uuid(),
  campagne_id uuid not null references public.campagnes_mailing(id) on delete cascade,
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  adherent_id uuid not null references public.adherents(id) on delete cascade,
  nom text not null,
  courriel text,
  statut text not null check (statut in ('envoye', 'exclu')),
  raison_exclusion text check (raison_exclusion in ('email_manquant', 'email_invalide', 'email_rejete')),
  constraint campagnes_mailing_destinataires_raison_coherente
    check ((statut = 'envoye' and raison_exclusion is null) or (statut = 'exclu' and raison_exclusion is not null))
);

create index if not exists idx_campagnes_mailing_destinataires_campagne
  on public.campagnes_mailing_destinataires(campagne_id, statut, nom);
-- Suppression d'un adhérent (cascade) sans parcours complet de la table.
create index if not exists idx_campagnes_mailing_destinataires_adherent
  on public.campagnes_mailing_destinataires(adherent_id);

alter table public.campagnes_mailing_destinataires enable row level security;

-- Même portée que campagnes_mailing_select (restreinte aux profils d'organisation par
-- rls_benevole_restreint.sql : pas de lecture par le compte technique bénévole).
drop policy if exists campagnes_mailing_destinataires_select on public.campagnes_mailing_destinataires;
create policy campagnes_mailing_destinataires_select on public.campagnes_mailing_destinataires
  for select
  to authenticated
  using (
    organisation_id = (select public.current_user_organisation_id())
    or (((select auth.jwt()) -> 'app_metadata' ->> 'is_super_admin'))::boolean = true
  );

-- Aucune écriture client (écrite en service role) ; fermée à anon.
revoke all on public.campagnes_mailing_destinataires from anon;
revoke insert, update, delete, truncate on public.campagnes_mailing_destinataires from authenticated;
grant select on public.campagnes_mailing_destinataires to authenticated;

comment on table public.campagnes_mailing_destinataires is 'Destinataires et exclus figés de chaque campagne mailing — écrite uniquement par l''Edge Function send-mailing-brevo ; ligne supprimée avec l''adhérent (compteurs de la campagne inchangés)';

-- Notes d'une campagne : admin ou contributeur de l'organisation de la campagne, ou
-- super-admin (mode Consulter). Bénévole, vendeur et autre organisation refusés.
create or replace function public.modifier_note_campagne_mailing(p_campagne_id uuid, p_notes text)
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
    from public.campagnes_mailing
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

  update public.campagnes_mailing set notes = v_notes where id = p_campagne_id;
end;
$$;

revoke execute on function public.modifier_note_campagne_mailing(uuid, text) from public, anon;
grant execute on function public.modifier_note_campagne_mailing(uuid, text) to authenticated, service_role;

-- Recherche paginée des destinataires d'une campagne (panneau de l'historique) : gabarit de
-- liste (DESIGN.md), recherche serveur sans accents ni casse, chaque mot doit figurer dans le
-- nom ou l'email, ignorée sous 2 caractères. SECURITY INVOKER : la RLS de la table
-- (organisation + bypass super-admin, bénévole exclu) reste la garde.
create or replace function public.rechercher_destinataires_campagne(
  p_campagne_id uuid,
  p_statut text,
  p_recherche text default null,
  p_limit int default 50,
  p_offset int default 0
)
returns table (
  id uuid,
  nom text,
  courriel text,
  raison_exclusion text,
  total_count bigint
)
language sql
stable
security invoker
set search_path = public, extensions
as $$
  select d.id, d.nom, d.courriel, d.raison_exclusion, count(*) over () as total_count
  from public.campagnes_mailing_destinataires d
  where d.campagne_id = p_campagne_id
    and d.statut = p_statut
    and (
      p_recherche is null
      or length(trim(p_recherche)) < 2
      or not exists (
        select 1
        from unnest(string_to_array(unaccent(lower(trim(p_recherche))), ' ')) as tok
        where tok <> ''
          and unaccent(lower(concat_ws(' ', d.nom, d.courriel)))
              not like '%' || replace(replace(replace(tok, '\', '\\'), '%', '\%'), '_', '\_') || '%'
      )
    )
  order by d.nom, d.id
  limit least(greatest(coalesce(p_limit, 50), 1), 200)
  offset greatest(coalesce(p_offset, 0), 0);
$$;

revoke execute on function public.rechercher_destinataires_campagne(uuid, text, text, int, int) from public, anon;
grant execute on function public.rechercher_destinataires_campagne(uuid, text, text, int, int) to authenticated, service_role;
