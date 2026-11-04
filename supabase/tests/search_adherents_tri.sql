-- Tests du tri serveur de search_adherents (search_adherents_tri.sql) — staging uniquement :
--   npx supabase db query --linked -f supabase/tests/search_adherents_tri.sql
-- Bloc terminé par une exception : rien n'est conservé (adhérents de test créés puis annulés).
-- Dépend de l'org « Association Démo Staging » (un admin, le compte bénévole). Chaque cas affiche
-- l'ordre obtenu et OK/KO ; les adhérents de test portent une liste propre au test (p_tag) pour
-- ne pas dépendre des données existantes.
do $$
declare
  v_demo uuid; v_admin uuid; v_benevole uuid;
  v_tag text := 'zz-test-tri-' || substr(md5(random()::text), 1, 8);
  v_tag2 text := v_tag || '-bis';
  v_a uuid := gen_random_uuid(); v_b uuid := gen_random_uuid(); v_c uuid := gen_random_uuid();
  v_d uuid := gen_random_uuid(); v_e uuid := gen_random_uuid();
  r text := ''; got text; page text;
begin
  select id into v_demo from public.organisations where nom = 'Association Démo Staging';
  select po.utilisateur_id into v_admin from public.profils_organisation po
    where po.organisation_id = v_demo and po.role = 'admin' order by po.created_at desc limit 1;
  select id into v_benevole from auth.users where email = 'benevole-' || v_demo || '@mothana.internal';

  -- Jeu de test : A..E. Dernière adhésion : B et D le 2026-06-01 (égalité → nom), A 2026-01-10
  -- (une plus ancienne en 2025, ignorée), E 2025-03-01, C aucune. D sans date de fin.
  insert into public.adherents (id, organisation_id, nom, prenom, ville, tags) values
    (v_a, v_demo, 'ZTri A', 'Alpha',   'Paris', array[v_tag, v_tag2]),
    (v_b, v_demo, 'ZTri B', 'Bravo',   'Lyon',  array[v_tag]),
    (v_c, v_demo, 'ZTri C', 'Charlie', 'Paris', array[v_tag]),
    (v_d, v_demo, 'ZTri D', '',        'Paris', array[v_tag, v_tag2]),
    (v_e, v_demo, 'ZTri E', 'Echo',    null,    array[v_tag]);
  insert into public.adhesions (adherent_id, date_debut, date_fin) values
    (v_a, '2025-01-01', '2025-12-31'),
    (v_a, '2026-01-10', '2026-12-31'),
    (v_b, '2026-06-01', '2027-05-31'),
    (v_d, '2026-06-01', null),
    (v_e, '2025-03-01', '2026-02-28');
  -- Le trigger trg_adhesions_poser_date_fin recalcule date_fin à l'insertion : on repose les dates
  -- de fin voulues (mise à jour de date_fin seule, hors trigger), dont une adhésion sans fin
  -- (cas des données historiques).
  update public.adhesions h set date_fin = v.fin
    from (values (v_a, date '2025-01-01', date '2025-12-31'), (v_a, date '2026-01-10', date '2026-12-31'),
                 (v_b, date '2026-06-01', date '2027-05-31'), (v_d, date '2026-06-01', null::date),
                 (v_e, date '2025-03-01', date '2026-02-28')) as v(adherent, debut, fin)
    where h.adherent_id = v.adherent and h.date_debut = v.debut;

  -- Session admin de l'organisation (RLS appliquée : security invoker)
  perform set_config('request.jwt.claims', json_build_object('sub', v_admin, 'role', 'authenticated', 'app_metadata', json_build_object())::text, true);
  execute 'set local role authenticated';

  -- 1. Date d'adhésion décroissante : derniers adhérents en premier, sans adhésion en dernier
  select string_agg(right(s.nom, 1), ',' order by s.ord) into got from (
    select x.nom, x.ordinality as ord
    from public.search_adherents(v_demo, p_tag => v_tag, p_tri => 'date_adhesion', p_sens => 'desc') with ordinality x) s;
  r := r || '1.date_adhesion_desc=' || got || case when got = 'B,D,A,E,C' then ' OK' else ' KO' end;

  -- 2. Date d'adhésion croissante : vides toujours en dernier
  select string_agg(right(s.nom, 1), ',' order by s.ord) into got from (
    select x.nom, x.ordinality as ord
    from public.search_adherents(v_demo, p_tag => v_tag, p_tri => 'date_adhesion', p_sens => 'asc') with ordinality x) s;
  r := r || ' | 2.date_adhesion_asc=' || got || case when got = 'E,A,B,D,C' then ' OK' else ' KO' end;

  -- 3. Pagination : trois pages de 2 = la liste complète, total_count identique sur chaque page
  got := '';
  for i in 0..2 loop
    select string_agg(right(x.nom, 1) || '/' || x.total_count, ',' order by x.ordinality) into page
      from public.search_adherents(v_demo, p_tag => v_tag, p_limit => 2, p_offset => i * 2, p_tri => 'date_adhesion', p_sens => 'desc') with ordinality x;
    got := got || case when i > 0 then ',' else '' end || page;
  end loop;
  r := r || ' | 3.pages=' || got || case when got = 'B/5,D/5,A/5,E/5,C/5' then ' OK' else ' KO' end;

  -- 4. Filtres combinés au tri (liste + hors liste) : A et D exclus
  select string_agg(right(s.nom, 1), ',' order by s.ord) into got from (
    select x.nom, x.ordinality as ord
    from public.search_adherents(v_demo, p_tag => v_tag, p_exclude_tag => v_tag2, p_tri => 'date_adhesion', p_sens => 'desc') with ordinality x) s;
  r := r || ' | 4.filtres=' || got || case when got = 'B,E,C' then ' OK' else ' KO' end;

  -- 5. Date de fin décroissante : sans fin (D) et sans adhésion (C) en dernier, départagés par nom
  select string_agg(right(s.nom, 1), ',' order by s.ord) into got from (
    select x.nom, x.ordinality as ord
    from public.search_adherents(v_demo, p_tag => v_tag, p_tri => 'date_fin', p_sens => 'desc') with ordinality x) s;
  r := r || ' | 5.date_fin_desc=' || got || case when got = 'B,A,E,C,D' then ' OK' else ' KO' end;

  -- 6. Ville décroissante (texte) : vide en dernier, égalités par nom croissant
  select string_agg(right(s.nom, 1), ',' order by s.ord) into got from (
    select x.nom, x.ordinality as ord
    from public.search_adherents(v_demo, p_tag => v_tag, p_tri => 'ville', p_sens => 'desc') with ordinality x) s;
  r := r || ' | 6.ville_desc=' || got || case when got = 'A,C,D,B,E' then ' OK' else ' KO' end;

  -- 7. Prénom croissant : prénom vide (D) en dernier
  select string_agg(right(s.nom, 1), ',' order by s.ord) into got from (
    select x.nom, x.ordinality as ord
    from public.search_adherents(v_demo, p_tag => v_tag, p_tri => 'prenom') with ordinality x) s;
  r := r || ' | 7.prenom_asc=' || got || case when got = 'A,B,C,E,D' then ' OK' else ' KO' end;

  -- 8. Nom décroissant (sens en majuscules accepté)
  select string_agg(right(s.nom, 1), ',' order by s.ord) into got from (
    select x.nom, x.ordinality as ord
    from public.search_adherents(v_demo, p_tag => v_tag, p_tri => 'nom', p_sens => 'DESC') with ordinality x) s;
  r := r || ' | 8.nom_desc=' || got || case when got = 'E,D,C,B,A' then ' OK' else ' KO' end;

  -- 9. Clé inconnue (ou tentative d'injection) → tri par défaut, nom croissant
  select string_agg(right(s.nom, 1), ',' order by s.ord) into got from (
    select x.nom, x.ordinality as ord
    from public.search_adherents(v_demo, p_tag => v_tag, p_tri => 'nom; drop table adherents', p_sens => 'desc; --') with ordinality x) s;
  r := r || ' | 9.cle_inconnue=' || got || case when got = 'A,B,C,D,E' then ' OK' else ' KO' end;

  -- 10. Sans paramètre de tri (appel historique à 11 paramètres) : ordre par défaut inchangé
  select string_agg(right(s.nom, 1), ',' order by s.ord) into got from (
    select x.nom, x.ordinality as ord
    from public.search_adherents(v_demo, null, null, 50, 0, v_tag, null, null, null, null, null) with ordinality x) s;
  r := r || ' | 10.defaut=' || got || case when got = 'A,B,C,D,E' then ' OK' else ' KO' end;

  -- 11. Session bénévole : aucune ligne (RLS adherents)
  perform set_config('request.jwt.claims', json_build_object('sub', v_benevole, 'role', 'authenticated',
    'app_metadata', json_build_object('role', 'benevole', 'organisation_id', v_demo))::text, true);
  r := r || ' | 11.benevole_lignes=' || (select count(*) from public.search_adherents(v_demo, p_tri => 'date_adhesion', p_sens => 'desc'))
    || case when (select count(*) from public.search_adherents(v_demo, p_tri => 'date_adhesion', p_sens => 'desc')) = 0 then ' OK' else ' KO' end;

  execute 'reset role';
  raise exception 'RESULTATS: %', r;
end;
$$;
