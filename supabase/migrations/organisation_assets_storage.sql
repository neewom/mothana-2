-- =========================================================
-- Migration : bucket Storage pour les assets d'organisation
-- (logo, tampon/cachet, signature) — utilisables comme
-- placeholders dans les templates de reçus fiscaux.
-- À exécuter dans Supabase SQL Editor.
-- =========================================================
-- Bucket public : ces images finissent de toute façon sur un
-- PDF remis au donateur (pas de confidentialité à préserver),
-- ce qui évite d'avoir à générer des URLs signées à chaque
-- aperçu de template et à chaque rendu Gotenberg.
-- Écriture restreinte : 1er segment du chemin objet doit
-- correspondre à l'organisation_id de l'utilisateur (même
-- pattern que le bucket recus-fiscaux).
-- =========================================================

insert into storage.buckets (id, name, public)
values ('organisation-assets', 'organisation-assets', true)
on conflict (id) do nothing;

drop policy if exists "organisation_assets_write" on storage.objects;
create policy "organisation_assets_write"
  on storage.objects for all
  using (
    bucket_id = 'organisation-assets'
    and (
      (auth.jwt() -> 'app_metadata' ->> 'is_super_admin')::boolean = true
      or (storage.foldername(name))[1] = (
        select organisation_id::text from profils_organisation
        where utilisateur_id = auth.uid() limit 1
      )
    )
  );
