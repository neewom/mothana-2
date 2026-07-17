-- Refonte Cerfa (§3 docs/brief-cerfa.md) : le super-admin doit pouvoir seeder
-- les templates par défaut à la création d'une organisation, avant même d'en
-- être membre (current_effective_organisation_id() renvoie NULL pour lui à ce
-- moment-là). Même pattern que super_admin_rls.sql pour les autres tables.
drop policy if exists "templates_recu_org" on templates_recu;
create policy "templates_recu_org" on templates_recu
  for all using (
    (auth.jwt() -> 'app_metadata' ->> 'is_super_admin')::boolean = true
    or organisation_id = current_effective_organisation_id()
  );
