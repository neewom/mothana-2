-- =========================================================
-- Migration : autorise la suppression d'un participant
-- À exécuter dans Supabase SQL Editor
-- =========================================================
-- profils_participant n'avait que des policies select/insert/update,
-- pas de delete. Nécessaire pour la fonctionnalité "Supprimer un
-- participant" (ParticipantsPage), bloquée côté frontend si le
-- participant a des dons liés.
-- =========================================================

create policy "profils_participant_delete_admin" on profils_participant
  for delete using (
    (auth.jwt() -> 'app_metadata' ->> 'is_super_admin')::boolean = true
    or organisation_id = current_user_organisation_id()
  );
