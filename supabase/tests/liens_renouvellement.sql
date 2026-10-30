-- Tests de liens_renouvellement (liens_renouvellement.sql) — staging uniquement :
--   npx supabase db query --linked -f supabase/tests/liens_renouvellement.sql
-- Bloc terminé par une exception : rien n'est conservé. Dépend de l'org « Association Démo
-- Staging » (compte bénévole, un admin, au moins un adhérent) et d'une seconde organisation.
do $$
declare
  v_demo uuid; v_autre uuid; v_benevole uuid; v_admin uuid; v_super uuid; v_adh uuid; v_adh_autre uuid;
  v_l1 uuid; v_l2 uuid; v_l3 uuid; n int; r text := '';
begin
  select id into v_demo from public.organisations where nom = 'Association Démo Staging';
  select organisation_id into v_autre from public.adherents where organisation_id <> v_demo limit 1;
  select id into v_benevole from auth.users where email = 'benevole-' || v_demo || '@mothana.internal';
  select po.utilisateur_id into v_admin from public.profils_organisation po
    where po.organisation_id = v_demo and po.role = 'admin' order by po.created_at desc limit 1;
  select id into v_super from auth.users where (raw_app_meta_data ->> 'is_super_admin')::boolean limit 1;
  select id into v_adh from public.adherents where organisation_id = v_demo order by created_at limit 1;
  select id into v_adh_autre from public.adherents where organisation_id = v_autre limit 1;

  -- Données (service) : deux liens pour l'adhérent démo
  insert into public.liens_renouvellement (organisation_id, adherent_id, secret_hash)
    values (v_demo, v_adh, repeat('a', 64)) returning id into v_l1;
  insert into public.liens_renouvellement (organisation_id, adherent_id, secret_hash)
    values (v_demo, v_adh, repeat('b', 64)) returning id into v_l2;

  -- 1. Expiration par défaut à 90 jours, empreinte hex obligatoire
  r := r || '1.expire_90j=' || ((select expire_le - cree_le from public.liens_renouvellement where id = v_l1) = interval '90 days');
  begin
    insert into public.liens_renouvellement (organisation_id, adherent_id, secret_hash) values (v_demo, v_adh, 'secret-en-clair');
    r := r || ' hash_non_hex=ACCEPTE(KO)';
  exception when check_violation then r := r || ' hash_non_hex=refuse';
  end;

  -- 2. Adhérent d'une autre organisation : refusé
  if v_adh_autre is not null then
    begin
      insert into public.liens_renouvellement (organisation_id, adherent_id, secret_hash) values (v_demo, v_adh_autre, repeat('c', 64));
      r := r || ' | 2.adherent_hors_org=ACCEPTE(KO)';
    exception when check_violation then r := r || ' | 2.adherent_hors_org=refuse';
    end;
  else
    r := r || ' | 2.adherent_hors_org=NON_TESTE';
  end if;

  -- 3. remplacer : révoque l'ancien lien actif, garde le nouveau
  r := r || ' | 3.remplacer=' || public.remplacer_liens_renouvellement(array[v_l2]);
  r := r || ' l1_revoque=' || ((select revoque_le from public.liens_renouvellement where id = v_l1) is not null);
  r := r || ' l2_actif=' || ((select revoque_le from public.liens_renouvellement where id = v_l2) is null);

  -- 4. revoquer : annule un lot non envoyé
  insert into public.liens_renouvellement (organisation_id, adherent_id, secret_hash)
    values (v_demo, v_adh, repeat('d', 64)) returning id into v_l3;
  r := r || ' | 4.revoquer=' || public.revoquer_liens_renouvellement(array[v_l3]);
  r := r || ' l2_toujours_actif=' || ((select revoque_le from public.liens_renouvellement where id = v_l2) is null);

  -- 5. Session bénévole : ni lecture, ni écriture, ni RPC
  perform set_config('request.jwt.claims', json_build_object('sub', v_benevole, 'role', 'authenticated',
    'app_metadata', json_build_object('role', 'benevole', 'organisation_id', v_demo))::text, true);
  execute 'set local role authenticated';
  select count(*) into n from public.liens_renouvellement;
  r := r || ' | 5.benevole_lecture=' || n;
  begin
    insert into public.liens_renouvellement (organisation_id, adherent_id, secret_hash) values (v_demo, v_adh, repeat('e', 64));
    r := r || ' benevole_insert=ACCEPTE(KO)';
  exception when insufficient_privilege then r := r || ' benevole_insert=refuse';
  end;
  update public.liens_renouvellement set revoque_le = null where organisation_id = v_demo;
  get diagnostics n = row_count;
  r := r || ' benevole_update=' || n;
  begin
    perform public.remplacer_liens_renouvellement(array[v_l2]);
    r := r || ' benevole_remplacer=ACCEPTE(KO)';
  exception when insufficient_privilege then r := r || ' benevole_remplacer=refuse';
  end;
  begin
    perform public.revoquer_liens_renouvellement(array[v_l2]);
    r := r || ' benevole_revoquer=ACCEPTE(KO)';
  exception when insufficient_privilege then r := r || ' benevole_revoquer=refuse';
  end;
  execute 'reset role';

  -- 6. Session anonyme : aucun accès
  perform set_config('request.jwt.claims', json_build_object('role', 'anon')::text, true);
  execute 'set local role anon';
  begin
    perform 1 from public.liens_renouvellement limit 1;
    r := r || ' | 6.anon_lecture=ACCEPTE(KO)';
  exception when insufficient_privilege then r := r || ' | 6.anon_lecture=refuse';
  end;
  execute 'reset role';

  -- 7. Admin de l'organisation : lit les liens de son organisation, rien d'une autre
  perform set_config('request.jwt.claims', json_build_object('sub', v_admin, 'role', 'authenticated', 'app_metadata', json_build_object())::text, true);
  execute 'set local role authenticated';
  r := r || ' | 7.admin_lecture=' || (select count(*) from public.liens_renouvellement where id in (v_l1, v_l2, v_l3));
  r := r || ' admin_autre_org=' || (select count(*) from public.liens_renouvellement where organisation_id <> v_demo);
  begin
    insert into public.liens_renouvellement (organisation_id, adherent_id, secret_hash) values (v_autre, coalesce(v_adh_autre, v_adh), repeat('f', 64));
    r := r || ' admin_insert_autre_org=ACCEPTE(KO)';
  exception when insufficient_privilege or check_violation then r := r || ' admin_insert_autre_org=refuse';
  end;
  execute 'reset role';

  -- 8. Super-admin : bypass (lecture et mise à jour)
  perform set_config('request.jwt.claims', json_build_object('sub', v_super, 'role', 'authenticated',
    'app_metadata', json_build_object('is_super_admin', true))::text, true);
  execute 'set local role authenticated';
  r := r || ' | 8.super_lecture=' || (select count(*) from public.liens_renouvellement where id in (v_l1, v_l2, v_l3));
  update public.liens_renouvellement set utilise_le = now() where id = v_l2;
  get diagnostics n = row_count;
  r := r || ' super_update=' || n;
  execute 'reset role';

  raise exception 'RESULTATS: %', r;
end;
$$;
