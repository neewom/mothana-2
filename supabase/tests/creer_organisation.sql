-- Tests de creer_organisation (migration creer_organisation.sql) — staging uniquement :
--   npx supabase db query --linked -f supabase/tests/creer_organisation.sql
-- Bloc terminé par une exception : rien n'est conservé. Dépend de l'org « Association Démo
-- Staging » (compte bénévole existant, un admin, éventuellement un contributeur).
do $$
declare
  v_demo uuid; v_benevole uuid; v_admin uuid; v_contrib uuid; v_id uuid; v_n int;
  v_recus jsonb := '[{"nom":"R1","type_cerfa":"11580","html_template":"<p>1</p>","css":""},
                     {"nom":"R2","type_cerfa":"16216","html_template":"<p>2</p>","css":""}]';
  v_carte jsonb := '{"nom":"C","html_template":"<div></div>","css":""}';
  r text := '';
begin
  select id into v_demo from public.organisations where nom = 'Association Démo Staging';
  select id into v_benevole from auth.users where email = 'benevole-' || v_demo || '@mothana.internal';
  select po.utilisateur_id into v_admin from public.profils_organisation po
    where po.organisation_id = v_demo and po.role = 'admin' order by po.created_at desc limit 1;
  select po.utilisateur_id into v_contrib from public.profils_organisation po
    where po.role = 'contributeur' order by po.created_at desc limit 1;

  -- 1. anon : refusé (aucun droit d'exécution)
  execute 'set local role anon';
  begin
    perform public.creer_organisation('ZZ t1', 'zz-test-creer-org-1', v_recus, v_carte);
    r := r || '1.anon=ACCEPTE(KO)';
  exception when insufficient_privilege then r := r || '1.anon=refuse';
  end;
  execute 'reset role';

  -- 2. Session bénévole : refusée
  perform set_config('request.jwt.claims', json_build_object('sub', v_benevole, 'role', 'authenticated',
    'app_metadata', json_build_object('role', 'benevole', 'organisation_id', v_demo))::text, true);
  execute 'set local role authenticated';
  begin
    perform public.creer_organisation('ZZ t2', 'zz-test-creer-org-2', v_recus, v_carte);
    r := r || ' | 2.benevole=ACCEPTE(KO)';
  exception when insufficient_privilege then r := r || ' | 2.benevole=refuse';
  end;
  execute 'reset role';

  -- 3. Admin d'organisation : refusé
  perform set_config('request.jwt.claims', json_build_object('sub', v_admin, 'role', 'authenticated', 'app_metadata', json_build_object())::text, true);
  execute 'set local role authenticated';
  begin
    perform public.creer_organisation('ZZ t3', 'zz-test-creer-org-3', v_recus, v_carte);
    r := r || ' | 3.admin=ACCEPTE(KO)';
  exception when insufficient_privilege then r := r || ' | 3.admin=refuse';
  end;
  execute 'reset role';

  -- 4. Contributeur : refusé
  perform set_config('request.jwt.claims', json_build_object('sub', coalesce(v_contrib, v_admin), 'role', 'authenticated', 'app_metadata', json_build_object())::text, true);
  execute 'set local role authenticated';
  begin
    perform public.creer_organisation('ZZ t4', 'zz-test-creer-org-4', v_recus, v_carte);
    r := r || ' | 4.contributeur=ACCEPTE(KO)';
  exception when insufficient_privilege then r := r || ' | 4.contributeur=refuse';
  end;
  execute 'reset role';

  -- 5. Super-admin connecté directement (authenticated) : refusé aussi, il passe par l'Edge Function
  perform set_config('request.jwt.claims', json_build_object('sub', v_admin, 'role', 'authenticated',
    'app_metadata', json_build_object('is_super_admin', true))::text, true);
  execute 'set local role authenticated';
  begin
    perform public.creer_organisation('ZZ t5', 'zz-test-creer-org-5', v_recus, v_carte);
    r := r || ' | 5.super_admin_direct=ACCEPTE(KO)';
  exception when insufficient_privilege then r := r || ' | 5.super_admin_direct=refuse';
  end;
  execute 'reset role';

  -- Sessions suivantes : service_role, sans claims d'utilisateur (comme l'Edge Function)
  perform set_config('request.jwt.claims', json_build_object('role', 'service_role')::text, true);
  execute 'set local role service_role';

  -- 6. Atomicité : un modèle de reçu invalide (type Cerfa hors contrainte) → aucune organisation
  begin
    perform public.creer_organisation('ZZ atomicite', 'zz-test-creer-org-atomicite',
      v_recus || '[{"nom":"KO","type_cerfa":"99999","html_template":"x","css":""}]'::jsonb, v_carte);
    r := r || ' | 6.recu_invalide=ACCEPTE(KO)';
  exception when check_violation then r := r || ' | 6.recu_invalide=refuse';
  end;
  select count(*) into v_n from public.organisations where slug = 'zz-test-creer-org-atomicite';
  r := r || ' orgs=' || v_n;

  -- 7. Atomicité : modèle de carte invalide (html_template absent), après les reçus → aucune organisation
  begin
    perform public.creer_organisation('ZZ atomicite', 'zz-test-creer-org-atomicite', v_recus, '{"nom":"C"}'::jsonb);
    r := r || ' | 7.carte_invalide=ACCEPTE(KO)';
  exception when not_null_violation then r := r || ' | 7.carte_invalide=refuse';
  end;
  select count(*) into v_n from public.organisations where slug = 'zz-test-creer-org-atomicite';
  r := r || ' orgs=' || v_n;
  select count(*) into v_n from public.templates_recu where nom in ('R1', 'R2', 'KO') and html_template like '<p>%';
  r := r || ' recus_orphelins=' || v_n;

  -- 8. Succès : organisation + 2 reçus actifs + 1 carte active + secrets (PIN bénévole)
  v_id := public.creer_organisation('ZZ Test succès', 'zz-test-creer-org-ok', v_recus, v_carte);
  r := r || ' | 8.ok recus_actifs=' || (select count(*) from public.templates_recu where organisation_id = v_id and is_active)
    || ' cartes_actives=' || (select count(*) from public.templates_carte_adherent where organisation_id = v_id and is_active)
    || ' pin=' || (select (code_pin_benevole is not null)::text from public.organisation_secrets where organisation_id = v_id)
    || ' fonctionnalites=' || (select fonctionnalites_activees::text from public.organisations where id = v_id);

  -- 9. Doublon de slug : unique_violation (23505)
  begin
    perform public.creer_organisation('ZZ Test succès bis', 'zz-test-creer-org-ok', v_recus, v_carte);
    r := r || ' | 9.doublon=ACCEPTE(KO)';
  exception when unique_violation then r := r || ' | 9.doublon=refuse(23505)';
  end;

  -- 10. Options (inscription) : fonctionnalités et modèle de reçu fusionnés
  v_id := public.creer_organisation('ZZ Test options', 'zz-test-creer-org-options', v_recus, v_carte,
    '{"evenements": false, "dons": true}'::jsonb, '{"rna": "W000000000", "siren": "000000000"}'::jsonb);
  r := r || ' | 10.options modele=' || (select (modele_recu_pdf ->> 'rna') || '/' || (modele_recu_pdf ->> 'siren') from public.organisations where id = v_id);

  -- 11. Slug invalide refusé
  begin
    perform public.creer_organisation('ZZ', 'Pas Un Slug', v_recus, v_carte);
    r := r || ' | 11.slug_invalide=ACCEPTE(KO)';
  exception when invalid_parameter_value then r := r || ' | 11.slug_invalide=refuse';
  end;

  raise exception 'RESULTATS: %', r;
end;
$$;
