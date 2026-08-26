-- Fix: activites_write_admin n'avait pas le bypass super-admin déjà présent sur
-- dons/adherents/profils_participant/personnes. Un super-admin ne pouvait donc
-- pas écrire d'activité pour une organisation (bloquant pour le peuplement
-- automatique de données factices sur une organisation nouvellement créée,
-- cf. carte Trello a8PK4LX9).

drop policy if exists "activites_write_admin" on activites;

create policy "activites_write_admin" on activites
for all
using (
  organisation_id = current_user_organisation_id()
  or (auth.jwt() -> 'app_metadata' ->> 'is_super_admin')::boolean = true
)
with check (
  organisation_id = current_user_organisation_id()
  or (auth.jwt() -> 'app_metadata' ->> 'is_super_admin')::boolean = true
);
