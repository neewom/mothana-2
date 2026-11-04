-- Tests des lots de reçus (recus_lots.sql) — staging uniquement :
--   npx supabase db query --linked -f supabase/tests/recus_lots.sql
-- Bloc terminé par une exception : rien n'est conservé (organisation, donateurs, lots créés ici).
-- Dépend de l'org « Association Démo Staging » (compte bénévole, un admin) et d'un super-admin.
-- Chaque résultat attendu est suffixé « ok » ; un « KO » signale un écart.
do $$
declare
  v_demo uuid; v_benevole uuid; v_admin uuid; v_super uuid;
  v_org uuid; v_pe uuid; v_pp uuid; v_lot uuid; v_lot2 uuid; v_ligne uuid; v_txt text; v_n int;
  r text := '';
  i int;
  -- Même liste et même ordre attendu que src/lib/recusAGenerer.test.ts (FIXTURE_ORDRE / ORDRE_ATTENDU)
  noms text[] := array['Éric','eric','Martin','MARTIN','martin','Le Gall','Le-Gall','Legall','Müller','Muller',
    'N''Diaye','Ndiaye','de la Tour','Delatour','Œuvre','Oeuvre','Zoé','Zoe','Durand','Durand','Dupont','Dupont'];
  prenoms text[] := array['Jean','Anne',null,'Paul','Luc','Yann','Yann','Yann','Hans','Hans',
    'Awa','Awa','Marie','Marie',null,null,'Zoé','Zoe','Émile','Emile','Jean','Jean'];
  civs int[] := array[1,2,5,1,2,1,1,1,4,4, 2,2,1,1,6,6,2,2,1,1,1,1];
  v_attendu text := 'de la Tour/Marie|Delatour/Marie|Dupont/Jean#01|Dupont/Jean#09|Durand/Emile|Durand/Émile|'
    || 'eric/Anne|Éric/Jean|Le Gall/Yann|Le-Gall/Yann|Legall/Yann|martin/Luc|Martin/|MARTIN/Paul|Muller/Hans|'
    || 'Müller/Hans|N''Diaye/Awa|Ndiaye/Awa|Oeuvre/|Œuvre/|Zoe/Zoe|Zoé/Zoé';
begin
  select id into v_demo from public.organisations where nom = 'Association Démo Staging';
  select id into v_benevole from auth.users where email = 'benevole-' || v_demo || '@mothana.internal';
  select po.utilisateur_id into v_admin from public.profils_organisation po
    where po.organisation_id = v_demo and po.role = 'admin' order by po.created_at desc limit 1;
  select id into v_super from auth.users where (raw_app_meta_data ->> 'is_super_admin')::boolean limit 1;

  -- Organisation temporaire complète + donateurs
  insert into public.organisations (nom, slug, adresse, code_postal, ville, modele_recu_pdf)
    values ('Test SQL lots reçus', 'test-sql-lots-recus-' || gen_random_uuid(), '1 rue', '75001', 'Paris',
      '{"rna":"W123456789","objet_social":"Test","mention_legale":"Mention"}')
    returning id into v_org;
  for i in 1..array_length(noms, 1) loop
    insert into public.personnes (nom, prenom, civilite, adresse, code_postal, ville)
      values (noms[i], prenoms[i], civs[i], 'adr', '75001', 'Paris') returning id into v_pe;
    insert into public.profils_participant (id, personne_id, organisation_id)
      values (case i when 21 then '00000000-0000-4000-8000-000000000009'::uuid
                     when 22 then '00000000-0000-4000-8000-000000000001'::uuid
                     else gen_random_uuid() end, v_pe, v_org)
      returning id into v_pp;
    insert into public.dons (profil_participant_id, organisation_id, montant, date, mode_paiement)
      values (v_pp, v_org, 10, make_date(2025, 1 + (i % 12), 1), 1);
  end loop;
  -- Écartés : fiche incomplète, famille, civilité 0, particulier sans prénom, reçu déjà émis, don hors année
  insert into public.personnes (nom, prenom, civilite) values ('Aaa sans adresse', 'X', 1) returning id into v_pe;
  insert into public.profils_participant (personne_id, organisation_id) values (v_pe, v_org) returning id into v_pp;
  insert into public.dons (profil_participant_id, organisation_id, montant, date, mode_paiement) values (v_pp, v_org, 10, '2025-03-01', 1);
  insert into public.personnes (nom, prenom, civilite, adresse, code_postal, ville) values ('Aab famille', 'X', 7, 'a', '1', 'v') returning id into v_pe;
  insert into public.profils_participant (personne_id, organisation_id) values (v_pe, v_org) returning id into v_pp;
  insert into public.dons (profil_participant_id, organisation_id, montant, date, mode_paiement) values (v_pp, v_org, 10, '2025-03-01', 1);
  insert into public.personnes (nom, prenom, civilite, adresse, code_postal, ville) values ('Aac civ0', 'X', 0, 'a', '1', 'v') returning id into v_pe;
  insert into public.profils_participant (personne_id, organisation_id) values (v_pe, v_org) returning id into v_pp;
  insert into public.dons (profil_participant_id, organisation_id, montant, date, mode_paiement) values (v_pp, v_org, 10, '2025-03-01', 1);
  insert into public.personnes (nom, prenom, civilite, adresse, code_postal, ville) values ('Aad sans prenom', '', 1, 'a', '1', 'v') returning id into v_pe;
  insert into public.profils_participant (personne_id, organisation_id) values (v_pe, v_org) returning id into v_pp;
  insert into public.dons (profil_participant_id, organisation_id, montant, date, mode_paiement) values (v_pp, v_org, 10, '2025-03-01', 1);
  insert into public.personnes (nom, prenom, civilite, adresse, code_postal, ville) values ('Aae deja emis', 'X', 1, 'a', '1', 'v') returning id into v_pe;
  insert into public.profils_participant (personne_id, organisation_id) values (v_pe, v_org) returning id into v_pp;
  insert into public.dons (profil_participant_id, organisation_id, montant, date, mode_paiement) values (v_pp, v_org, 10, '2025-03-01', 1);
  insert into public.recus_fiscaux (profil_participant_id, organisation_id, annee, montant_total) values (v_pp, v_org, 2025, 10);
  insert into public.personnes (nom, prenom, civilite, adresse, code_postal, ville) values ('Aaf hors annee', 'X', 1, 'a', '1', 'v') returning id into v_pe;
  insert into public.profils_participant (personne_id, organisation_id) values (v_pe, v_org) returning id into v_pp;
  insert into public.dons (profil_participant_id, organisation_id, montant, date, mode_paiement) values (v_pp, v_org, 10, '2024-12-31', 1);

  -- 1. Règle et ordre des reçus manquants (identiques à recusAGenerer.ts)
  select string_agg(pe.nom || '/' || coalesce(pe.prenom, '') || case when pe.nom = 'Dupont' then '#' || right(m.profil_participant_id::text, 2) else '' end, '|' order by m.rang)
    into v_txt
    from public.recus_manquants_lot(v_org, 2025) m
    join public.profils_participant pp on pp.id = m.profil_participant_id
    join public.personnes pe on pe.id = pp.personne_id;
  r := r || '1.ordre=' || case when v_txt = v_attendu then 'ok' else 'KO(' || coalesce(v_txt, 'null') || ')' end;

  update public.organisations set modele_recu_pdf = modele_recu_pdf - 'mention_legale' where id = v_org;
  select count(*) into v_n from public.recus_manquants_lot(v_org, 2025);
  r := r || ' org_incomplete=' || case when v_n = 0 then 'ok' else 'KO' end;
  update public.organisations set modele_recu_pdf = modele_recu_pdf || '{"mention_legale":"Mention"}' where id = v_org;

  -- 2. anon : refusé (aucun droit d'exécution)
  execute 'set local role anon';
  begin
    perform public.lancer_lot_recus(v_org, 2025);
    r := r || ' | 2.anon=ACCEPTE(KO)';
  exception when insufficient_privilege then r := r || ' | 2.anon=refuse ok';
  end;
  execute 'reset role';

  -- 3. Bénévole (aucun profil d'organisation) : refusé, sur son organisation comme sur une autre
  perform set_config('request.jwt.claims', json_build_object('sub', v_benevole, 'role', 'authenticated',
    'app_metadata', json_build_object('role', 'benevole', 'organisation_id', v_demo))::text, true);
  execute 'set local role authenticated';
  begin
    perform public.lancer_lot_recus(v_demo, 2025);
    r := r || ' | 3.benevole_sa_org=ACCEPTE(KO)';
  exception when insufficient_privilege then r := r || ' | 3.benevole_sa_org=refuse ok';
  end;
  begin
    perform public.lancer_lot_recus(v_org, 2025);
    r := r || ' benevole_autre=ACCEPTE(KO)';
  exception when insufficient_privilege then r := r || ' benevole_autre=refuse ok';
  end;

  -- 4. Admin d'une autre organisation : refusé ; admin de son organisation : pas de refus d'accès
  perform set_config('request.jwt.claims', json_build_object('sub', v_admin, 'role', 'authenticated', 'app_metadata', json_build_object())::text, true);
  begin
    perform public.lancer_lot_recus(v_org, 2025);
    r := r || ' | 4.admin_autre_org=ACCEPTE(KO)';
  exception when insufficient_privilege then r := r || ' | 4.admin_autre_org=refuse ok';
  end;
  -- (lot éventuellement créé sur l'org de démo annulé aussitôt par l'exception du sous-bloc)
  begin
    perform public.lancer_lot_recus(v_demo, 2025);
    raise exception 'ANNULE';
  exception
    when insufficient_privilege then r := r || ' admin_sa_org=REFUSE(KO)';
    when others then r := r || ' admin_sa_org=accepte(' || sqlerrm || ') ok';
  end;
  -- Écriture directe interdite aux clients, fonctions de traitement aussi
  begin
    insert into public.recus_lots (organisation_id, annee) values (v_demo, 2025);
    r := r || ' insert_direct=ACCEPTE(KO)';
  exception when insufficient_privilege then r := r || ' insert_direct=refuse ok';
  end;
  begin
    perform public.prendre_lot_recus(60);
    r := r || ' prendre_lot=ACCEPTE(KO)';
  exception when insufficient_privilege then r := r || ' prendre_lot=refuse ok';
  end;
  begin
    perform public.planifier_traitement_lots_recus();
    r := r || ' planifier=ACCEPTE(KO)';
  exception when insufficient_privilege then r := r || ' planifier=refuse ok';
  end;

  -- 5. Super-admin (mode Consulter) : lot créé dans l'ordre ; double lancement refusé
  perform set_config('request.jwt.claims', json_build_object('sub', v_super, 'role', 'authenticated',
    'app_metadata', json_build_object('is_super_admin', true))::text, true);
  v_lot := public.lancer_lot_recus(v_org, 2025);
  select string_agg(pe.nom || '/' || coalesce(pe.prenom, '') || case when pe.nom = 'Dupont' then '#' || right(g.profil_participant_id::text, 2) else '' end, '|' order by g.rang)
    into v_txt
    from public.recus_lot_lignes g
    join public.profils_participant pp on pp.id = g.profil_participant_id
    join public.personnes pe on pe.id = pp.personne_id
   where g.lot_id = v_lot;
  select nb_total into v_n from public.recus_lots where id = v_lot;
  r := r || ' | 5.lignes=' || case when v_txt = v_attendu and v_n = 22 then 'ok' else 'KO(' || v_n || ')' end;
  begin
    perform public.lancer_lot_recus(v_org, 2025);
    r := r || ' double=ACCEPTE(KO)';
  exception when others then r := r || ' double=' || sqlerrm || case when sqlerrm = 'LOT_DEJA_EN_COURS' then ' ok' else ' KO' end;
  end;
  -- Lecture par RLS : le super-admin voit le lot ; l'admin d'une autre organisation non
  select count(*) into v_n from public.recus_lot_lignes where lot_id = v_lot;
  r := r || ' lecture_super=' || case when v_n = 22 then 'ok' else 'KO' end;
  perform set_config('request.jwt.claims', json_build_object('sub', v_admin, 'role', 'authenticated', 'app_metadata', json_build_object())::text, true);
  select count(*) into v_n from public.recus_lots where id = v_lot;
  r := r || ' lecture_autre_org=' || case when v_n = 0 then 'ok' else 'KO' end;
  begin
    perform public.arreter_lot_recus(v_lot);
    r := r || ' arret_autre_org=ACCEPTE(KO)';
  exception when insufficient_privilege then r := r || ' arret_autre_org=refuse ok';
  end;
  perform set_config('request.jwt.claims', json_build_object('sub', v_benevole, 'role', 'authenticated',
    'app_metadata', json_build_object('role', 'benevole', 'organisation_id', v_demo))::text, true);
  begin
    perform public.arreter_lot_recus(v_lot);
    r := r || ' arret_benevole=ACCEPTE(KO)';
  exception when insufficient_privilege then r := r || ' arret_benevole=refuse ok';
  end;
  execute 'reset role';

  -- 6. Traitement (service_role) : bail exclusif, lignes par rang, reprise et tentatives
  select l.lot_id into v_lot2 from public.prendre_lot_recus(60) l where l.lot_id = v_lot;
  select count(*) into v_n from public.prendre_lot_recus(60) l where l.lot_id = v_lot;
  r := r || ' | 6.bail=' || case when v_lot2 = v_lot and v_n = 0 then 'ok' else 'KO' end;
  select s.ligne_id into v_ligne from public.ligne_suivante_lot_recus(v_lot, 60) s;
  select pe.nom || '/' || pe.prenom into v_txt from public.recus_lot_lignes g
    join public.profils_participant pp on pp.id = g.profil_participant_id join public.personnes pe on pe.id = pp.personne_id
   where g.id = v_ligne;
  r := r || ' premiere=' || case when v_txt = 'de la Tour/Marie' then 'ok' else 'KO(' || coalesce(v_txt, 'null') || ')' end;
  -- Génération simulée de la 1re ligne
  insert into public.recus_fiscaux (profil_participant_id, organisation_id, annee, montant_total)
    select g.profil_participant_id, v_org, 2025, 10 from public.recus_lot_lignes g where g.id = v_ligne;
  r := r || ' fait=' || public.terminer_ligne_lot_recus(v_ligne, 'fait');
  -- 2e ligne : erreur passagère x3 → échec à la 3e tentative ; la ligne suivante n'est servie qu'ensuite
  select s.ligne_id into v_ligne from public.ligne_suivante_lot_recus(v_lot, 60) s;
  v_txt := public.terminer_ligne_lot_recus(v_ligne, 'reessayer', 'Gotenberg');
  select s.ligne_id into v_lot2 from public.ligne_suivante_lot_recus(v_lot, 60) s;
  v_txt := v_txt || ',' || case when v_lot2 = v_ligne then 'meme' else 'AUTRE' end || ',' || public.terminer_ligne_lot_recus(v_ligne, 'reessayer', 'Gotenberg');
  select s.ligne_id into v_lot2 from public.ligne_suivante_lot_recus(v_lot, 60) s;
  v_txt := v_txt || ',' || public.terminer_ligne_lot_recus(v_ligne, 'reessayer', 'Gotenberg');
  r := r || ' reessais=' || v_txt || case when v_txt = 'a_faire,meme,a_faire,echec' then ' ok' else ' KO' end;
  select nb_faits || '/' || nb_echecs into v_txt from public.recus_lots where id = v_lot;
  r := r || ' compteurs=' || v_txt || case when v_txt = '1/1' then ' ok' else ' KO' end;

  -- 7. Arrêt (super-admin) : plus aucune ligne servie ; relance : reprend les manquants
  perform public.liberer_lot_recus(v_lot);
  perform set_config('request.jwt.claims', json_build_object('sub', v_super, 'role', 'authenticated',
    'app_metadata', json_build_object('is_super_admin', true))::text, true);
  execute 'set local role authenticated';
  perform public.arreter_lot_recus(v_lot);
  execute 'reset role';
  select count(*) into v_n from public.ligne_suivante_lot_recus(v_lot, 60);
  select statut into v_txt from public.recus_lots where id = v_lot;
  r := r || ' | 7.arret=' || v_txt || case when v_n = 0 and v_txt = 'arrete' then ' ok' else ' KO' end;
  execute 'set local role authenticated';
  v_lot2 := public.lancer_lot_recus(v_org, 2025);
  execute 'reset role';
  select nb_total into v_n from public.recus_lots where id = v_lot2;
  select pe.nom || '/' || pe.prenom into v_txt from public.recus_lot_lignes g
    join public.profils_participant pp on pp.id = g.profil_participant_id join public.personnes pe on pe.id = pp.personne_id
   where g.lot_id = v_lot2 and g.rang = 1;
  -- 21 manquants : la 1re ligne a son reçu ; la ligne en échec est reproposée
  r := r || ' relance=' || v_n || ',' || v_txt || case when v_n = 21 and v_txt = 'Delatour/Marie' then ' ok' else ' KO' end;

  -- 8. Fin de lot : toutes les lignes traitées → « termine » ; la tâche planifiée ne voit plus rien
  update public.recus_lot_lignes set statut = 'fait' where lot_id = v_lot2;
  select count(*) into v_n from public.ligne_suivante_lot_recus(v_lot2, 60);
  select statut into v_txt from public.recus_lots where id = v_lot2;
  r := r || ' | 8.termine=' || v_txt || case when v_n = 0 and v_txt = 'termine' then ' ok' else ' KO' end;

  raise exception 'RESULTATS: %', r;
end;
$$;
