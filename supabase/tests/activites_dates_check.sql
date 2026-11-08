-- Tests de la contrainte activites_dates_check (activites_dates_check.sql) — staging uniquement :
--   npx supabase db query --linked -f supabase/tests/activites_dates_check.sql
-- Bloc terminé par une exception : rien n'est conservé (la suppression/repose temporaire de la
-- contrainte au cas 4 est annulée avec le reste). Dépend de l'org « Association Démo Staging »
-- (un admin).
do $$
declare v_demo uuid; v_admin uuid; v_id uuid; v_bad uuid := gen_random_uuid(); r text := '';
begin
  select id into v_demo from public.organisations where nom = 'Association Démo Staging';
  select po.utilisateur_id into v_admin from public.profils_organisation po
    where po.organisation_id = v_demo and po.role = 'admin' order by po.created_at desc limit 1;

  -- 4 (préparation, en postgres). Ligne incohérente « existante » : contrainte retirée, ligne
  -- insérée, contrainte reposée NOT VALID — la repose doit réussir malgré la ligne.
  alter table public.activites drop constraint activites_dates_check;
  insert into public.activites (id, organisation_id, nom, date_debut, date_fin)
    values (v_bad, v_demo, 'TEST incohérente', '2026-12-21', '2026-09-27');
  alter table public.activites add constraint activites_dates_check
    check (date_fin is null or date_debut is null or date_fin >= date_debut) not valid;
  r := r || '0.repose_not_valid=ok';

  -- Session admin de l'organisation (formulaire = PostgREST sous RLS)
  perform set_config('request.jwt.claims', json_build_object('sub', v_admin, 'role', 'authenticated', 'app_metadata', json_build_object())::text, true);
  execute 'set local role authenticated';

  -- 1. Dates cohérentes, même jour, ou une seule date : acceptées
  insert into public.activites (organisation_id, nom, date_debut, date_fin) values (v_demo, 'TEST ok', '2026-12-21', '2026-12-27') returning id into v_id;
  insert into public.activites (organisation_id, nom, date_debut, date_fin) values (v_demo, 'TEST même jour', '2026-12-21', '2026-12-21');
  insert into public.activites (organisation_id, nom, date_debut) values (v_demo, 'TEST début seul', '2026-12-21');
  insert into public.activites (organisation_id, nom, date_fin) values (v_demo, 'TEST fin seule', '2026-12-21');
  r := r || ' | 1.coherentes=acceptees';

  -- 2. Création avec fin < début : refusée
  begin
    insert into public.activites (organisation_id, nom, date_debut, date_fin) values (v_demo, 'TEST ko', '2026-12-21', '2026-09-27');
    r := r || ' | 2.insert_incoherent=ACCEPTE(KO)';
  exception when check_violation then r := r || ' | 2.insert_incoherent=refuse';
  end;

  -- 3. Modification rendant les dates incohérentes : refusée
  begin
    update public.activites set date_fin = '2026-01-01' where id = v_id;
    r := r || ' 3.update_incoherent=ACCEPTE(KO)';
  exception when check_violation then r := r || ' 3.update_incoherent=refuse';
  end;

  -- 4. Ligne existante incohérente : lisible ; modif sans corriger refusée ; correction acceptée
  r := r || ' | 4.lecture=' || (select count(*) from public.activites where id = v_bad)::text;
  begin
    update public.activites set nom = 'TEST renommée' where id = v_bad;
    r := r || ' renommer_sans_corriger=ACCEPTE(KO)';
  exception when check_violation then r := r || ' renommer_sans_corriger=refuse';
  end;
  update public.activites set date_fin = '2026-12-27' where id = v_bad;
  r := r || ' correction=acceptee';

  -- 5. Import (RPC) avec une ligne incohérente : refusé
  begin
    perform public.import_upsert_activites(
      jsonb_build_array(jsonb_build_object('id', gen_random_uuid(), 'id_externe', 'TEST-IMP', 'nom', 'TEST import ko', 'date_debut', '2026-12-21', 'date_fin', '2026-09-27')),
      v_demo);
    r := r || ' | 5.import_incoherent=ACCEPTE(KO)';
  exception when check_violation then r := r || ' | 5.import_incoherent=refuse';
  end;

  raise exception 'RESULTATS: %', r;
end;
$$;
