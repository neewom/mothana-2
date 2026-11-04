-- Saisie d'une adhésion depuis l'espace bénévole (batch Adhésion, carte 1/3,
-- https://trello.com/c/QKOGBYLO, 2026-11-04). Un bénévole de confiance crée directement un
-- adhérent et sa première adhésion, sans ratification ni passage par « Demandes ».
--
-- Sécurité : le bénévole ne récupère AUCUN droit direct sur adherents / adhesions (cf.
-- rls_benevole_restreint.sql). Tout passe par deux RPC SECURITY DEFINER gardées :
--   - verifier_doublon_adhesion_benevole : booléen seul (aucune donnée de l'existant) ;
--   - creer_adhesion_benevole : validation serveur, adhérent + adhésion + signature + journal,
--     en une transaction.
-- Garde commune (peut_saisir_adhesion_benevole) : bénévole de l'organisation ET réglage
-- organisations.saisie_adhesion_benevole actif, ou compte de l'organisation (admin /
-- contributeur, qui ont déjà le droit de créer un adhérent), ou super-admin. Écrite en
-- coalesce(…, false) : une session sans organisation (vendeur, anon) vaut NULL → refus.
--
-- Signature : même format que le formulaire public (data URL PNG base64, mêmes bornes que
-- soumettre-demande-adhesion/validation.ts). adherents n'a pas de colonne signature et une
-- demande ratifiée ferait apparaître la saisie dans « Demandes » : elle va dans une table
-- dédiée signatures_adhesion (une ligne par adhésion signée à l'écran), hors des
-- select('*') de adhesions. « Signé sur papier » : pas de ligne, mode tracé au journal.
begin;

-- 1. Réglage de l'organisation (Paramètres → Adhésions, policy org_update_admin).
alter table public.organisations
  add column if not exists saisie_adhesion_benevole boolean not null default false;

comment on column public.organisations.saisie_adhesion_benevole is
  'Les bénévoles (espace /benevole) peuvent créer un adhérent et sa première adhésion (RPC creer_adhesion_benevole).';

-- 2. Signatures tactiles des adhésions saisies par un bénévole.
create table if not exists public.signatures_adhesion (
  adhesion_id uuid primary key references public.adhesions(id) on delete cascade,
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  signature_data_url text not null
    constraint signatures_adhesion_format_check check (
      signature_data_url like 'data:image/png;base64,%' and length(signature_data_url) <= 300000
    ),
  created_at timestamptz not null default now()
);

create index if not exists idx_signatures_adhesion_organisation_id on public.signatures_adhesion(organisation_id);

comment on table public.signatures_adhesion is
  'Signature dessinée (canvas) d''une adhésion saisie dans l''espace bénévole — signature simple, pas de valeur probante eIDAS. Écrite uniquement par creer_adhesion_benevole.';

alter table public.signatures_adhesion enable row level security;

-- Comptes de l'organisation (profils_organisation) + bypass super-admin, sur les 4 opérations.
-- Le bénévole n'y a aucun accès direct (current_user_organisation_id, pas effective).
drop policy if exists signatures_adhesion_select on public.signatures_adhesion;
create policy signatures_adhesion_select on public.signatures_adhesion
  for select to authenticated
  using (
    organisation_id = (select public.current_user_organisation_id())
    or coalesce((select public.is_current_user_super_admin()), false)
  );

drop policy if exists signatures_adhesion_insert on public.signatures_adhesion;
create policy signatures_adhesion_insert on public.signatures_adhesion
  for insert to authenticated
  with check (
    organisation_id = (select public.current_user_organisation_id())
    or coalesce((select public.is_current_user_super_admin()), false)
  );

drop policy if exists signatures_adhesion_update on public.signatures_adhesion;
create policy signatures_adhesion_update on public.signatures_adhesion
  for update to authenticated
  using (
    organisation_id = (select public.current_user_organisation_id())
    or coalesce((select public.is_current_user_super_admin()), false)
  )
  with check (
    organisation_id = (select public.current_user_organisation_id())
    or coalesce((select public.is_current_user_super_admin()), false)
  );

drop policy if exists signatures_adhesion_delete on public.signatures_adhesion;
create policy signatures_adhesion_delete on public.signatures_adhesion
  for delete to authenticated
  using (
    organisation_id = (select public.current_user_organisation_id())
    or coalesce((select public.is_current_user_super_admin()), false)
  );

-- 3. Garde commune (interne, non exposée).
create or replace function public.peut_saisir_adhesion_benevole(p_organisation_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select auth.uid() is not null and coalesce(
    (
      public.current_benevole_organisation_id() = p_organisation_id
      and exists (
        select 1 from public.organisations o
        where o.id = p_organisation_id and o.saisie_adhesion_benevole
      )
    )
    or public.is_current_user_super_admin()
    or p_organisation_id = public.current_user_organisation_id(),
    false
  );
$$;

revoke all on function public.peut_saisir_adhesion_benevole(uuid) from public, anon, authenticated;

-- 3 bis. Nettoyage des textes saisis, aligné sur String.prototype.trim() : espaces,
-- tabulations, retours à la ligne, espaces insécables et autres blancs Unicode (btrim() ne
-- retire que l'espace ASCII).
create or replace function public.nettoyer_texte_saisie(p_texte text)
returns text
language sql
immutable
set search_path = public, pg_temp
as $$
  select regexp_replace(
    p_texte,
    '^[\s\u00a0\ufeff\u1680\u2000-\u200a\u2028\u2029\u202f\u205f\u3000]+|[\s\u00a0\ufeff\u1680\u2000-\u200a\u2028\u2029\u202f\u205f\u3000]+$',
    '',
    'g'
  );
$$;

revoke all on function public.nettoyer_texte_saisie(text) from public, anon, authenticated;

-- 4. Numéro d'adhérent : même séquence (adherent_id_externe_seq_<org>) que
-- next_adherent_id_externe, sans sa garde utilisateur (qui refuse le bénévole). Resynchronisée
-- sur le plus grand numéro présent (cf. next_adherent_id_externe_resync.sql), jamais en arrière.
create or replace function public.attribuer_numero_adherent(p_organisation_id uuid)
returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  seq_name text := 'adherent_id_externe_seq_' || replace(p_organisation_id::text, '-', '_');
  current_max integer;
  next_val bigint;
begin
  select coalesce(max(id_externe::int), 0)
  into current_max
  from public.adherents
  where organisation_id = p_organisation_id
    and id_externe ~ '^[0-9]+$';

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

revoke all on function public.attribuer_numero_adherent(uuid) from public, anon, authenticated;

-- 5. Doublon : même nom + prénom (casse et espaces ignorés) ou même courriel.
create or replace function public.adherent_doublon_existe(
  p_organisation_id uuid,
  p_nom text,
  p_prenom text,
  p_courriel text
)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.adherents a
    where a.organisation_id = p_organisation_id
      and (
        (
          nullif(public.nettoyer_texte_saisie(p_nom), '') is not null
          and lower(public.nettoyer_texte_saisie(a.nom)) = lower(public.nettoyer_texte_saisie(p_nom))
          and lower(coalesce(public.nettoyer_texte_saisie(a.prenom), '')) = lower(coalesce(public.nettoyer_texte_saisie(p_prenom), ''))
        )
        or (
          nullif(public.nettoyer_texte_saisie(p_courriel), '') is not null
          and lower(public.nettoyer_texte_saisie(a.courriel)) = lower(public.nettoyer_texte_saisie(p_courriel))
        )
      )
  );
$$;

revoke all on function public.adherent_doublon_existe(uuid, text, text, text) from public, anon, authenticated;

create or replace function public.verifier_doublon_adhesion_benevole(
  p_organisation_id uuid,
  p_nom text,
  p_prenom text,
  p_courriel text
)
returns boolean
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
begin
  if not coalesce(public.peut_saisir_adhesion_benevole(p_organisation_id), false) then
    raise exception 'ACCES_REFUSE' using errcode = '42501';
  end if;
  return public.adherent_doublon_existe(p_organisation_id, p_nom, p_prenom, p_courriel);
end;
$$;

revoke all on function public.verifier_doublon_adhesion_benevole(uuid, text, text, text) from public, anon;
grant execute on function public.verifier_doublon_adhesion_benevole(uuid, text, text, text) to authenticated, service_role;

-- 6. Création. p_adherent : mêmes clés que le corps du formulaire public
-- (champsAdhesionPayload : civilite, nom, prenom, date_naissance, adresse, code_postal, ville,
-- pays, telephone, courriel), validées comme validerDemandeAdhesion. Signature : soit
-- p_signature_data_url (tactile), soit p_signe_sur_papier = true, jamais les deux ni aucun.
create or replace function public.creer_adhesion_benevole(
  p_organisation_id uuid,
  p_adherent jsonb,
  p_accepte_statuts boolean,
  p_consent_rgpd boolean,
  p_signature_data_url text,
  p_signe_sur_papier boolean,
  p_date_debut date,
  p_montant_cotisation numeric,
  p_mode_paiement smallint
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  c_bornes constant jsonb := '{"nom":100,"prenom":100,"date_naissance":10,"adresse":200,"code_postal":5,"ville":100,"pays":100,"telephone":30,"courriel":254}';
  c_signature_prefixe constant text := 'data:image/png;base64,';
  v_cle text;
  v_civilite smallint;
  v_nom text;
  v_prenom text;
  v_date_naissance date;
  v_adresse text;
  v_code_postal text;
  v_ville text;
  v_pays text;
  v_telephone text;
  v_courriel text;
  v_papier boolean := coalesce(p_signe_sur_papier, false);
  v_statuts_url text;
  v_doublon boolean;
  v_adherent_id uuid := gen_random_uuid();
  v_adhesion_id uuid := gen_random_uuid();
  v_id_externe text;
  v_date_fin date;
begin
  if not coalesce(public.peut_saisir_adhesion_benevole(p_organisation_id), false) then
    raise exception 'ACCES_REFUSE' using errcode = '42501';
  end if;

  -- Champs : texte ou absent, longueur bornée (mêmes bornes que validation.ts).
  if p_adherent is null or jsonb_typeof(p_adherent) <> 'object' then
    raise exception 'ADHESION_INVALIDE' using errcode = '22023';
  end if;
  for v_cle in select jsonb_object_keys(c_bornes) loop
    if jsonb_typeof(p_adherent -> v_cle) not in ('string', 'null')
       or length(public.nettoyer_texte_saisie(p_adherent ->> v_cle)) > (c_bornes ->> v_cle)::int then
      raise exception 'ADHESION_INVALIDE' using errcode = '22023';
    end if;
  end loop;

  v_nom         := nullif(public.nettoyer_texte_saisie(p_adherent ->> 'nom'), '');
  v_prenom      := nullif(public.nettoyer_texte_saisie(p_adherent ->> 'prenom'), '');
  v_adresse     := nullif(public.nettoyer_texte_saisie(p_adherent ->> 'adresse'), '');
  v_code_postal := nullif(public.nettoyer_texte_saisie(p_adherent ->> 'code_postal'), '');
  v_ville       := nullif(public.nettoyer_texte_saisie(p_adherent ->> 'ville'), '');
  v_pays        := nullif(public.nettoyer_texte_saisie(p_adherent ->> 'pays'), '');
  v_telephone   := nullif(public.nettoyer_texte_saisie(p_adherent ->> 'telephone'), '');
  v_courriel    := nullif(public.nettoyer_texte_saisie(p_adherent ->> 'courriel'), '');

  if jsonb_typeof(p_adherent -> 'civilite') is distinct from 'number'
     or (p_adherent ->> 'civilite') not in ('0', '1', '2') then
    raise exception 'ADHESION_INVALIDE' using errcode = '22023';
  end if;
  v_civilite := (p_adherent ->> 'civilite')::smallint;

  if v_nom is null or v_code_postal is null or v_code_postal !~ '^[0-9]{5}$' then
    raise exception 'ADHESION_INVALIDE' using errcode = '22023';
  end if;
  if v_telephone is not null and v_telephone !~ '^[0-9 +().-]+$' then
    raise exception 'ADHESION_INVALIDE' using errcode = '22023';
  end if;
  if v_courriel is not null and v_courriel !~ '^[^[:space:]@]+@[^[:space:]@]+\.[A-Za-z]{2,24}$' then
    raise exception 'ADHESION_INVALIDE' using errcode = '22023';
  end if;

  if nullif(public.nettoyer_texte_saisie(p_adherent ->> 'date_naissance'), '') is not null then
    if public.nettoyer_texte_saisie(p_adherent ->> 'date_naissance') !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' then
      raise exception 'ADHESION_INVALIDE' using errcode = '22023';
    end if;
    begin
      v_date_naissance := public.nettoyer_texte_saisie(p_adherent ->> 'date_naissance')::date;
    exception when others then
      raise exception 'ADHESION_INVALIDE' using errcode = '22023';
    end;
    if to_char(v_date_naissance, 'YYYY-MM-DD') <> public.nettoyer_texte_saisie(p_adherent ->> 'date_naissance')
       or extract(year from v_date_naissance) < 1900
       or extract(year from v_date_naissance) > extract(year from current_date) - 1 then
      raise exception 'ADHESION_INVALIDE' using errcode = '22023';
    end if;
  end if;

  -- Consentements (statuts exigés seulement si l'organisation en publie).
  select o.statuts_url into v_statuts_url from public.organisations o where o.id = p_organisation_id;
  if not coalesce(p_consent_rgpd, false) then
    raise exception 'CONSENTEMENT_REQUIS' using errcode = '22023';
  end if;
  if v_statuts_url is not null and not coalesce(p_accepte_statuts, false) then
    raise exception 'STATUTS_REQUIS' using errcode = '22023';
  end if;

  -- Signature : tactile XOR papier.
  if v_papier then
    if p_signature_data_url is not null then
      raise exception 'SIGNATURE_INVALIDE' using errcode = '22023';
    end if;
  elsif p_signature_data_url is null
     or left(p_signature_data_url, length(c_signature_prefixe)) <> c_signature_prefixe
     or length(p_signature_data_url) > 300000
     or substr(p_signature_data_url, length(c_signature_prefixe) + 1) !~ '^[A-Za-z0-9+/]+=*$' then
    raise exception 'SIGNATURE_INVALIDE' using errcode = '22023';
  end if;

  -- Adhésion.
  if p_date_debut is null then
    raise exception 'DATE_ADHESION_REQUISE' using errcode = '22023';
  end if;
  if p_date_debut < date '1900-01-01' or p_date_debut > (current_date + interval '1 year')::date then
    raise exception 'DATE_ADHESION_INVALIDE' using errcode = '22023';
  end if;
  -- NaN et Infinity (numeric) refusés explicitement ; borne haute raisonnable.
  if p_montant_cotisation is not null
     and (p_montant_cotisation = 'NaN'::numeric
          or p_montant_cotisation < 0
          or p_montant_cotisation > 100000) then
    raise exception 'MONTANT_INVALIDE' using errcode = '22023';
  end if;
  if p_mode_paiement is not null and p_mode_paiement not in (1, 2, 3, 4) then
    raise exception 'MODE_PAIEMENT_INVALIDE' using errcode = '22023';
  end if;

  v_doublon := public.adherent_doublon_existe(p_organisation_id, v_nom, v_prenom, v_courriel);
  v_id_externe := public.attribuer_numero_adherent(p_organisation_id);

  insert into public.adherents (
    id, organisation_id, id_externe, civilite, nom, prenom, date_naissance, adresse, code_postal,
    ville, pays, telephone, courriel, statuts_acceptes, consent_rgpd
  ) values (
    v_adherent_id, p_organisation_id, v_id_externe, v_civilite, v_nom, v_prenom, v_date_naissance,
    v_adresse, v_code_postal, v_ville, v_pays, v_telephone, v_courriel, true, true
  );

  -- date_fin posée par trg_adhesions_poser_date_fin selon la règle de l'organisation.
  insert into public.adhesions (
    id, adherent_id, date_debut, montant_cotisation, mode_paiement, renouvellement, bulletin_signe
  ) values (
    v_adhesion_id, v_adherent_id, p_date_debut, p_montant_cotisation, p_mode_paiement, false, true
  )
  returning date_fin into v_date_fin;

  if not v_papier then
    insert into public.signatures_adhesion (adhesion_id, organisation_id, signature_data_url)
    values (v_adhesion_id, p_organisation_id, p_signature_data_url);
  end if;

  insert into public.journal_modifications (organisation_id, table_cible, ligne_id, action, details, auteur_id)
  values (
    p_organisation_id, 'adherents', v_adherent_id, 'creation',
    jsonb_build_object(
      'nom', v_nom, 'prenom', v_prenom, 'origine', 'benevole', 'adhesion_id', v_adhesion_id,
      'signature', case when v_papier then 'papier' else 'tactile' end
    ),
    auth.uid()
  );

  return jsonb_build_object(
    'adherent_id', v_adherent_id,
    'adhesion_id', v_adhesion_id,
    'id_externe', v_id_externe,
    'date_fin', v_date_fin,
    'doublon', v_doublon
  );
end;
$$;

revoke all on function public.creer_adhesion_benevole(uuid, jsonb, boolean, boolean, text, boolean, date, numeric, smallint) from public, anon;
grant execute on function public.creer_adhesion_benevole(uuid, jsonb, boolean, boolean, text, boolean, date, numeric, smallint) to authenticated, service_role;

commit;
