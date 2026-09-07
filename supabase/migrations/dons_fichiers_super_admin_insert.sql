-- Fix : dons_fichiers_insert et dons_fichiers_storage_insert (dons_fichiers.sql)
-- n'avaient pas le bypass super-admin ajouté aux policies select/delete
-- soeurs — oubli, pas une limitation voulue. Repéré le 2026-09-08 : en mode
-- consultation super-admin (pas de ligne profils_organisation pour l'org
-- consultée), l'upload d'une pièce jointe échouait avec "new row violates
-- row-level security policy" alors que la création du don elle-même passait
-- (dons_insert avait déjà le bypass).

drop policy if exists "dons_fichiers_insert" on dons_fichiers;
create policy "dons_fichiers_insert" on dons_fichiers
  for insert with check (
    (auth.jwt() -> 'app_metadata' ->> 'is_super_admin')::boolean = true
    or organisation_id = current_effective_organisation_id()
  );

drop policy if exists "dons_fichiers_storage_insert" on storage.objects;
create policy "dons_fichiers_storage_insert"
  on storage.objects for insert
  with check (
    bucket_id = 'dons-fichiers'
    and (
      (auth.jwt() -> 'app_metadata' ->> 'is_super_admin')::boolean = true
      or (storage.foldername(name))[1] = public.current_effective_organisation_id()::text
    )
  );
