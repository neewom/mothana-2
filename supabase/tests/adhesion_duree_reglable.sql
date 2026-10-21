-- Tests de la durée d'adhésion réglable (adhesion_duree_reglable.sql) — à rejouer sur
-- staging uniquement :
--   npx supabase db query --linked -f supabase/tests/adhesion_duree_reglable.sql
-- Tout se passe dans un bloc qui se termine par une exception : rien n'est conservé ; le
-- message RESULTATS: liste chaque cas (attendu entre parenthèses quand il compte). Dépend de
-- l'org « Association Démo Staging » (un admin, au moins un adhérent), d'une seconde
-- organisation quelconque et d'un compte super-admin.
do $$
declare
  v_demo uuid; v_autre uuid; v_admin uuid; v_adherent uuid; v_adh uuid := gen_random_uuid();
  v_import_adh uuid := gen_random_uuid(); v_import_adhesion uuid := gen_random_uuid();
  v_super jsonb;
  v_apercu jsonb; v_n integer; v_fin date;
  r text := '';
begin
  select id into v_demo from public.organisations where nom = 'Association Démo Staging';
  select id into v_autre from public.organisations where id <> v_demo order by created_at limit 1;
  select po.utilisateur_id into v_admin from public.profils_organisation po
    where po.organisation_id = v_demo and po.role = 'admin' order by po.created_at limit 1;
  select id into v_adherent from public.adherents where organisation_id = v_demo order by created_at limit 1;
  -- Vrai compte super-admin : le journal référence auth.users.
  select json_build_object('sub', id, 'role', 'authenticated', 'app_metadata', json_build_object('is_super_admin', true))::jsonb
    into v_super from auth.users where (raw_app_meta_data ->> 'is_super_admin')::boolean limit 1;

  -- 1. Règle par défaut (glissante) : + 1 an, 29 février → 28 février
  r := r || '1.glissante=' || public.calculer_date_fin_adhesion(v_demo, date '2026-03-15') || '(2027-03-15)'
         || ' bissextile=' || public.calculer_date_fin_adhesion(v_demo, date '2024-02-29') || '(2025-02-28)';

  -- 2. Trigger en glissante : la date envoyée est ignorée
  insert into public.adhesions (id, adherent_id, date_debut, date_fin) values (v_adh, v_adherent, date '2026-03-15', date '2000-01-01');
  r := r || ' | 2.trigger=' || (select date_fin from public.adhesions where id = v_adh) || '(2027-03-15)';

  -- 3. Année civile, bascule en décembre
  update public.organisations set adhesion_regle_fin = 'annee_civile', adhesion_mois_bascule = 12 where id = v_demo;
  r := r || ' | 3.15/03=' || public.calculer_date_fin_adhesion(v_demo, date '2026-03-15') || '(2026-12-31)'
         || ' 30/11=' || public.calculer_date_fin_adhesion(v_demo, date '2026-11-30') || '(2026-12-31)'
         || ' 05/12=' || public.calculer_date_fin_adhesion(v_demo, date '2026-12-05') || '(2027-12-31)'
         || ' autre_org=' || public.calculer_date_fin_adhesion(v_autre, date '2026-12-05') || '(2027-12-05)';

  -- 4. Bascule en octobre
  update public.organisations set adhesion_mois_bascule = 10 where id = v_demo;
  r := r || ' | 4.bascule_oct 15/10=' || public.calculer_date_fin_adhesion(v_demo, date '2026-10-15') || '(2027-12-31)'
         || ' 30/09=' || public.calculer_date_fin_adhesion(v_demo, date '2026-09-30') || '(2026-12-31)';
  update public.organisations set adhesion_mois_bascule = 12 where id = v_demo;

  -- 5. Trigger sur changement de date d'adhésion
  update public.adhesions set date_debut = date '2026-12-05' where id = v_adh;
  r := r || ' | 5.update_debut=' || (select date_fin from public.adhesions where id = v_adh) || '(2027-12-31)';

  -- 6. Admin de l'organisation : aperçu puis recalage, journalisé
  perform set_config('request.jwt.claims', json_build_object('sub', v_admin, 'role', 'authenticated', 'app_metadata', json_build_object())::text, true);
  execute 'set local role authenticated';
  v_apercu := public.apercu_recalage_adhesions(v_demo);
  v_n := public.recalculer_dates_fin_adhesions(v_demo);
  r := r || ' | 6.apercu=' || v_apercu::text || ' recalees=' || v_n || '(=a_modifier)'
         || ' reste_a_modifier=' || (public.apercu_recalage_adhesions(v_demo) ->> 'a_modifier') || '(0)'
         || ' journal=' || (select count(*) from public.journal_modifications
              where organisation_id = v_demo and action = 'recalage_adhesions' and created_at = now()) || '(1)';

  -- 7. Admin : aperçu / recalage d'une autre organisation refusés
  begin
    perform public.recalculer_dates_fin_adhesions(v_autre);
    r := r || ' | 7.autre_org=ACCEPTE(KO)';
  exception when insufficient_privilege then
    r := r || ' | 7.autre_org=refuse';
  end;

  -- 8. Import (admin) : date de fin selon la règle de l'organisation
  perform public.import_upsert_adherents(jsonb_build_array(jsonb_build_object(
    'adherent_id', v_import_adh, 'nom', 'TEST-DUREE', 'civilite', 0,
    'adhesion_id', v_import_adhesion, 'date_debut', '2026-03-15')), null);
  r := r || ' | 8.import=' || (select date_fin from public.adhesions where id = v_import_adhesion) || '(2026-12-31)';

  -- 9. Super-admin (mode Consulter) : recalage autorisé
  perform set_config('request.jwt.claims', v_super::text, true);
  update public.organisations set adhesion_regle_fin = 'glissante' where id = v_demo;
  v_n := public.recalculer_dates_fin_adhesions(v_demo);
  select date_fin into v_fin from public.adhesions where id = v_adh;
  r := r || ' | 9.super_admin recalees=' || v_n || ' retour_glissante=' || v_fin || '(2027-12-05)';

  -- 10. Anonyme : recalage interdit
  execute 'reset role';
  execute 'set local role anon';
  begin
    perform public.recalculer_dates_fin_adhesions(v_demo);
    r := r || ' | 10.anon=ACCEPTE(KO)';
  exception when insufficient_privilege then
    r := r || ' | 10.anon=refuse';
  end;

  raise exception 'RESULTATS: %', r;
end;
$$;
