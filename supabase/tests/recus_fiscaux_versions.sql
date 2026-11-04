-- Tests des versions de reçus fiscaux (recus_fiscaux_versions.sql) — staging uniquement :
--   npx supabase db query --linked -f supabase/tests/recus_fiscaux_versions.sql
-- Bloc terminé par une exception : rien n'est conservé. Dépend de l'org « Association Démo Staging »
-- (au moins deux participants, un admin, le compte bénévole) et d'une seconde organisation avec un admin.
-- Année 1900 pour ne croiser aucun reçu réel. Chaque résultat attendu est indiqué ; « KO » signale un échec.
do $$
declare
  v_demo uuid; v_autre_org uuid; v_p1 uuid; v_p2 uuid; v_admin uuid; v_admin_autre uuid;
  v_benevole uuid; v_super uuid; v_recu uuid; v_recu2 uuid; v_version_id uuid;
  v_num text; v_fichier text; n int; r text := '';
begin
  select id into v_demo from public.organisations where nom = 'Association Démo Staging';
  select id into v_p1 from public.profils_participant where organisation_id = v_demo order by id limit 1;
  select id into v_p2 from public.profils_participant where organisation_id = v_demo and id <> v_p1 order by id limit 1;
  select po.utilisateur_id into v_admin from public.profils_organisation po
    where po.organisation_id = v_demo and po.role = 'admin' order by po.created_at desc limit 1;
  select po.organisation_id, po.utilisateur_id into v_autre_org, v_admin_autre from public.profils_organisation po
    where po.organisation_id <> v_demo and po.role = 'admin' order by po.created_at limit 1;
  select id into v_benevole from auth.users where email = 'benevole-' || v_demo || '@mothana.internal';
  select id into v_super from auth.users where (raw_app_meta_data ->> 'is_super_admin')::boolean limit 1;

  execute 'set local role service_role';

  -- 1. Première génération : fiche + version 1
  select recu_id into v_recu from public.enregistrer_version_recu(v_p1, v_demo, 1900, 1, 100,
    'test/1900/1900-001.pdf', '1900-001', '11580', null, '{"nom":"A"}', '{"nom":"Org"}', v_admin);
  select count(*) into n from public.recus_fiscaux_versions where recu_id = v_recu;
  r := r || '1.generation_v1=' || (n = 1);

  -- 2. Régénération : version 2, la fiche pointe sur le nouveau fichier, numéro conservé
  perform public.enregistrer_version_recu(v_p1, v_demo, 1900, 2, 250,
    'test/1900/1900-001-v2.pdf', '1900-001', '11580', null, '{"nom":"B"}', '{"nom":"Org"}', v_admin);
  select count(*) into n from public.recus_fiscaux_versions where recu_id = v_recu;
  select numero_ordre, fichier_url into v_num, v_fichier from public.recus_fiscaux where id = v_recu;
  r := r || ' | 2.regeneration_v2=' || (n = 2 and v_num = '1900-001' and v_fichier = 'test/1900/1900-001-v2.pdf')
    || ' v1_intacte=' || exists (select 1 from public.recus_fiscaux_versions where recu_id = v_recu and version = 1
      and fichier_url = 'test/1900/1900-001.pdf' and montant_total = 100 and snapshot_donateur ->> 'nom' = 'A');

  -- 3. Version déjà prise (génération simultanée) : refusée
  begin
    perform public.enregistrer_version_recu(v_p1, v_demo, 1900, 2, 250,
      'test/1900/1900-001-v2b.pdf', '1900-001', '11580', null, null, null, v_admin);
    r := r || ' | 3.version_doublon=ACCEPTE(KO)';
  exception when unique_violation then r := r || ' | 3.version_doublon=refuse';
  end;

  -- 4. Date d'envoi par email : seule colonne modifiable
  select id into v_version_id from public.recus_fiscaux_versions where recu_id = v_recu and version = 2;
  begin
    update public.recus_fiscaux_versions set email_envoye_le = now() where id = v_version_id;
    r := r || ' | 4.email_envoye_le=accepte';
  exception when check_violation then r := r || ' | 4.email_envoye_le=REFUSE(KO)';
  end;

  -- 5. Modification d'une version (fichier, montant) : refusée, même en service_role
  begin
    update public.recus_fiscaux_versions set fichier_url = 'test/autre.pdf' where id = v_version_id;
    r := r || ' | 5.update_fichier=ACCEPTE(KO)';
  exception when check_violation then r := r || ' | 5.update_fichier=refuse';
  end;
  begin
    update public.recus_fiscaux_versions set montant_total = 1, email_envoye_le = null where id = v_version_id;
    r := r || ' | 5b.update_montant=ACCEPTE(KO)';
  exception when check_violation then r := r || ' | 5b.update_montant=refuse';
  end;

  -- 6. Suppression d'une version : refusée
  begin
    delete from public.recus_fiscaux_versions where id = v_version_id;
    r := r || ' | 6.delete_version=ACCEPTE(KO)';
  exception when check_violation then r := r || ' | 6.delete_version=refuse';
  end;

  -- 7. Suppression du reçu (cascade vers les versions) : refusée
  begin
    delete from public.recus_fiscaux where id = v_recu;
    r := r || ' | 7.delete_recu_cascade=ACCEPTE(KO)';
  exception when check_violation then r := r || ' | 7.delete_recu_cascade=refuse';
  end;

  -- 8. TRUNCATE : refusé
  begin
    truncate public.recus_fiscaux_versions cascade;
    r := r || ' | 8.truncate=ACCEPTE(KO)';
  exception when check_violation then r := r || ' | 8.truncate=refuse';
  end;

  -- 9. Reçu antérieur aux versions (sans ligne de version) : la régénération crée v1 (fichier actuel) + v2.
  -- Email envoyé avant la génération du fichier actuel : la v1 reprise n'est pas marquée envoyée.
  insert into public.recus_fiscaux (profil_participant_id, organisation_id, annee, montant_total, fichier_url,
      date_generation, numero_ordre, type_cerfa, email_envoye_at)
    values (v_p2, v_demo, 1900, 40, 'test/1900/1900-002.pdf', now() - interval '1 day', '1900-002', '11580',
      now() - interval '2 days')
    returning id into v_recu2;
  perform public.enregistrer_version_recu(v_p2, v_demo, 1900, 2, 45,
    'test/1900/1900-002-v2.pdf', '1900-002', '11580', null, null, null, v_admin);
  r := r || ' | 9.reprise_legacy=' || (
    (select string_agg(version || ':' || fichier_url, ',' order by version) from public.recus_fiscaux_versions where recu_id = v_recu2)
    = '1:test/1900/1900-002.pdf,2:test/1900/1900-002-v2.pdf')
    || ' v1_non_envoyee=' || exists (select 1 from public.recus_fiscaux_versions where recu_id = v_recu2 and version = 1
      and email_envoye_le is null);

  -- 10. Session bénévole : rien visible, aucune écriture
  perform set_config('request.jwt.claims', json_build_object('sub', v_benevole, 'role', 'authenticated',
    'app_metadata', json_build_object('role', 'benevole', 'organisation_id', v_demo))::text, true);
  execute 'set local role authenticated';
  r := r || ' | 10.benevole_lecture=' || (select count(*) from public.recus_fiscaux_versions where recu_id = v_recu);
  begin
    perform public.enregistrer_version_recu(v_p1, v_demo, 1900, 3, 1, 'test/x.pdf', '1900-001', '11580', null, null, null, v_benevole);
    r := r || ' benevole_rpc=ACCEPTE(KO)';
  exception when insufficient_privilege then r := r || ' benevole_rpc=refuse';
  end;
  begin
    insert into public.recus_fiscaux_versions (recu_id, organisation_id, version, fichier_url, montant_total)
      values (v_recu, v_demo, 9, 'test/x.pdf', 1);
    r := r || ' benevole_insert=ACCEPTE(KO)';
  exception when insufficient_privilege then r := r || ' benevole_insert=refuse';
  end;

  -- 11. Admin de l'organisation : lecture des 2 versions, aucune écriture
  perform set_config('request.jwt.claims', json_build_object('sub', v_admin, 'role', 'authenticated', 'app_metadata', json_build_object())::text, true);
  r := r || ' | 11.admin_lecture=' || (select count(*) from public.recus_fiscaux_versions where recu_id = v_recu);
  begin
    update public.recus_fiscaux_versions set email_envoye_le = now() where recu_id = v_recu;
    r := r || ' admin_update=ACCEPTE(KO)';
  exception when insufficient_privilege then r := r || ' admin_update=refuse';
  end;
  begin
    delete from public.recus_fiscaux_versions where recu_id = v_recu;
    r := r || ' admin_delete=ACCEPTE(KO)';
  exception when insufficient_privilege then r := r || ' admin_delete=refuse';
  end;
  begin
    perform public.enregistrer_version_recu(v_p1, v_demo, 1900, 3, 1, 'test/x.pdf', '1900-001', '11580', null, null, null, v_admin);
    r := r || ' admin_rpc=ACCEPTE(KO)';
  exception when insufficient_privilege then r := r || ' admin_rpc=refuse';
  end;

  -- 12. Admin d'une autre organisation : rien visible
  perform set_config('request.jwt.claims', json_build_object('sub', v_admin_autre, 'role', 'authenticated', 'app_metadata', json_build_object())::text, true);
  r := r || ' | 12.autre_org_lecture=' || (select count(*) from public.recus_fiscaux_versions where recu_id = v_recu);

  -- 13. Super-admin : lecture (bypass), aucune suppression
  perform set_config('request.jwt.claims', json_build_object('sub', v_super, 'role', 'authenticated',
    'app_metadata', json_build_object('is_super_admin', true))::text, true);
  r := r || ' | 13.super_lecture=' || (select count(*) from public.recus_fiscaux_versions where recu_id = v_recu);
  begin
    delete from public.recus_fiscaux_versions where recu_id = v_recu;
    r := r || ' super_delete=ACCEPTE(KO)';
  exception when insufficient_privilege then r := r || ' super_delete=refuse';
  end;

  raise exception 'RESULTATS: %', r;
end;
$$;
