-- Tests de adherents_par_emails.sql — staging uniquement :
--   npx supabase db query --linked -f supabase/tests/adherents_par_emails.sql
-- Bloc terminé par une exception : rien n'est conservé. Dépend de l'org « Association Démo
-- Staging » (au moins un adhérent).
do $$
declare v_demo uuid; v_adherent uuid; v_autre_org uuid; v_benevole uuid; v_trouve uuid; v_nb int;
  r text := '';
begin
  select id into v_demo from public.organisations where nom = 'Association Démo Staging';
  select a.id into v_adherent from public.adherents a where a.organisation_id = v_demo order by a.created_at limit 1;
  if v_adherent is null then raise exception 'Aucun adhérent dans l''org démo'; end if;

  -- 1. Casse et espaces de bord ignorés (adresse stockée et adresse recherchée)
  update public.adherents set courriel = E'  Rebond.Adh@Example.ORG \t' where id = v_adherent;
  select f.adherent_id into v_trouve from public.adherents_par_emails(v_demo, array['rebond.adh@example.org']) f;
  r := r || '1.casse_espaces=' || case when v_trouve = v_adherent then 'trouve' else 'ABSENT(KO)' end;
  v_trouve := null;
  select f.adherent_id into v_trouve from public.adherents_par_emails(v_demo, array[' REBOND.ADH@example.org']) f;
  r := r || ' recherche_non_normalisee=' || case when v_trouve = v_adherent then 'trouve' else 'ABSENT(KO)' end;
  select count(*) into v_nb from public.adherents_par_emails(v_demo, array['autre.adh@example.org']) f
    where f.adherent_id = v_adherent;
  r := r || ' autre_adresse=' || case when v_nb = 0 then 'rien' else 'TROUVE(KO)' end;

  -- 2. Organisation respectée : l'adresse n'est pas retrouvée depuis une autre organisation
  select id into v_autre_org from public.organisations where id <> v_demo limit 1;
  select count(*) into v_nb from public.adherents_par_emails(v_autre_org, array['rebond.adh@example.org']) f
    where f.adherent_id = v_adherent;
  r := r || ' | 2.autre_org=' || case when v_nb = 0 then 'rien' else 'TROUVE(KO)' end;

  -- 3. anon : exécution refusée
  begin
    execute 'set local role anon';
    perform public.adherents_par_emails(v_demo, array['rebond.adh@example.org']);
    r := r || ' | 3.anon=ACCEPTE(KO)';
  exception when insufficient_privilege then r := r || ' | 3.anon=refuse';
  end;
  execute 'reset role';

  -- 4. authenticated (session bénévole) : exécution refusée (réservée au service_role)
  select id into v_benevole from auth.users where email = 'benevole-' || v_demo || '@mothana.internal';
  perform set_config('request.jwt.claims', json_build_object('sub', v_benevole, 'role', 'authenticated',
    'app_metadata', json_build_object('role', 'benevole', 'organisation_id', v_demo))::text, true);
  begin
    execute 'set local role authenticated';
    perform public.adherents_par_emails(v_demo, array['rebond.adh@example.org']);
    r := r || ' | 4.benevole=ACCEPTE(KO)';
  exception when insufficient_privilege then r := r || ' | 4.benevole=refuse';
  end;

  raise exception 'RESULTATS: %', r;
end;
$$;
