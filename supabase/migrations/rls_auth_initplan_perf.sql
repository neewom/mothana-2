-- =========================================================
-- Migration : perf RLS — éviter la ré-évaluation de auth.jwt()/auth.uid()
-- à chaque ligne (auth_rls_initplan, cf. Supabase Performance Advisor)
-- =========================================================
-- Confirmé par `supabase db advisors --linked --type performance` : quasiment
-- toutes les policies RLS du projet appellent auth.jwt()/auth.uid() (direct
-- ou via current_user_organisation_id()/current_effective_organisation_id())
-- sans les envelopper dans un sous-select — Postgres peut alors les
-- ré-évaluer à chaque ligne scannée au lieu d'une seule fois par requête.
-- Sur Wat Velouvanaram (3335 participants, 15632 dons, 314 activités),
-- ça correspond au ~10s de chargement observé sur Participants/Dons/Activités.
--
-- Correctif recommandé par la doc officielle Supabase : envelopper
-- auth.jwt()/auth.uid() (et les fonctions helper qui les appellent) dans
-- (select ...), pour forcer un InitPlan évalué une seule fois par requête.
-- Logique de sécurité strictement identique — uniquement un indice de
-- planification différent pour le même prédicat.
-- =========================================================

-- ---------------------------------------------------------
-- 1. Fonctions helper : envelopper auth.uid()/auth.jwt() en interne
-- ---------------------------------------------------------
create or replace function current_user_organisation_id()
returns uuid as $$
  select organisation_id
  from profils_organisation
  where utilisateur_id = (select auth.uid())
  limit 1;
$$ language sql stable security definer;

create or replace function current_benevole_organisation_id()
returns uuid as $$
  select ((select auth.jwt()) -> 'app_metadata' ->> 'organisation_id')::uuid
  where ((select auth.jwt()) -> 'app_metadata' ->> 'role') = 'benevole';
$$ language sql stable;

-- current_effective_organisation_id() ne change pas : elle ne fait
-- qu'appeler les deux fonctions ci-dessus (déjà corrigées), et est elle-même
-- enveloppée en (select ...) à chaque point d'appel ci-dessous.

-- ---------------------------------------------------------
-- 2. organisations
-- ---------------------------------------------------------
drop policy if exists "org_select" on organisations;
create policy "org_select" on organisations
  for select using (
    (((select auth.jwt()) -> 'app_metadata' ->> 'is_super_admin'))::boolean = true
    or id = (select current_effective_organisation_id())
  );

drop policy if exists "org_update_admin" on organisations;
create policy "org_update_admin" on organisations
  for update using (
    (((select auth.jwt()) -> 'app_metadata' ->> 'is_super_admin'))::boolean = true
    or id = (select current_user_organisation_id())
  );

drop policy if exists "org_insert_superadmin" on organisations;
create policy "org_insert_superadmin" on organisations
  for insert with check (
    (((select auth.jwt()) -> 'app_metadata' ->> 'is_super_admin'))::boolean = true
  );

drop policy if exists "org_delete_superadmin" on organisations;
create policy "org_delete_superadmin" on organisations
  for delete using (
    (((select auth.jwt()) -> 'app_metadata' ->> 'is_super_admin'))::boolean = true
  );

-- ---------------------------------------------------------
-- 3. dons
-- ---------------------------------------------------------
drop policy if exists "dons_select_admin" on dons;
create policy "dons_select_admin" on dons
  for select using (
    (((select auth.jwt()) -> 'app_metadata' ->> 'is_super_admin'))::boolean = true
    or organisation_id = (select current_user_organisation_id())
  );

drop policy if exists "dons_insert" on dons;
create policy "dons_insert" on dons
  for insert with check (
    (((select auth.jwt()) -> 'app_metadata' ->> 'is_super_admin'))::boolean = true
    or organisation_id = (select current_effective_organisation_id())
  );

drop policy if exists "dons_update_admin" on dons;
create policy "dons_update_admin" on dons
  for update using (
    (((select auth.jwt()) -> 'app_metadata' ->> 'is_super_admin'))::boolean = true
    or organisation_id = (select current_user_organisation_id())
  );

drop policy if exists "dons_delete_admin" on dons;
create policy "dons_delete_admin" on dons
  for delete using (
    (((select auth.jwt()) -> 'app_metadata' ->> 'is_super_admin'))::boolean = true
    or organisation_id = (select current_user_organisation_id())
  );

-- ---------------------------------------------------------
-- 4. profils_participant
-- ---------------------------------------------------------
drop policy if exists "profils_participant_select" on profils_participant;
create policy "profils_participant_select" on profils_participant
  for select using (
    (((select auth.jwt()) -> 'app_metadata' ->> 'is_super_admin'))::boolean = true
    or organisation_id = (select current_effective_organisation_id())
  );

drop policy if exists "profils_participant_insert" on profils_participant;
create policy "profils_participant_insert" on profils_participant
  for insert with check (
    (((select auth.jwt()) -> 'app_metadata' ->> 'is_super_admin'))::boolean = true
    or organisation_id = (select current_effective_organisation_id())
  );

drop policy if exists "profils_participant_update_admin" on profils_participant;
create policy "profils_participant_update_admin" on profils_participant
  for update using (
    (((select auth.jwt()) -> 'app_metadata' ->> 'is_super_admin'))::boolean = true
    or organisation_id = (select current_user_organisation_id())
  );

drop policy if exists "profils_participant_delete_admin" on profils_participant;
create policy "profils_participant_delete_admin" on profils_participant
  for delete using (
    (((select auth.jwt()) -> 'app_metadata' ->> 'is_super_admin'))::boolean = true
    or organisation_id = (select current_user_organisation_id())
  );

-- ---------------------------------------------------------
-- 5. personnes (subquery corrélée — on enveloppe l'appel interne)
-- ---------------------------------------------------------
drop policy if exists "personnes_select" on personnes;
create policy "personnes_select" on personnes
  for select using (
    (((select auth.jwt()) -> 'app_metadata' ->> 'is_super_admin'))::boolean = true
    or exists (
      select 1 from profils_participant pp
      where pp.personne_id = personnes.id
        and pp.organisation_id = (select current_effective_organisation_id())
    )
  );

drop policy if exists "personnes_update" on personnes;
create policy "personnes_update" on personnes
  for update using (
    (((select auth.jwt()) -> 'app_metadata' ->> 'is_super_admin'))::boolean = true
    or exists (
      select 1 from profils_participant pp
      where pp.personne_id = personnes.id
        and pp.organisation_id = (select current_effective_organisation_id())
    )
  );

-- ---------------------------------------------------------
-- 6. activites
-- ---------------------------------------------------------
drop policy if exists "activites_select" on activites;
create policy "activites_select" on activites
  for select using (
    (((select auth.jwt()) -> 'app_metadata' ->> 'is_super_admin'))::boolean = true
    or organisation_id = (select current_effective_organisation_id())
  );

drop policy if exists "activites_write_admin" on activites;
create policy "activites_write_admin" on activites
  for all using (
    organisation_id = (select current_user_organisation_id())
  );

-- ---------------------------------------------------------
-- 7. recus_fiscaux
-- ---------------------------------------------------------
drop policy if exists "recus_all_admin" on recus_fiscaux;
create policy "recus_all_admin" on recus_fiscaux
  for all using (
    (((select auth.jwt()) -> 'app_metadata' ->> 'is_super_admin'))::boolean = true
    or organisation_id = (select current_user_organisation_id())
  );

-- ---------------------------------------------------------
-- 8. profils_organisation
-- ---------------------------------------------------------
drop policy if exists "profils_org_select" on profils_organisation;
create policy "profils_org_select" on profils_organisation
  for select using (
    (((select auth.jwt()) -> 'app_metadata' ->> 'is_super_admin'))::boolean = true
    or organisation_id = (select current_user_organisation_id())
  );

drop policy if exists "profils_org_all_admin" on profils_organisation;
create policy "profils_org_all_admin" on profils_organisation
  for all using (
    (((select auth.jwt()) -> 'app_metadata' ->> 'is_super_admin'))::boolean = true
    or organisation_id = (select current_user_organisation_id())
  );

-- ---------------------------------------------------------
-- 9. templates_recu
-- ---------------------------------------------------------
drop policy if exists "templates_recu_org" on templates_recu;
create policy "templates_recu_org" on templates_recu
  for all using (
    (((select auth.jwt()) -> 'app_metadata' ->> 'is_super_admin'))::boolean = true
    or organisation_id = (select current_effective_organisation_id())
  );
