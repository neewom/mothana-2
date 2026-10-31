-- Tests de l'unicité du numéro de reçu par organisation (recus_fiscaux_numero_unique.sql) — staging uniquement :
--   npx supabase db query --linked -f supabase/tests/recus_fiscaux_numero_unique.sql
-- Bloc terminé par une exception : rien n'est conservé. Dépend de l'org « Association Démo
-- Staging » (au moins trois participants, compte bénévole existant) et d'une seconde organisation
-- ayant au moins un participant. Écritures en service_role (comme generate-recu) ; année 1900 pour
-- ne croiser aucun reçu réel.
do $$
declare
  v_demo uuid; v_autre_org uuid; v_p1 uuid; v_p2 uuid; v_p3 uuid; v_autre_p uuid; v_benevole uuid;
  r text := '';
begin
  select id into v_demo from public.organisations where nom = 'Association Démo Staging';
  select id into v_benevole from auth.users where email = 'benevole-' || v_demo || '@mothana.internal';
  select id into v_p1 from public.profils_participant where organisation_id = v_demo order by id limit 1;
  select id into v_p2 from public.profils_participant where organisation_id = v_demo and id <> v_p1 order by id limit 1;
  select id into v_p3 from public.profils_participant where organisation_id = v_demo and id not in (v_p1, v_p2) order by id limit 1;
  select pp.organisation_id, pp.id into v_autre_org, v_autre_p from public.profils_participant pp
    where pp.organisation_id <> v_demo order by pp.id limit 1;

  execute 'set local role service_role';

  -- 1. Premier reçu au numéro 1900-001 : accepté
  insert into public.recus_fiscaux (profil_participant_id, organisation_id, annee, montant_total, numero_ordre)
    values (v_p1, v_demo, 1900, 10, '1900-001');
  r := r || '1.premier=ok';

  -- 2. Autre donateur, même organisation, même numéro : refusé
  begin
    insert into public.recus_fiscaux (profil_participant_id, organisation_id, annee, montant_total, numero_ordre)
      values (v_p2, v_demo, 1900, 10, '1900-001');
    r := r || ' | 2.doublon_meme_org=ACCEPTE(KO)';
  exception when unique_violation then r := r || ' | 2.doublon_meme_org=refuse(23505)';
  end;

  -- 3. Même numéro dans une autre organisation : accepté
  begin
    insert into public.recus_fiscaux (profil_participant_id, organisation_id, annee, montant_total, numero_ordre)
      values (v_autre_p, v_autre_org, 1900, 10, '1900-001');
    r := r || ' | 3.meme_numero_autre_org=accepte';
  exception when unique_violation then r := r || ' | 3.meme_numero_autre_org=REFUSE(KO)';
  end;

  -- 4. Plusieurs reçus sans numéro dans la même organisation : acceptés (index partiel)
  begin
    insert into public.recus_fiscaux (profil_participant_id, organisation_id, annee, montant_total, numero_ordre)
      values (v_p2, v_demo, 1900, 10, null), (v_p3, v_demo, 1900, 10, null);
    r := r || ' | 4.numeros_null=acceptes';
  exception when unique_violation then r := r || ' | 4.numeros_null=REFUSES(KO)';
  end;

  -- 5. Régénération au même numéro par le même reçu (upsert de generate-recu) : acceptée
  begin
    insert into public.recus_fiscaux (profil_participant_id, organisation_id, annee, montant_total, numero_ordre)
      values (v_p1, v_demo, 1900, 20, '1900-001')
      on conflict (profil_participant_id, annee) do update set
        montant_total = excluded.montant_total, numero_ordre = excluded.numero_ordre;
    r := r || ' | 5.regeneration=acceptee';
  exception when unique_violation then r := r || ' | 5.regeneration=REFUSEE(KO)';
  end;

  -- 6. Remplissage d'un numéro NULL avec un numéro déjà pris : refusé
  begin
    update public.recus_fiscaux set numero_ordre = '1900-001'
      where profil_participant_id = v_p2 and annee = 1900;
    r := r || ' | 6.remplissage_doublon=ACCEPTE(KO)';
  exception when unique_violation then r := r || ' | 6.remplissage_doublon=refuse(23505)';
  end;

  -- 7. Session bénévole : aucune écriture possible sur recus_fiscaux (recus_lecture_seule.sql)
  execute 'reset role';
  perform set_config('request.jwt.claims', json_build_object('sub', v_benevole, 'role', 'authenticated',
    'app_metadata', json_build_object('role', 'benevole', 'organisation_id', v_demo))::text, true);
  execute 'set local role authenticated';
  begin
    insert into public.recus_fiscaux (profil_participant_id, organisation_id, annee, montant_total, numero_ordre)
      values (v_p3, v_demo, 1901, 10, '1901-001');
    r := r || ' | 7.benevole_insert=ACCEPTE(KO)';
  exception when insufficient_privilege then r := r || ' | 7.benevole_insert=refuse';
  end;

  raise exception 'RESULTATS: %', r;
end;
$$;
