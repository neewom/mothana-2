-- Tests de campagnes_courrier_detail.sql — staging uniquement :
--   npx supabase db query --linked -f supabase/tests/campagnes_courrier_detail.sql
-- Bloc terminé par une exception : rien n'est conservé (adhérent et campagne de test compris).
-- Dépend de l'org « Association Démo Staging » (compte bénévole existant, un admin, une
-- activité) et d'un admin d'une autre organisation.
do $$
declare
  v_demo uuid; v_benevole uuid; v_admin uuid; v_admin_autre uuid; v_activite uuid;
  v_adherent uuid; v_campagne uuid; v_n int; v_notes text; r text := '';
begin
  select id into v_demo from public.organisations where nom = 'Association Démo Staging';
  select id into v_benevole from auth.users where email = 'benevole-' || v_demo || '@mothana.internal';
  select po.utilisateur_id into v_admin from public.profils_organisation po
    where po.organisation_id = v_demo and po.role = 'admin' order by po.created_at desc limit 1;
  select po.utilisateur_id into v_admin_autre from public.profils_organisation po
    where po.organisation_id <> v_demo and po.role = 'admin' order by po.created_at desc limit 1;
  select id into v_activite from public.activites where organisation_id = v_demo limit 1;

  -- Données de test (service role, avant tout changement de rôle).
  insert into public.adherents (organisation_id, nom, prenom, adresse, code_postal, ville)
    values (v_demo, 'ZZ Test courrier', 'Détail', '1 rue du Test', '75000', 'Paris')
    returning id into v_adherent;
  insert into public.campagnes_courrier (organisation_id, activite_id, selection_label, nombre_destinataires, nombre_exclus, detail_enregistre)
    values (v_demo, v_activite, 'Tous sauf archivés', 1, 0, true)
    returning id into v_campagne;
  insert into public.campagnes_courrier_destinataires (campagne_id, organisation_id, adherent_id, nom, adresse, statut)
    values (v_campagne, v_demo, v_adherent, 'Détail ZZ Test courrier', '1 rue du Test, 75000 Paris', 'genere');

  -- 0. Cohérence statut / raison ; valeur par défaut des lignes existantes
  begin
    insert into public.campagnes_courrier_destinataires (campagne_id, organisation_id, adherent_id, nom, statut)
      values (v_campagne, v_demo, v_adherent, 'x', 'exclu');
    r := r || '0.exclu_sans_raison=ACCEPTE(KO)';
  exception when check_violation then r := r || '0.exclu_sans_raison=refuse';
  end;
  begin
    insert into public.campagnes_courrier_destinataires (campagne_id, organisation_id, adherent_id, nom, statut, raison_exclusion)
      values (v_campagne, v_demo, v_adherent, 'x', 'genere', 'adresse_incomplete');
    r := r || ' genere_avec_raison=ACCEPTE(KO)';
  exception when check_violation then r := r || ' genere_avec_raison=refuse';
  end;
  r := r || ' defaut_detail_enregistre=' || (select column_default from information_schema.columns
    where table_schema = 'public' and table_name = 'campagnes_courrier' and column_name = 'detail_enregistre');

  -- 1. anon : ni exécution des RPC ni lecture de la table ; aucune écriture client
  r := r || ' | 1.anon_execute=' || has_function_privilege('anon', 'public.modifier_note_campagne_courrier(uuid, text)', 'execute')
         || ' anon_select=' || has_table_privilege('anon', 'public.campagnes_courrier_destinataires', 'select')
         || ' anon_recherche=' || has_function_privilege('anon', 'public.rechercher_destinataires_campagne_courrier(uuid, text, text, int, int)', 'execute')
         || ' auth_insert=' || has_table_privilege('authenticated', 'public.campagnes_courrier_destinataires', 'insert');

  -- 2. Session bénévole (aucun profil d'organisation) : RPC refusée, table invisible
  perform set_config('request.jwt.claims', json_build_object('sub', v_benevole, 'role', 'authenticated',
    'app_metadata', json_build_object('role', 'benevole', 'organisation_id', v_demo))::text, true);
  execute 'set local role authenticated';
  begin
    perform public.modifier_note_campagne_courrier(v_campagne, 'bénévole');
    r := r || ' | 2.benevole_note=ACCEPTE(KO)';
  exception when insufficient_privilege then r := r || ' | 2.benevole_note=refuse';
  end;
  select count(*) into v_n from public.campagnes_courrier_destinataires where campagne_id = v_campagne;
  r := r || ' benevole_lignes_visibles=' || v_n;
  select count(*) into v_n from public.rechercher_destinataires_campagne_courrier(v_campagne, 'genere');
  r := r || ' benevole_recherche=' || v_n;

  -- 3. Session vendeur (compte technique, sans profil) : refusée
  perform set_config('request.jwt.claims', json_build_object('sub', gen_random_uuid(), 'role', 'authenticated',
    'app_metadata', json_build_object('role', 'vendeur', 'organisation_id', v_demo))::text, true);
  begin
    perform public.modifier_note_campagne_courrier(v_campagne, 'vendeur');
    r := r || ' | 3.vendeur_note=ACCEPTE(KO)';
  exception when insufficient_privilege then r := r || ' | 3.vendeur_note=refuse';
  end;

  -- 4. Admin d'une autre organisation : refusé, lignes invisibles
  perform set_config('request.jwt.claims', json_build_object('sub', v_admin_autre, 'role', 'authenticated', 'app_metadata', json_build_object())::text, true);
  begin
    perform public.modifier_note_campagne_courrier(v_campagne, 'autre org');
    r := r || ' | 4.autre_org_note=ACCEPTE(KO)';
  exception when insufficient_privilege then r := r || ' | 4.autre_org_note=refuse';
  end;
  select count(*) into v_n from public.campagnes_courrier_destinataires where campagne_id = v_campagne;
  r := r || ' autre_org_lignes_visibles=' || v_n;
  select count(*) into v_n from public.rechercher_destinataires_campagne_courrier(v_campagne, 'genere', 'detail');
  r := r || ' autre_org_recherche=' || v_n;

  -- 5. Admin de l'organisation : note enregistrée (espaces retirés), lignes visibles
  perform set_config('request.jwt.claims', json_build_object('sub', v_admin, 'role', 'authenticated', 'app_metadata', json_build_object())::text, true);
  perform public.modifier_note_campagne_courrier(v_campagne, '  Relance AG  ');
  select notes into v_notes from public.campagnes_courrier where id = v_campagne;
  select count(*) into v_n from public.campagnes_courrier_destinataires where campagne_id = v_campagne;
  r := r || ' | 5.admin_note=' || coalesce(v_notes, 'NULL') || ' admin_lignes_visibles=' || v_n;
  -- Recherche sans accents ni casse sur le nom et l'adresse, chaque mot doit figurer, ignorée sous 2 caractères
  r := r || ' recherche_detail_zz=' || (select count(*) from public.rechercher_destinataires_campagne_courrier(v_campagne, 'genere', 'detail ZZ'))
         || ' recherche_ville=' || (select count(*) from public.rechercher_destinataires_campagne_courrier(v_campagne, 'genere', 'paris détail'))
         || ' recherche_absent=' || (select count(*) from public.rechercher_destinataires_campagne_courrier(v_campagne, 'genere', 'detail absent'))
         || ' recherche_1car=' || (select count(*) from public.rechercher_destinataires_campagne_courrier(v_campagne, 'genere', 'q'))
         || ' recherche_joker=' || (select count(*) from public.rechercher_destinataires_campagne_courrier(v_campagne, 'genere', '%_'))
         || ' total=' || (select max(total_count) from public.rechercher_destinataires_campagne_courrier(v_campagne, 'genere'))
         || ' onglet_exclu=' || (select count(*) from public.rechercher_destinataires_campagne_courrier(v_campagne, 'exclu'));
  begin
    update public.campagnes_courrier set notes = 'direct' where id = v_campagne;
    get diagnostics v_n = row_count;
    r := r || ' admin_update_direct_lignes=' || v_n;
  exception when insufficient_privilege then r := r || ' admin_update_direct=refuse';
  end;
  begin
    perform public.modifier_note_campagne_courrier(v_campagne, repeat('x', 5001));
    r := r || ' trop_longue=ACCEPTE(KO)';
  exception when others then r := r || ' trop_longue=' || sqlerrm;
  end;

  -- 6. Super-admin (mode Consulter) : autorisé ; note vide → null
  perform set_config('request.jwt.claims', json_build_object('sub', gen_random_uuid(), 'role', 'authenticated',
    'app_metadata', json_build_object('is_super_admin', true))::text, true);
  perform public.modifier_note_campagne_courrier(v_campagne, '   ');
  select notes into v_notes from public.campagnes_courrier where id = v_campagne;
  select count(*) into v_n from public.campagnes_courrier_destinataires where campagne_id = v_campagne;
  r := r || ' | 6.super_admin_note_videe=' || coalesce(v_notes, 'NULL') || ' super_admin_lignes_visibles=' || v_n;

  -- 7. Suppression de l'adhérent : sa ligne disparaît, compteurs inchangés
  execute 'reset role';
  delete from public.adherents where id = v_adherent;
  select count(*) into v_n from public.campagnes_courrier_destinataires where campagne_id = v_campagne;
  r := r || ' | 7.lignes_apres_suppression=' || v_n
         || ' compteur=' || (select nombre_destinataires from public.campagnes_courrier where id = v_campagne);

  raise exception 'RESULTATS: %', r;
end;
$$;
