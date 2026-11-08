-- Tests de la numérotation des reçus au-delà de 999 (next_numero_recu_sans_troncature.sql) — staging uniquement :
--   npx supabase db query --linked -f supabase/tests/next_numero_recu_sans_troncature.sql
-- Bloc terminé par une exception : rien n'est conservé (les séquences créées sont annulées avec
-- la transaction). Dépend de l'org « Association Démo Staging » et de son compte bénévole.
-- Années 1890 et 1891 pour ne croiser aucune séquence réelle.
do $$
declare
  v_demo uuid; v_benevole uuid; v_seq text; v_num text;
  r text := '';
begin
  select id into v_demo from public.organisations where nom = 'Association Démo Staging';
  select id into v_benevole from auth.users where email = 'benevole-' || v_demo || '@mothana.internal';
  v_seq := 'recu_seq_' || replace(v_demo::text, '-', '_') || '_1890';
  if exists (select 1 from pg_sequences where schemaname = 'public' and sequencename in (v_seq,
       'recu_seq_' || replace(v_demo::text, '-', '_') || '_1891')) then
    raise exception 'séquence de test déjà présente, test annulé';
  end if;

  -- 1. Séquence positionnée à 998 : 998, 999, puis 1000 et 1001 sans troncature
  -- (séquence créée par le propriétaire, comme le ferait la fonction security definer)
  execute format('create sequence public.%I start 998', v_seq);
  execute 'set local role service_role';
  r := r || '1.' || public.next_numero_recu(v_demo, 1890);
  r := r || ',' || public.next_numero_recu(v_demo, 1890);
  v_num := public.next_numero_recu(v_demo, 1890);
  r := r || ',' || v_num || case when v_num = '1890-1000' then '(ok)' else '(KO)' end;
  v_num := public.next_numero_recu(v_demo, 1890);
  r := r || ',' || v_num || case when v_num = '1890-1001' then '(ok)' else '(KO)' end;

  -- 2. Numéros <= 999 inchangés : nouvelle année, départ configuré (1 par défaut) → 001
  v_num := public.next_numero_recu(v_demo, 1891);
  r := r || ' | 2.' || v_num || case when v_num ~ '^1891-[0-9]{3}$' then '(ok)' else '(KO)' end;

  -- 3. Session bénévole : exécution refusée (droits réservés à service_role)
  execute 'reset role';
  perform set_config('request.jwt.claims', json_build_object('sub', v_benevole, 'role', 'authenticated',
    'app_metadata', json_build_object('role', 'benevole', 'organisation_id', v_demo))::text, true);
  execute 'set local role authenticated';
  begin
    perform public.next_numero_recu(v_demo, 1890);
    r := r || ' | 3.benevole=ACCEPTE(KO)';
  exception when insufficient_privilege then r := r || ' | 3.benevole=refuse';
  end;

  raise exception 'RESULTATS: %', r;
end;
$$;
