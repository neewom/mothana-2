-- Blocage trouvé en testant la PR "super-admin sans blocages Supabase pour
-- l'onboarding" (2026-09-15) : organisation_assets était la seule table
-- encore sans bypass is_super_admin (toutes les autres l'ont déjà, cf.
-- super_admin_rls.sql et les migrations *_super_admin_bypass.sql) — un
-- super-admin en mode "Consulter" ne pouvait pas uploader un asset
-- (logo/tampon/signature), "new row violates row-level security policy".
drop policy if exists "organisation_assets_org" on organisation_assets;
create policy "organisation_assets_org" on organisation_assets
  for all using (
    (auth.jwt() -> 'app_metadata' ->> 'is_super_admin')::boolean = true
    or organisation_id = (select current_effective_organisation_id())
  );
