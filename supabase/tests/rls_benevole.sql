-- Tests des droits du compte bénévole (rls_benevole_restreint.sql) — à rejouer sur staging
-- uniquement :
--   npx supabase db query --linked -f supabase/tests/rls_benevole.sql
-- Tout se passe dans un bloc qui se termine par une exception : rien n'est conservé ; le
-- message RESULTATS: liste chaque cas. Dépend de l'org « Association Démo Staging » (un admin,
-- un contributeur, le compte bénévole, des adhérents, des donateurs) et d'un super-admin.
do $$
declare
  v_demo uuid; v_autre uuid; v_admin uuid; v_contrib uuid; v_benevole uuid; v_super uuid;
  v_nom_adherent text; v_personne uuid := gen_random_uuid(); v_profil uuid := gen_random_uuid();
  r text := '';
  n int;
begin
  select id into v_demo from public.organisations where nom = 'Association Démo Staging';
  select id into v_autre from public.organisations where id <> v_demo
    and exists (select 1 from public.adherents a where a.organisation_id = organisations.id) limit 1;
  select po.utilisateur_id into v_admin from public.profils_organisation po
    where po.organisation_id = v_demo and po.role = 'admin' order by po.created_at desc limit 1;
  select po.utilisateur_id into v_contrib from public.profils_organisation po
    where po.organisation_id = v_demo and po.role = 'contributeur' limit 1;
  select id into v_benevole from auth.users where email = 'benevole-' || v_demo || '@mothana.internal';
  select id into v_super from auth.users where (raw_app_meta_data ->> 'is_super_admin')::boolean limit 1;
  select nom into v_nom_adherent from public.adherents where organisation_id = v_demo limit 1;

  -- Session bénévole
  perform set_config('request.jwt.claims', json_build_object('sub', v_benevole, 'role', 'authenticated',
    'app_metadata', json_build_object('role', 'benevole', 'organisation_id', v_demo))::text, true);
  execute 'set local role authenticated';

  -- 1. Données admin invisibles
  r := r || '1.benevole_lecture_vide='
    || ((select count(*) from public.adherents) = 0
    and (select count(*) from public.adhesions) = 0
    and (select count(*) from public.listes_diffusion) = 0
    and (select count(*) from public.mailing_templates) = 0
    and (select count(*) from public.templates_recu) = 0
    and (select count(*) from public.templates_carte_adherent) = 0
    and (select count(*) from public.journal_modifications) = 0
    and (select count(*) from public.demandes_adhesion) = 0
    and (select count(*) from public.campagnes_mailing) = 0
    and (select count(*) from public.campagnes_courrier) = 0
    and (select count(*) from public.organisation_assets) = 0);

  -- 2. Écritures admin sans effet ou refusées
  delete from public.adherents where organisation_id = v_demo;
  get diagnostics n = row_count;
  r := r || ' | 2.benevole_delete_adherents=' || n;
  update public.personnes set nom = nom
    where id in (select personne_id from public.profils_participant where organisation_id = v_demo);
  get diagnostics n = row_count;
  r := r || ' benevole_update_personnes=' || n;
  begin
    insert into public.listes_diffusion (organisation_id, nom) values (v_demo, 'test-rls');
    r := r || ' benevole_insert_liste=ACCEPTE(KO)';
  exception when insufficient_privilege then r := r || ' benevole_insert_liste=refuse';
  end;
  begin
    insert into public.journal_modifications (organisation_id, table_cible, ligne_id, action, auteur_id)
      values (v_demo, 'dons', gen_random_uuid(), 'modification', v_benevole);
    r := r || ' benevole_insert_journal=ACCEPTE(KO)';
  exception when insufficient_privilege then r := r || ' benevole_insert_journal=refuse';
  end;

  -- 3. Ce dont l'écran bénévole a besoin
  r := r || ' | 3.benevole_org=' || ((select count(*) from public.organisations) = 1)
    || ' donateurs=' || ((select count(*) from public.profils_participant) > 0)
    || ' personnes=' || ((select count(*) from public.personnes) > 0);
  insert into public.personnes (id, nom, prenom) values (v_personne, 'Test RLS', 'Bénévole');
  insert into public.profils_participant (id, personne_id, organisation_id) values (v_profil, v_personne, v_demo);
  insert into public.dons (id, profil_participant_id, organisation_id, montant, date, mode_paiement, created_by_role)
    values (gen_random_uuid(), v_profil, v_demo, 10, current_date, 1, 'benevole');
  r := r || ' saisie_don=ok';
  r := r || ' verification=' || ((select count(*) from public.search_adherents_verification(v_demo, v_nom_adherent)) > 0)
    || ' verification_autre_org=' || (select count(*) from public.search_adherents_verification(v_autre, 'a'));

  -- 4. Admin et contributeur gardent leurs droits
  perform set_config('request.jwt.claims', json_build_object('sub', v_admin, 'role', 'authenticated', 'app_metadata', json_build_object())::text, true);
  r := r || ' | 4.admin_adherents=' || ((select count(*) from public.adherents) > 0)
    || ' admin_templates=' || ((select count(*) from public.templates_recu) > 0)
    || ' admin_verification=' || ((select count(*) from public.search_adherents_verification(v_demo, v_nom_adherent)) > 0)
    || ' admin_verification_autre_org=' || (select count(*) from public.search_adherents_verification(v_autre, 'a'));
  perform set_config('request.jwt.claims', json_build_object('sub', v_contrib, 'role', 'authenticated', 'app_metadata', json_build_object())::text, true);
  r := r || ' contrib_adherents=' || ((select count(*) from public.adherents) > 0)
    || ' contrib_listes_ou_vide=' || ((select count(*) from public.listes_diffusion where organisation_id <> v_demo) = 0);

  -- 5. Bypass super-admin
  perform set_config('request.jwt.claims', json_build_object('sub', v_super, 'role', 'authenticated',
    'app_metadata', json_build_object('is_super_admin', true))::text, true);
  r := r || ' | 5.super_adherents_demo=' || ((select count(*) from public.adherents where organisation_id = v_demo) > 0)
    || ' super_verification_autre_org=' || ((select count(*) from public.search_adherents_verification(v_autre, 'a')) > 0);

  -- 6. Session sans organisation : rien
  perform set_config('request.jwt.claims', json_build_object('sub', gen_random_uuid(), 'role', 'authenticated', 'app_metadata', json_build_object())::text, true);
  r := r || ' | 6.sans_org_verification=' || (select count(*) from public.search_adherents_verification(v_demo, v_nom_adherent))
    || ' sans_org_adherents=' || (select count(*) from public.adherents);

  execute 'reset role';
  raise exception 'RESULTATS: %', r;
end $$;
