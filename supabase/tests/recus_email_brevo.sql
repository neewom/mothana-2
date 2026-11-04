-- Tests de recus_email_brevo.sql — staging uniquement :
--   npx supabase db query --linked -f supabase/tests/recus_email_brevo.sql
-- Bloc terminé par une exception : rien n'est conservé. Dépend de l'org « Association Démo
-- Staging » (au moins un profil participant avec une personne).
do $$
declare v_demo uuid; v_profil uuid; v_personne uuid; v_recu uuid; r text := ''; v_at timestamptz;
  v_autre_org uuid; v_benevole uuid; v_trouve uuid; v_nb int;
begin
  select id into v_demo from public.organisations where nom = 'Association Démo Staging';
  select pp.id, pp.personne_id into v_profil, v_personne from public.profils_participant pp
    where pp.organisation_id = v_demo order by pp.created_at limit 1;

  -- 1. Changer l'email de la personne efface le marquage « email invalide » de ses profils
  update public.profils_participant set email_invalide_at = now(), email_invalide_evenement = 'hard_bounce'
    where id = v_profil;
  update public.personnes set nom = nom where id = v_personne;
  select email_invalide_at into v_at from public.profils_participant where id = v_profil;
  r := r || '1.autre_colonne=' || case when v_at is not null then 'conserve' else 'EFFACE(KO)' end;
  update public.personnes set email = coalesce(email, '') || '.test' where id = v_personne;
  select email_invalide_at into v_at from public.profils_participant where id = v_profil;
  r := r || ' email_change=' || case when v_at is null then 'efface' else 'CONSERVE(KO)' end;

  -- 2. email_canal : brevo / resend acceptés, toute autre valeur refusée
  select id into v_recu from public.recus_fiscaux where organisation_id = v_demo limit 1;
  if v_recu is not null then
    update public.recus_fiscaux set email_canal = 'brevo' where id = v_recu;
    update public.recus_fiscaux set email_canal = 'resend' where id = v_recu;
    begin
      update public.recus_fiscaux set email_canal = 'autre' where id = v_recu;
      r := r || ' | 2.canal_autre=ACCEPTE(KO)';
    exception when check_violation then r := r || ' | 2.canal_autre=refuse';
    end;
  end if;

  -- 3. profils_donateur_par_emails : casse et espaces de bord ignorés, organisation respectée
  update public.personnes set email = '  Rebond.Test@Example.ORG ' where id = v_personne;
  select profil_id into v_trouve from public.profils_donateur_par_emails(v_demo, array['rebond.test@example.org']);
  r := r || ' | 3.casse_espaces=' || case when v_trouve = v_profil then 'trouve' else 'ABSENT(KO)' end;
  select profil_id into v_trouve from public.profils_donateur_par_emails(v_demo, array[' REBOND.TEST@example.org']);
  r := r || ' recherche_non_normalisee=' || case when v_trouve = v_profil then 'trouve' else 'ABSENT(KO)' end;
  select id into v_autre_org from public.organisations where id <> v_demo limit 1;
  select count(*) into v_nb from public.profils_donateur_par_emails(v_autre_org, array['rebond.test@example.org']) f
    where f.profil_id = v_profil;
  r := r || ' autre_org=' || case when v_nb = 0 then 'rien' else 'TROUVE(KO)' end;

  -- 4. Session bénévole : exécution refusée (réservée au service_role)
  select id into v_benevole from auth.users where email = 'benevole-' || v_demo || '@mothana.internal';
  perform set_config('request.jwt.claims', json_build_object('sub', v_benevole, 'role', 'authenticated',
    'app_metadata', json_build_object('role', 'benevole', 'organisation_id', v_demo))::text, true);
  execute 'set local role authenticated';
  begin
    perform public.profils_donateur_par_emails(v_demo, array['rebond.test@example.org']);
    r := r || ' | 4.benevole=ACCEPTE(KO)';
  exception when insufficient_privilege then r := r || ' | 4.benevole=refuse';
  end;

  raise exception 'RESULTATS: %', r;
end;
$$;
