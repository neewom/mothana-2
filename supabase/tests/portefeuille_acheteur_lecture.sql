-- Tests transactionnels de Coupon 4. Toutes les fixtures sont annulées à la fin.
begin;

do $$
begin
  if has_table_privilege('anon', 'public.acces_portefeuille_rate_limits', 'select,insert,delete')
    or has_table_privilege('authenticated', 'public.acces_portefeuille_rate_limits', 'select,insert,delete')
    or has_function_privilege('anon', 'public.lire_portefeuille_par_secret_hash(text,text,text)', 'execute')
    or has_function_privilege('authenticated', 'public.resoudre_hash_secret_portefeuille(text)', 'execute')
    or not has_function_privilege('service_role', 'public.lire_portefeuille_par_secret_hash(text,text,text)', 'execute') then
    raise exception 'TEST: privilèges Coupon 4 incorrects';
  end if;
end;
$$;

insert into public.organisations(id, nom, slug, code_pin_benevole, fonctionnalites_activees)
values ('41000000-0000-0000-0000-000000000001', 'Organisation acheteur',
  'organisation-acheteur', '410001', '{"dons":true,"adherents":true,"evenements":true}');

insert into public.evenements(id, organisation_id, slug, nom, date_evenement, date_fin, statut)
values ('42000000-0000-0000-0000-000000000001', '41000000-0000-0000-0000-000000000001',
  'fete-acheteur', 'Fête acheteur', current_date, current_date + 1, 'ouvert');

insert into public.portefeuilles(id, organisation_id, evenement_id, email, code_public, solde_centimes)
values ('43000000-0000-0000-0000-000000000001', '41000000-0000-0000-0000-000000000001',
  '42000000-0000-0000-0000-000000000001', 'acheteur@example.test', 'ABCDEF234567', 1500);

insert into public.commandes(id, organisation_id, evenement_id, email, montant_centimes,
  moyen_paiement, statut, reference_paiement, portefeuille_id)
values ('44000000-0000-0000-0000-000000000001', '41000000-0000-0000-0000-000000000001',
  '42000000-0000-0000-0000-000000000001', 'acheteur@example.test', 1500,
  'manuel', 'payee', 'coupon4-test', '43000000-0000-0000-0000-000000000001');

insert into public.mouvements_portefeuille(organisation_id, portefeuille_id, type,
  montant_centimes, solde_apres_centimes, commande_id)
values ('41000000-0000-0000-0000-000000000001', '43000000-0000-0000-0000-000000000001',
  'credit_initial', 1500, 1500, '44000000-0000-0000-0000-000000000001');

insert into public.secrets_portefeuille(organisation_id, portefeuille_id, secret_hash)
values ('41000000-0000-0000-0000-000000000001', '43000000-0000-0000-0000-000000000001',
  encode(sha256(convert_to(repeat('a', 64), 'UTF8')), 'hex'));

do $$
declare
  v_hash text := encode(sha256(convert_to(repeat('a', 64), 'UTF8')), 'hex');
  v_result jsonb;
begin
  if not exists (select 1 from public.resoudre_secret_portefeuille(repeat('a', 64)))
    or not exists (select 1 from public.resoudre_hash_secret_portefeuille(v_hash)) then
    raise exception 'TEST: résolution centralisée cassée';
  end if;

  v_result := public.lire_portefeuille_par_secret_hash(v_hash, repeat('1', 64), 'etat');
  if not (v_result->>'ok')::boolean
    or v_result #>> '{portefeuille,codePublic}' <> 'ABCDEF234567'
    or (v_result #>> '{portefeuille,soldeCentimes}')::integer <> 1500
    or jsonb_array_length(v_result->'mouvements') <> 1
    or v_result #>> '{evenement,nom}' <> 'Fête acheteur' then
    raise exception 'TEST: état acheteur incorrect: %', v_result;
  end if;

  v_result := public.lire_portefeuille_par_secret_hash(repeat('f', 64), repeat('2', 64), 'etat');
  if v_result->>'reason' <> 'ACCES_INVALIDE' then
    raise exception 'TEST: secret invalide distinguable';
  end if;

  update public.evenements set statut = 'clos'
  where id = '42000000-0000-0000-0000-000000000001';
  v_result := public.lire_portefeuille_par_secret_hash(v_hash, repeat('3', 64), 'etat');
  if v_result #>> '{evenement,statut}' <> 'clos' then
    raise exception 'TEST: portefeuille clos illisible';
  end if;

  update public.organisations
  set fonctionnalites_activees = fonctionnalites_activees || '{"evenements":false}'::jsonb
  where id = '41000000-0000-0000-0000-000000000001';
  v_result := public.lire_portefeuille_par_secret_hash(v_hash, repeat('4', 64), 'etat');
  if v_result->>'reason' <> 'ACCES_INVALIDE' then
    raise exception 'TEST: flag module non vérifié';
  end if;
end;
$$;

update public.organisations
set fonctionnalites_activees = fonctionnalites_activees || '{"evenements":true}'::jsonb
where id = '41000000-0000-0000-0000-000000000001';

do $$
declare
  v_hash text := encode(sha256(convert_to(repeat('a', 64), 'UTF8')), 'hex');
  v_result jsonb;
begin
  for i in 1..7 loop
    v_result := public.lire_portefeuille_par_secret_hash(v_hash, repeat('5', 64), 'pdf');
  end loop;
  if v_result->>'reason' <> 'RATE_LIMIT' then
    raise exception 'TEST: limite PDF par IP absente';
  end if;

  update public.secrets_portefeuille set revoque_le = clock_timestamp()
  where portefeuille_id = '43000000-0000-0000-0000-000000000001';
  v_result := public.lire_portefeuille_par_secret_hash(v_hash, repeat('6', 64), 'etat');
  if v_result->>'reason' <> 'ACCES_INVALIDE' then
    raise exception 'TEST: secret révoqué encore lisible';
  end if;
end;
$$;

rollback;
