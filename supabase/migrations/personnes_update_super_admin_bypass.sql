-- Fix: personnes_update policy was missing the super-admin bypass that
-- personnes_select and profils_participant_update_admin already have.
-- In super-admin "viewing org" mode, current_effective_organisation_id()
-- returns NULL (super-admin has no profils_organisation row), so the
-- EXISTS subquery never matched and updates silently affected 0 rows.

drop policy if exists "personnes_update" on personnes;

create policy "personnes_update" on personnes
for update
using (
  (((auth.jwt() -> 'app_metadata'::text) ->> 'is_super_admin'::text)::boolean = true)
  or (exists (
    select 1
    from profils_participant pp
    where pp.personne_id = personnes.id
      and pp.organisation_id = current_effective_organisation_id()
  ))
);
