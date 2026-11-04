-- Tests des lots d'envoi de reçus (recus_lots_envoi.sql) — staging uniquement :
--   npx supabase db query --linked -f supabase/tests/recus_lots_envoi.sql
-- Bloc terminé par une exception : rien n'est conservé (organisation, donateurs, reçus, lots créés ici).
-- Aucun email : seules les fonctions SQL sont appelées. Dépend de l'org « Association Démo Staging »
-- (compte bénévole, un admin) et d'un super-admin. Chaque résultat attendu est suffixé « ok ».
do $$
declare
  v_demo uuid; v_benevole uuid; v_admin uuid; v_super uuid;
  v_org uuid; v_pe uuid; v_pp uuid; v_recu uuid; v_version uuid; v_lot uuid; v_lot2 uuid; v_gen uuid;
  v_ligne uuid; v_txt text; v_n int; v_j jsonb; v_t timestamptz;
  r text := '';
  i int;
begin
  select id into v_demo from public.organisations where nom = 'Association Démo Staging';
  select id into v_benevole from auth.users where email = 'benevole-' || v_demo || '@mothana.internal';
  select po.utilisateur_id into v_admin from public.profils_organisation po
    where po.organisation_id = v_demo and po.role = 'admin' order by po.created_at desc limit 1;
  select id into v_super from auth.users where (raw_app_meta_data ->> 'is_super_admin')::boolean limit 1;

  insert into public.organisations (nom, slug, adresse, code_postal, ville, modele_recu_pdf)
    values ('Test SQL lots envoi', 'test-sql-lots-envoi-' || gen_random_uuid(), '1 rue', '75001', 'Paris',
      '{"rna":"W123456789","objet_social":"Test","mention_legale":"Mention"}')
    returning id into v_org;

  -- Donateurs avec un reçu 2025 (version 1) : 5 à envoyer (D1..D5), puis les cas exclus ou écartés.
  -- email | invalide | version envoyée
  for i in 1..10 loop
    insert into public.personnes (nom, prenom, civilite, adresse, code_postal, ville, email)
      values ('D' || i, 'P', 1, 'a', '1', 'v',
        case i when 6 then null when 7 then 'pas-un-email' else 'd' || i || '@example.invalid' end)
      returning id into v_pe;
    insert into public.profils_participant (personne_id, organisation_id, email_invalide_at)
      values (v_pe, v_org, case when i = 8 then now() - interval '2 days' end)
      returning id into v_pp;
    insert into public.recus_fiscaux (profil_participant_id, organisation_id, annee, montant_total, fichier_url, date_generation)
      values (v_pp, v_org, 2025, 10, 'test/' || i || '.pdf', now() - interval '1 hour') returning id into v_recu;
    insert into public.recus_fiscaux_versions (recu_id, organisation_id, version, fichier_url, montant_total, genere_le, email_envoye_le)
      values (v_recu, v_org, 1, 'test/' || i || '.pdf', 10, now() - interval '1 hour',
        case when i = 9 then now() - interval '3 days' end);
    -- D10 : version 1 envoyée, version 2 (régénération) non envoyée → à envoyer
    if i = 10 then
      update public.recus_fiscaux_versions set email_envoye_le = now() - interval '3 days' where recu_id = v_recu;
      insert into public.recus_fiscaux_versions (recu_id, organisation_id, version, fichier_url, montant_total, genere_le)
        values (v_recu, v_org, 2, 'test/10-v2.pdf', 10, now() - interval '30 minutes');
    end if;
  end loop;

  -- 1. Règle : à envoyer = dernière version non envoyée ; exclus avec raison
  select string_agg(e.nom || ':' || coalesce(e.raison, '-'), '|' order by e.rang) into v_txt
    from public.recus_envoi_lot(v_org, 2025) e;
  r := r || '1.regle=' || case when v_txt =
    'D1:-|D10:-|D2:-|D3:-|D4:-|D5:-|D6:Aucune adresse email|D7:Adresse email au format invalide|D8:Email invalide : un envoi précédent n''a pas pu être délivré (le '
      || to_char((now() - interval '2 days') at time zone 'Europe/Paris', 'DD/MM/YYYY') || ')'
    then 'ok' else 'KO(' || coalesce(v_txt, 'null') || ')' end;

  -- 2. anon : refusé
  execute 'set local role anon';
  begin
    perform public.lancer_lot_envoi_recus(v_org, 2025);
    r := r || ' | 2.anon_lancer=ACCEPTE(KO)';
  exception when insufficient_privilege then r := r || ' | 2.anon_lancer=refuse ok';
  end;
  begin
    perform public.recapitulatif_envoi_lot_recus(v_org, 2025);
    r := r || ' anon_recap=ACCEPTE(KO)';
  exception when insufficient_privilege then r := r || ' anon_recap=refuse ok';
  end;
  execute 'reset role';

  -- 3. Bénévole : refusé (sa propre organisation et une autre)
  perform set_config('request.jwt.claims', json_build_object('sub', v_benevole, 'role', 'authenticated',
    'app_metadata', json_build_object('role', 'benevole', 'organisation_id', v_demo))::text, true);
  execute 'set local role authenticated';
  begin
    perform public.lancer_lot_envoi_recus(v_demo, 2025);
    r := r || ' | 3.benevole_lancer=ACCEPTE(KO)';
  exception when insufficient_privilege then r := r || ' | 3.benevole_lancer=refuse ok';
  end;
  begin
    perform public.recapitulatif_envoi_lot_recus(v_demo, 2025);
    r := r || ' benevole_recap=ACCEPTE(KO)';
  exception when insufficient_privilege then r := r || ' benevole_recap=refuse ok';
  end;
  begin
    perform public.lancer_lot_envoi_recus(v_org, 2025);
    r := r || ' benevole_autre=ACCEPTE(KO)';
  exception when insufficient_privilege then r := r || ' benevole_autre=refuse ok';
  end;

  -- 4. Admin d'une autre organisation : refusé ; fonctions de traitement refusées aux clients
  perform set_config('request.jwt.claims', json_build_object('sub', v_admin, 'role', 'authenticated', 'app_metadata', json_build_object())::text, true);
  begin
    perform public.lancer_lot_envoi_recus(v_org, 2025);
    r := r || ' | 4.admin_autre_lancer=ACCEPTE(KO)';
  exception when insufficient_privilege then r := r || ' | 4.admin_autre_lancer=refuse ok';
  end;
  begin
    perform public.recapitulatif_envoi_lot_recus(v_org, 2025);
    r := r || ' admin_autre_recap=ACCEPTE(KO)';
  exception when insufficient_privilege then r := r || ' admin_autre_recap=refuse ok';
  end;
  begin
    perform public.recapitulatif_envoi_lot_recus(v_demo, 2025);
    r := r || ' admin_sa_org_recap=accepte ok';
  exception when insufficient_privilege then r := r || ' admin_sa_org_recap=REFUSE(KO)';
  end;
  begin
    perform public.budget_envoi_lot_recus(gen_random_uuid());
    r := r || ' budget=ACCEPTE(KO)';
  exception when insufficient_privilege then r := r || ' budget=refuse ok';
  end;
  begin
    perform * from public.recus_envoi_lot(v_org, 2025);
    r := r || ' recus_envoi_lot=ACCEPTE(KO)';
  exception when insufficient_privilege then r := r || ' recus_envoi_lot=refuse ok';
  end;

  -- 5. Super-admin : récapitulatif, génération en cours bloquante, lancement, double lancement
  perform set_config('request.jwt.claims', json_build_object('sub', v_super, 'role', 'authenticated',
    'app_metadata', json_build_object('is_super_admin', true))::text, true);
  v_j := public.recapitulatif_envoi_lot_recus(v_org, 2025);
  r := r || ' | 5.recap=' || (v_j ->> 'a_envoyer') || '/' || jsonb_array_length(v_j -> 'exclus') || '/' || (v_j ->> 'par_jour') || '/' || (v_j ->> 'par_minute')
    || case when v_j ->> 'a_envoyer' = '6' and jsonb_array_length(v_j -> 'exclus') = 3 and v_j ->> 'par_jour' = '250' and v_j ->> 'par_minute' = '5' then ' ok' else ' KO' end;
  execute 'reset role';
  insert into public.recus_lots (organisation_id, annee, type) values (v_org, 2025, 'generation') returning id into v_gen;
  execute 'set local role authenticated';
  begin
    perform public.lancer_lot_envoi_recus(v_org, 2025);
    r := r || ' generation_en_cours=ACCEPTE(KO)';
  exception when others then r := r || ' generation_en_cours=' || sqlerrm || case when sqlerrm = 'GENERATION_EN_COURS' then ' ok' else ' KO' end;
  end;
  execute 'reset role';
  update public.recus_lots set statut = 'termine' where id = v_gen;
  execute 'set local role authenticated';
  v_lot := public.lancer_lot_envoi_recus(v_org, 2025);
  begin
    perform public.lancer_lot_envoi_recus(v_org, 2025);
    r := r || ' double=ACCEPTE(KO)';
  exception when others then r := r || ' double=' || sqlerrm || case when sqlerrm = 'LOT_DEJA_EN_COURS' then ' ok' else ' KO' end;
  end;
  execute 'reset role';
  select l.nb_total || ',' || l.type || ',' || string_agg(pe.nom, '|' order by g.rang) into v_txt
    from public.recus_lots l join public.recus_lot_lignes g on g.lot_id = l.id
    join public.profils_participant pp on pp.id = g.profil_participant_id join public.personnes pe on pe.id = pp.personne_id
   where l.id = v_lot group by l.nb_total, l.type;
  r := r || ' lot=' || v_txt || case when v_txt = '6,envoi,D1|D10|D2|D3|D4|D5' then ' ok' else ' KO' end;
  -- La version visée de D10 est la version 2
  select v.version::text into v_txt from public.recus_lot_lignes g join public.recus_fiscaux_versions v on v.id = g.version_id
    join public.profils_participant pp on pp.id = g.profil_participant_id join public.personnes pe on pe.id = pp.personne_id
   where g.lot_id = v_lot and pe.nom = 'D10';
  r := r || ' version_d10=' || coalesce(v_txt, 'null') || case when v_txt = '2' then ' ok' else ' KO' end;

  -- 6. Rythme : par minute (défaut 5 ; 1 envoi il y a 30 s compté) et par jour (réglage organisation)
  -- D9 a été envoyé il y a 3 jours : hors fenêtre. Envoi manuel simulé il y a 30 s (autre année).
  insert into public.personnes (nom, prenom, civilite, email) values ('Manuel', 'P', 1, 'm@example.invalid') returning id into v_pe;
  insert into public.profils_participant (personne_id, organisation_id) values (v_pe, v_org) returning id into v_pp;
  insert into public.recus_fiscaux (profil_participant_id, organisation_id, annee, montant_total, fichier_url)
    values (v_pp, v_org, 2024, 10, 'test/m.pdf') returning id into v_recu;
  insert into public.recus_fiscaux_versions (recu_id, organisation_id, version, fichier_url, montant_total, email_envoye_le)
    values (v_recu, v_org, 1, 'test/m.pdf', 10, now() - interval '30 seconds');
  v_n := public.budget_envoi_lot_recus(v_lot);
  r := r || ' | 6.budget_minute=' || v_n || case when v_n = 4 then ' ok' else ' KO' end;
  update public.organisations set modele_recu_pdf = modele_recu_pdf || '{"envoi_lot_par_jour":3,"envoi_lot_par_minute":60}' where id = v_org;
  v_n := public.budget_envoi_lot_recus(v_lot);
  r := r || ' budget_jour=' || v_n || case when v_n = 2 then ' ok' else ' KO' end;
  update public.organisations set modele_recu_pdf = modele_recu_pdf || '{"envoi_lot_par_jour":"abc","envoi_lot_par_minute":0}' where id = v_org;
  select par_jour || '/' || par_minute into v_txt from public.rythme_envoi_recus(v_org);
  r := r || ' rythme_invalide=defaut' || case when v_txt = '250/5' then ' ok' else ' KO(' || v_txt || ')' end;
  update public.organisations set modele_recu_pdf = modele_recu_pdf || '{"envoi_lot_par_jour":3,"envoi_lot_par_minute":60}' where id = v_org;

  -- 7. Traitement : envoi réussi, déjà envoyé, ambigu (à vérifier), passager, interrompu
  select l.lot_id into v_lot2 from public.prendre_lot_recus(60) l where l.lot_id = v_lot;
  select l.type into v_txt from public.prendre_lot_recus(60) l where l.lot_id = v_lot;
  r := r || ' | 7.prendre=' || case when v_lot2 = v_lot and v_txt is null then 'ok' else 'KO' end;
  -- D1 : envoyé (le cœur d'envoi marque la version)
  select s.ligne_id into v_ligne from public.ligne_suivante_lot_recus(v_lot, 60) s;
  select g.version_id into v_version from public.recus_lot_lignes g where g.id = v_ligne;
  update public.recus_fiscaux_versions set email_envoye_le = now() where id = v_version;
  v_txt := public.terminer_ligne_lot_recus(v_ligne, 'fait', null, null, false, v_version, now(), 'brevo', false);
  select v_txt || ',' || email_canal || ',' || (envoye_le is not null)::text into v_txt from public.recus_lot_lignes where id = v_ligne;
  r := r || ' envoye=' || v_txt || case when v_txt = 'fait,brevo,true' then ' ok' else ' KO' end;
  -- Quota du jour atteint (3 : manuel + D1 + 1 à venir) : après D10, budget 0 et lot en attente
  -- D10 : envoi ambigu → à vérifier (compté dans le quota)
  select s.ligne_id into v_ligne from public.ligne_suivante_lot_recus(v_lot, 60) s;
  v_txt := public.terminer_ligne_lot_recus(v_ligne, 'a_verifier', 'Envoi Brevo incertain');
  r := r || ' ambigu=' || v_txt || case when v_txt = 'a_verifier' then ' ok' else ' KO' end;
  v_n := public.budget_envoi_lot_recus(v_lot);
  select en_attente_jusqu_a into v_t from public.recus_lots where id = v_lot;
  r := r || ' quota_atteint=' || v_n || case when v_n = 0 and v_t between now() + interval '23 hours' and now() + interval '25 hours' then ' ok' else ' KO(' || coalesce(v_t::text, 'null') || ')' end;
  select count(*) into v_n from public.prendre_lot_recus(60) l where l.lot_id = v_lot;
  r := r || ' en_attente_non_pris=' || case when v_n = 0 then 'ok' else 'KO' end;
  update public.recus_lots set en_attente_jusqu_a = null where id = v_lot;
  -- D2 : passager → a_faire ; reprise de la même ligne
  select s.ligne_id into v_ligne from public.ligne_suivante_lot_recus(v_lot, 60) s;
  v_txt := public.terminer_ligne_lot_recus(v_ligne, 'reessayer', 'Erreur lors de la récupération du PDF');
  select s.ligne_id into v_lot2 from public.ligne_suivante_lot_recus(v_lot, 60) s;
  r := r || ' passager=' || v_txt || ',' || case when v_lot2 = v_ligne then 'meme' else 'AUTRE' end
    || case when v_txt = 'a_faire' and v_lot2 = v_ligne then ' ok' else ' KO' end;
  -- D2 reste « en_cours » (exécution interrompue pendant l'envoi) : jamais renvoyée → à vérifier ;
  -- D3 : interrompue après marquage de la version → faite
  select s.ligne_id into v_lot2 from public.ligne_suivante_lot_recus(v_lot, 60) s; -- D2 → a_verifier, sert D3
  select statut into v_txt from public.recus_lot_lignes where id = v_ligne;
  r := r || ' interrompue=' || v_txt || case when v_txt = 'a_verifier' then ' ok' else ' KO' end;
  select g.version_id into v_version from public.recus_lot_lignes g where g.id = v_lot2;
  update public.recus_fiscaux_versions set email_envoye_le = now() + interval '1 second' where id = v_version;
  select s.ligne_id into v_ligne from public.ligne_suivante_lot_recus(v_lot, 60) s; -- D3 → fait, sert D4
  select statut into v_txt from public.recus_lot_lignes where id = v_lot2;
  r := r || ' interrompue_envoyee=' || v_txt || case when v_txt = 'fait' then ' ok' else ' KO' end;
  -- D4 : déjà envoyé entre-temps (envoi manuel)
  update public.recus_fiscaux_versions set email_envoye_le = now()
   where id = (select g.version_id from public.recus_lot_lignes g where g.id = v_ligne);
  v_txt := public.terminer_ligne_lot_recus(v_ligne, 'fait', null, null, false, null, now(), null, true);
  select v_txt || ',' || deja_envoye::text into v_txt from public.recus_lot_lignes where id = v_ligne;
  r := r || ' deja_envoye=' || v_txt || case when v_txt = 'fait,true' then ' ok' else ' KO' end;
  -- Résultat a_verifier refusé pour un lot de génération
  begin
    select g.id into v_ligne from public.recus_lot_lignes g where g.lot_id = v_lot and g.statut = 'a_faire' limit 1;
    insert into public.recus_lot_lignes (lot_id, organisation_id, profil_participant_id, rang)
      select v_gen, v_org, g.profil_participant_id, 1 from public.recus_lot_lignes g where g.id = v_ligne returning id into v_ligne;
    perform public.terminer_ligne_lot_recus(v_ligne, 'a_verifier');
    r := r || ' a_verifier_generation=ACCEPTE(KO)';
  exception when others then r := r || ' a_verifier_generation=refuse ok';
  end;
  select nb_faits || '/' || nb_echecs || '/' || nb_a_verifier into v_txt from public.recus_lots where id = v_lot;
  r := r || ' compteurs=' || v_txt || case when v_txt = '3/0/2' then ' ok' else ' KO' end;

  -- 8. Relance : les envois incertains et les envois faits ne sont pas reproposés
  perform public.liberer_lot_recus(v_lot);
  perform set_config('request.jwt.claims', json_build_object('sub', v_super, 'role', 'authenticated',
    'app_metadata', json_build_object('is_super_admin', true))::text, true);
  execute 'set local role authenticated';
  perform public.arreter_lot_recus(v_lot);
  v_j := public.recapitulatif_envoi_lot_recus(v_org, 2025);
  execute 'reset role';
  select string_agg(e.nom || ':' || coalesce(split_part(e.raison, ' ', 1), '-'), '|' order by e.rang) into v_txt
    from public.recus_envoi_lot(v_org, 2025) e;
  r := r || ' | 8.relance=' || v_txt || case when v_txt =
    'D10:Envoi|D2:Envoi|D5:-|D6:Aucune|D7:Adresse|D8:Email'
    then ' ok' else ' KO' end;
  r := r || ' recap_a_envoyer=' || (v_j ->> 'a_envoyer') || case when v_j ->> 'a_envoyer' = '1' then ' ok' else ' KO' end;
  -- Version déjà envoyée par un lot dont le marquage a échoué (D5) : pas reproposée
  insert into public.recus_lots (organisation_id, annee, type, statut) values (v_org, 2025, 'envoi', 'termine') returning id into v_lot2;
  insert into public.recus_lot_lignes (lot_id, organisation_id, profil_participant_id, rang, recu_id, version_id, statut)
    select v_lot2, v_org, rf.profil_participant_id, 1, rf.id, v.id, 'fait'
      from public.recus_fiscaux rf join public.recus_fiscaux_versions v on v.recu_id = rf.id
      join public.profils_participant pp on pp.id = rf.profil_participant_id join public.personnes pe on pe.id = pp.personne_id
     where rf.organisation_id = v_org and pe.nom = 'D5';
  select count(*) into v_n from public.recus_envoi_lot(v_org, 2025) e where e.raison is null;
  r := r || ' marquage_echoue=' || v_n || case when v_n = 0 then ' ok' else ' KO' end;
  execute 'set local role authenticated';
  begin
    perform public.lancer_lot_envoi_recus(v_org, 2025);
    r := r || ' rien_a_envoyer=ACCEPTE(KO)';
  exception when others then r := r || ' rien_a_envoyer=' || sqlerrm || case when sqlerrm = 'AUCUN_RECU_A_ENVOYER' then ' ok' else ' KO' end;
  end;
  execute 'reset role';

  -- 9. Fin : lot sans ligne restante → termine, en_attente effacé
  update public.recus_lots set statut = 'en_cours', en_attente_jusqu_a = now() - interval '1 minute' where id = v_lot;
  update public.recus_lot_lignes set statut = 'echec' where lot_id = v_lot and statut = 'a_faire';
  select count(*) into v_n from public.ligne_suivante_lot_recus(v_lot, 60);
  select statut || ',' || coalesce(en_attente_jusqu_a::text, 'null') || ',' || nb_echecs into v_txt from public.recus_lots where id = v_lot;
  r := r || ' | 9.termine=' || v_txt || case when v_n = 0 and v_txt = 'termine,null,1' then ' ok' else ' KO' end;

  raise exception 'RESULTATS: %', r;
end;
$$;
