-- =========================================================
-- Migration : limites de type et de taille sur le bucket
-- organisation-assets (relevé audit sécurité 2026-10-24).
-- =========================================================
-- Jusqu'ici, seules les UI (AssetsManager : PNG/JPEG ;
-- ParametresAdhesionsPage : statuts PDF) limitaient le type
-- et la taille, contournable par un appel direct à l'API
-- Storage. Le bucket porte désormais lui-même ces limites.
-- application/pdf est indispensable : statuts du formulaire
-- d'adhésion public.
-- Les fichiers déjà présents ne sont pas concernés.
-- =========================================================

update storage.buckets
set file_size_limit = 2097152, -- 2 Mo
    allowed_mime_types = array['image/png', 'image/jpeg', 'application/pdf']
where id = 'organisation-assets';
