-- Tests de l'inscription freemium (migrations demandes_inscription.sql et
-- creer_organisation_fonctionnalites_filtrees.sql) — staging uniquement :
--   npx supabase db query --linked -f supabase/tests/demandes_inscription.sql
-- Bloc terminé par une exception : rien n'est conservé. Dépend de l'org « Association Démo
-- Staging » (compte bénévole existant, un admin, éventuellement un contributeur).
do $$
declare
  v_demo uuid; v_benevole uuid; v_admin uuid; v_contrib uuid; v_admin_email text;
  v_id uuid; v_ref uuid; v_n int; v_res jsonb; v_org uuid;
  v_ip text := repeat('1', 64); v_ip2 text := repeat('2', 64);
  v_mail text := repeat('e', 64); v_mail2 text := repeat('f', 64);
  v_demande jsonb := jsonb_build_object(
    'nom_association', 'ZZ Test inscription SQL', 'ville', 'Lyon', 'rna', 'W751234567', 'siren', null,
    'prenom', 'Camille', 'nom', 'Martin', 'email', 'boulom.nicolas+samakan-inscription-sql@gmail.com',
    'message', 'Bonjour', 'cgu_acceptees', false);
  v_recus jsonb := '[{"nom":"R1","type_cerfa":"11580","html_template":"<p>1</p>","css":""}]';
  v_carte jsonb := '{"nom":"C","html_template":"<div></div>","css":""}';
  r text := '';
begin
  select id into v_demo from public.organisations where nom = 'Association Démo Staging';
  select id into v_benevole from auth.users where email = 'benevole-' || v_demo || '@mothana.internal';
  select po.utilisateur_id into v_admin from public.profils_organisation po
    where po.organisation_id = v_demo and po.role = 'admin' order by po.created_at desc limit 1;
  select email into v_admin_email from auth.users where id = v_admin;
  select po.utilisateur_id into v_contrib from public.profils_organisation po
    where po.role = 'contributeur' order by po.created_at desc limit 1;

  -- Données de test (service_role, comme les Edge Functions) : une demande en attente, une refusée
  -- il y a 31 jours, une refusée il y a 10 jours.
  perform set_config('request.jwt.claims', json_build_object('role', 'service_role')::text, true);
  execute 'set local role service_role';

  -- 1. Soumission : nouvelle demande
  v_res := public.soumettre_demande_inscription(v_ip, v_mail, v_demande);
  r := r || '1.nouvelle=' || (v_res ->> 'cas') || '/' || (v_res ->> 'envoyer_accuse');
  v_id := (v_res ->> 'demande_id')::uuid;
  r := r || ' rna=' || (select rna from public.demandes_inscription where id = v_id)
         || ' cgu=' || coalesce((select cgu_acceptees_le::text from public.demandes_inscription where id = v_id), 'null');

  -- 2. Même adresse : déjà en attente, rien de créé
  v_res := public.soumettre_demande_inscription(v_ip2, v_mail, v_demande);
  select count(*) into v_n from public.demandes_inscription where email = v_demande ->> 'email';
  r := r || ' | 2.doublon=' || (v_res ->> 'cas') || ' lignes=' || v_n;

  -- 3. Adresse d'un compte existant (admin démo) : compte_existant, rien de créé
  v_res := public.soumettre_demande_inscription(v_ip2, v_mail2,
    v_demande || jsonb_build_object('email', upper(v_admin_email)));
  select count(*) into v_n from public.demandes_inscription where email = lower(v_admin_email);
  r := r || ' | 3.compte=' || (v_res ->> 'cas') || ' lignes=' || v_n;

  -- 4. Accusés par adresse : 3 / 24 h (v_mail a déjà servi 2 fois) → 3e oui, 4e non
  v_res := public.soumettre_demande_inscription(repeat('3', 64), v_mail, v_demande);
  r := r || ' | 4.accuse3=' || (v_res ->> 'envoyer_accuse');
  v_res := public.soumettre_demande_inscription(repeat('4', 64), v_mail, v_demande);
  r := r || ' accuse4=' || (v_res ->> 'envoyer_accuse');

  -- 5. Débit par IP : 5 / heure, la 6e est refusée (v_ip a servi 1 fois)
  for i in 1..4 loop
    perform public.soumettre_demande_inscription(v_ip, repeat('9', 63) || i::text, v_demande);
  end loop;
  v_res := public.soumettre_demande_inscription(v_ip, repeat('8', 64), v_demande);
  r := r || ' | 5.ip6=' || coalesce(v_res ->> 'reason', 'ACCEPTE(KO)');

  -- 6. Empreintes invalides refusées
  v_res := public.soumettre_demande_inscription('x', v_mail, v_demande);
  r := r || ' | 6.hash=' || (v_res ->> 'reason');

  -- 7. Contrainte RNA côté table : format invalide refusé
  begin
    perform public.soumettre_demande_inscription(repeat('5', 64), repeat('6', 64),
      v_demande || '{"email":"boulom.nicolas+samakan-inscription-sql2@gmail.com","rna":"W12"}'::jsonb);
    r := r || ' | 7.rna_invalide=ACCEPTE(KO)';
  exception when check_violation then r := r || ' | 7.rna_invalide=refuse';
  end;

  -- Demandes refusées pour la purge (date simulée)
  insert into public.demandes_inscription (nom_association, ville, prenom, nom, email, statut, traitee_le)
  values ('ZZ Test inscription vieille', 'Lyon', 'A', 'B', 'boulom.nicolas+samakan-inscription-old@gmail.com', 'refusee', now() - interval '31 days')
  returning id into v_ref;
  insert into public.demandes_inscription (nom_association, ville, prenom, nom, email, statut, traitee_le)
  values ('ZZ Test inscription récente', 'Lyon', 'A', 'B', 'boulom.nicolas+samakan-inscription-new@gmail.com', 'refusee', now() - interval '10 days');

  -- 8. Fonctionnalités filtrées à la création (jamais evenements ni credit_manuel)
  v_org := public.creer_organisation('ZZ Test inscription filtre', 'zz-test-inscription-filtre', v_recus, v_carte,
    '{"dons": true, "adherents": true, "evenements": true, "credit_manuel": true}'::jsonb, '{"rna": "W751234567"}'::jsonb);
  r := r || ' | 8.fonctionnalites=' || (select fonctionnalites_activees::text from public.organisations where id = v_org);
  execute 'reset role';

  -- 9. anon : ni lecture, ni écriture, ni exécution
  execute 'set local role anon';
  begin
    perform count(*) from public.demandes_inscription;
    r := r || ' | 9.anon_select=ACCEPTE(KO)';
  exception when insufficient_privilege then r := r || ' | 9.anon_select=refuse';
  end;
  begin
    insert into public.demandes_inscription (nom_association, ville, prenom, nom, email) values ('ZZ x', 'L', 'A', 'B', 'x@y.fr');
    r := r || ' anon_insert=ACCEPTE(KO)';
  exception when insufficient_privilege then r := r || ' anon_insert=refuse';
  end;
  begin
    perform public.soumettre_demande_inscription(v_ip, v_mail, v_demande);
    r := r || ' anon_rpc=ACCEPTE(KO)';
  exception when insufficient_privilege then r := r || ' anon_rpc=refuse';
  end;
  begin
    perform public.purger_demandes_inscription_refusees();
    r := r || ' anon_purge=ACCEPTE(KO)';
  exception when insufficient_privilege then r := r || ' anon_purge=refuse';
  end;
  execute 'reset role';

  -- 10. Session bénévole : aucune ligne visible, ni modifiable, ni supprimable ; RPC refusées
  perform set_config('request.jwt.claims', json_build_object('sub', v_benevole, 'role', 'authenticated',
    'app_metadata', json_build_object('role', 'benevole', 'organisation_id', v_demo))::text, true);
  execute 'set local role authenticated';
  select count(*) into v_n from public.demandes_inscription;
  r := r || ' | 10.benevole_select=' || v_n;
  update public.demandes_inscription set statut = 'refusee' where id = v_id;
  get diagnostics v_n = row_count;
  r := r || ' update=' || v_n;
  delete from public.demandes_inscription where id = v_id;
  get diagnostics v_n = row_count;
  r := r || ' delete=' || v_n;
  begin
    insert into public.demandes_inscription (nom_association, ville, prenom, nom, email) values ('ZZ x', 'L', 'A', 'B', 'x@y.fr');
    r := r || ' insert=ACCEPTE(KO)';
  exception when insufficient_privilege then r := r || ' insert=refuse';
  end;
  begin
    perform public.soumettre_demande_inscription(v_ip, v_mail, v_demande);
    r := r || ' rpc=ACCEPTE(KO)';
  exception when insufficient_privilege then r := r || ' rpc=refuse';
  end;
  begin
    perform public.purger_demandes_inscription_refusees();
    r := r || ' purge=ACCEPTE(KO)';
  exception when insufficient_privilege then r := r || ' purge=refuse';
  end;
  execute 'reset role';

  -- 11. Admin et contributeur d'organisation : aucune ligne visible ni modifiable
  perform set_config('request.jwt.claims', json_build_object('sub', v_admin, 'role', 'authenticated', 'app_metadata', json_build_object())::text, true);
  execute 'set local role authenticated';
  select count(*) into v_n from public.demandes_inscription;
  r := r || ' | 11.admin_select=' || v_n;
  update public.demandes_inscription set statut = 'refusee' where id = v_id;
  get diagnostics v_n = row_count;
  r := r || ' update=' || v_n;
  execute 'reset role';
  perform set_config('request.jwt.claims', json_build_object('sub', coalesce(v_contrib, v_admin), 'role', 'authenticated', 'app_metadata', json_build_object())::text, true);
  execute 'set local role authenticated';
  select count(*) into v_n from public.demandes_inscription;
  r := r || ' contributeur_select=' || v_n;
  execute 'reset role';

  -- 12. Super-admin : lit, refuse (colonnes du refus), ne modifie pas d'autre colonne, supprime
  perform set_config('request.jwt.claims', json_build_object('sub', v_admin, 'role', 'authenticated',
    'app_metadata', json_build_object('is_super_admin', true))::text, true);
  execute 'set local role authenticated';
  select count(*) into v_n from public.demandes_inscription where id = v_id;
  r := r || ' | 12.sa_select=' || v_n;
  update public.demandes_inscription set statut = 'refusee', traitee_par = v_admin, traitee_le = now() where id = v_id;
  get diagnostics v_n = row_count;
  r := r || ' sa_refus=' || v_n;
  begin
    update public.demandes_inscription set email = 'autre@exemple.fr' where id = v_id;
    r := r || ' sa_update_email=ACCEPTE(KO)';
  exception when insufficient_privilege then r := r || ' sa_update_email=refuse';
  end;
  begin
    insert into public.demandes_inscription (nom_association, ville, prenom, nom, email) values ('ZZ x', 'L', 'A', 'B', 'x@y.fr');
    r := r || ' sa_insert=ACCEPTE(KO)';
  exception when insufficient_privilege then r := r || ' sa_insert=refuse';
  end;
  delete from public.demandes_inscription where email = 'boulom.nicolas+samakan-inscription-new@gmail.com';
  get diagnostics v_n = row_count;
  r := r || ' sa_delete=' || v_n;
  execute 'reset role';

  -- 13. Purge : la refusée de 31 jours part, la demande refusée aujourd'hui reste
  perform set_config('request.jwt.claims', json_build_object('role', 'service_role')::text, true);
  execute 'set local role service_role';
  v_n := public.purger_demandes_inscription_refusees();
  r := r || ' | 13.purge=' || v_n
    || ' vieille=' || (select count(*) from public.demandes_inscription where id = v_ref)
    || ' recente=' || (select count(*) from public.demandes_inscription where id = v_id);
  execute 'reset role';

  -- 14. Tâche planifiée présente
  r := r || ' | 14.cron=' || (select count(*) from cron.job where jobname = 'purger-demandes-inscription-refusees');

  raise exception 'RESULTATS: %', r;
end;
$$;
