-- Cadré 2026-09-15, suite au fix organisation_assets (seule table sur 53
-- policies à avoir oublié le bypass is_super_admin) : deux briques pour
-- réduire le risque d'oubli sur une future table, pas une garantie
-- automatique (Postgres n'applique aucune policy rétroactivement/par défaut
-- à une nouvelle table — chaque `create policy` reste un acte explicite).

-- 1) Helper réutilisable : une policy organisation-scopée s'écrit désormais
-- `using (is_organisation_row_accessible(organisation_id))` plutôt que de
-- re-taper la condition OR à chaque fois — un seul endroit à maintenir si
-- la logique du bypass change un jour. Réutilise is_current_user_super_admin()
-- déjà créée pour les RPC d'import (super_admin_bypass_import_rpc.sql).
create or replace function is_organisation_row_accessible(row_organisation_id uuid)
returns boolean as $$
  select is_current_user_super_admin() or row_organisation_id = (select current_effective_organisation_id());
$$ language sql stable;

-- 2) Filet de sécurité : liste toute policy qui semble scoper par
-- organisation (organisation_id, ou les helpers current_effective_
-- organisation_id/current_user_organisation_id/current_benevole_
-- organisation_id) sans mentionner is_super_admin ni le nouveau helper
-- ci-dessus. Faux positifs possibles sur des policies volontairement
-- exemptées (ex. formulaire public, actions déjà exclusives au
-- super-admin) — à vérifier au cas par cas, pas une preuve absolue de bug.
-- Usage : select * from audit_missing_super_admin_bypass();
create or replace function audit_missing_super_admin_bypass()
returns table(tablename text, policyname text, cmd text, qual text, with_check text) as $$
  select p.tablename, p.policyname, p.cmd, p.qual::text, p.with_check::text
  from pg_policies p
  where p.schemaname = 'public'
    and (
      coalesce(p.qual, '') ~* 'organisation_id|current_effective_organisation_id|current_user_organisation_id|current_benevole_organisation_id'
      or coalesce(p.with_check, '') ~* 'organisation_id|current_effective_organisation_id|current_user_organisation_id|current_benevole_organisation_id'
    )
    and coalesce(p.qual, '') !~* 'is_super_admin|is_organisation_row_accessible'
    and coalesce(p.with_check, '') !~* 'is_super_admin|is_organisation_row_accessible';
$$ language sql stable security definer set search_path = public, pg_temp;
