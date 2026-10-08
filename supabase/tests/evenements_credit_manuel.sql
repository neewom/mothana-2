-- Tests transactionnels de la RPC de crédit manuel. Aucune donnée conservée.
begin;

do $$
begin
  if has_function_privilege('anon', 'public.creer_credit_manuel(uuid,text,integer,uuid)', 'execute')
    or not has_function_privilege('authenticated', 'public.creer_credit_manuel(uuid,text,integer,uuid)', 'execute') then
    raise exception 'TEST: privilèges EXECUTE incorrects';
  end if;
end;
$$;

insert into public.organisations (id, nom, slug, code_pin_benevole, fonctionnalites_activees)
values
  ('12000000-0000-0000-0000-000000000001', 'Crédit manuel A', 'credit-manuel-a', '120001',
    '{"dons":true,"adherents":true,"evenements":true}'),
  ('12000000-0000-0000-0000-000000000002', 'Crédit manuel B', 'credit-manuel-b', '120002',
    '{"dons":true,"adherents":true,"evenements":true}');

insert into auth.users (id, email, role, aud, raw_app_meta_data)
values
  ('22000000-0000-0000-0000-000000000001', 'credit-admin-a@example.test', 'authenticated', 'authenticated', '{}'),
  ('22000000-0000-0000-0000-000000000002', 'credit-admin-b@example.test', 'authenticated', 'authenticated', '{}');

insert into public.profils_organisation (utilisateur_id, organisation_id, nom_affiche, role)
values
  ('22000000-0000-0000-0000-000000000001', '12000000-0000-0000-0000-000000000001', 'Admin crédit A', 'admin'),
  ('22000000-0000-0000-0000-000000000002', '12000000-0000-0000-0000-000000000002', 'Admin crédit B', 'admin');

insert into public.evenements (id, organisation_id, slug, nom, date_evenement, date_fin, statut)
values
  ('32000000-0000-0000-0000-000000000001', '12000000-0000-0000-0000-000000000001',
    'ouvert', 'Événement ouvert', current_date, current_date, 'ouvert'),
  ('32000000-0000-0000-0000-000000000002', '12000000-0000-0000-0000-000000000001',
    'brouillon', 'Événement brouillon', current_date, current_date, 'brouillon'),
  ('32000000-0000-0000-0000-000000000003', '12000000-0000-0000-0000-000000000001',
    'clos', 'Événement clos', current_date, current_date, 'clos'),
  ('32000000-0000-0000-0000-000000000004', '12000000-0000-0000-0000-000000000002',
    'autre-org', 'Événement autre organisation', current_date, current_date, 'ouvert');

insert into public.activites (id, organisation_id, nom, date_debut, date_fin)
values (
  '42000000-0000-0000-0000-000000000001',
  '12000000-0000-0000-0000-000000000001',
  'Activité événement',
  current_date,
  current_date
);

update public.evenements
set activite_id = '42000000-0000-0000-0000-000000000001'
where id = '32000000-0000-0000-0000-000000000001';

do $$
begin
  if (select activite_id from public.evenements
      where id = '32000000-0000-0000-0000-000000000001')
      is distinct from '42000000-0000-0000-0000-000000000001'::uuid then
    raise exception 'TEST: rattachement activité événement incorrect';
  end if;
  delete from public.activites where id = '42000000-0000-0000-0000-000000000001';
  if (select activite_id from public.evenements
      where id = '32000000-0000-0000-0000-000000000001') is not null then
    raise exception 'TEST: suppression activité ne remet pas activite_id à null';
  end if;
end;
$$;

select set_config('request.jwt.claims',
  '{"sub":"22000000-0000-0000-0000-000000000001","role":"authenticated","app_metadata":{}}', true);

-- Le CRUD direct des événements reste limité à l'organisation de l'admin.
set local role authenticated;
insert into public.evenements (organisation_id, slug, nom, date_evenement, date_fin, statut)
values ('12000000-0000-0000-0000-000000000001', 'cree-par-admin', 'Créé par admin', current_date, current_date, 'brouillon');
update public.evenements set statut = 'ouvert'
where organisation_id = '12000000-0000-0000-0000-000000000001' and slug = 'cree-par-admin';
do $$
declare v_affected integer;
begin
  if (select count(*) from public.evenements) <> 4
    or (select statut from public.evenements where slug = 'cree-par-admin') <> 'ouvert' then
    raise exception 'TEST: CRUD événement de l''organisation incorrect';
  end if;
  update public.evenements set nom = 'Interdit'
  where id = '32000000-0000-0000-0000-000000000004';
  get diagnostics v_affected = row_count;
  if v_affected <> 0 then
    raise exception 'TEST: modification inter-organisation autorisée';
  end if;
  begin
    insert into public.evenements (organisation_id, slug, nom, date_evenement, date_fin)
    values ('12000000-0000-0000-0000-000000000002', 'interdit', 'Interdit', current_date, current_date);
    raise exception 'TEST: création inter-organisation autorisée';
  exception when insufficient_privilege then null;
  end;
end;
$$;
reset role;

create temporary table first_credit as
select * from public.creer_credit_manuel(
  '32000000-0000-0000-0000-000000000001', ' Buyer@Example.Test ', 1234
);

create temporary table second_credit as
select * from public.creer_credit_manuel(
  '32000000-0000-0000-0000-000000000001', 'buyer@example.test', 66
);

do $$
declare v_wallet uuid := (select portefeuille_id from first_credit);
begin
  if not (select ok from first_credit) or not (select ok from second_credit) then
    raise exception 'TEST: crédit admin refusé';
  end if;
  if v_wallet is distinct from (select portefeuille_id from second_credit)
    or (select solde_centimes from public.portefeuilles where id = v_wallet) <> 1300 then
    raise exception 'TEST: recharge du portefeuille incorrecte';
  end if;
  if (select count(*) from public.commandes where portefeuille_id = v_wallet
      and moyen_paiement = 'manuel' and statut = 'payee') <> 2 then
    raise exception 'TEST: commandes manuelles incorrectes';
  end if;
  if exists (
    select 1 from public.commandes
    where portefeuille_id = v_wallet
      and reference_paiement !~ '^manuel:22000000-0000-0000-0000-000000000001:'
  ) then
    raise exception 'TEST: référence manuelle non traçable';
  end if;
  if (select count(*) from public.mouvements_portefeuille where portefeuille_id = v_wallet) <> 2
    or exists (select 1 from public.mouvements_portefeuille where portefeuille_id = v_wallet
      and acteur_id <> '22000000-0000-0000-0000-000000000001') then
    raise exception 'TEST: mouvements manuels incorrects';
  end if;
  if exists (select 1 from public.secrets_portefeuille
      where portefeuille_id = v_wallet and secret_hash in (
        (select secret from first_credit), (select secret from second_credit)
      )) then
    raise exception 'TEST: secret stocké en clair';
  end if;
end;
$$;

do $$
begin
  if (select raison from public.creer_credit_manuel(
      '32000000-0000-0000-0000-000000000002', 'buyer@example.test', 100)) <> 'EVENEMENT_NON_OUVERT' then
    raise exception 'TEST: brouillon accepté';
  end if;
  if (select raison from public.creer_credit_manuel(
      '32000000-0000-0000-0000-000000000003', 'buyer@example.test', 100)) <> 'EVENEMENT_CLOS' then
    raise exception 'TEST: événement clos accepté';
  end if;
  if (select raison from public.creer_credit_manuel(
      '32000000-0000-0000-0000-000000000001', 'buyer@example.test', 0)) <> 'MONTANT_INVALIDE' then
    raise exception 'TEST: montant nul accepté';
  end if;
end;
$$;

-- Un admin d'une autre organisation et un bénévole sont refusés par la garde interne.
select set_config('request.jwt.claims',
  '{"sub":"22000000-0000-0000-0000-000000000002","role":"authenticated","app_metadata":{}}', true);
do $$
begin
  begin
    perform public.creer_credit_manuel(
      '32000000-0000-0000-0000-000000000001', 'forbidden@example.test', 100
    );
    raise exception 'TEST: autre organisation autorisée';
  exception when insufficient_privilege then null;
  end;
end;
$$;

select set_config('request.jwt.claims',
  '{"sub":"22000000-0000-0000-0000-000000000003","role":"authenticated","app_metadata":{"role":"benevole","organisation_id":"12000000-0000-0000-0000-000000000001"}}', true);
do $$
begin
  begin
    perform public.creer_credit_manuel(
      '32000000-0000-0000-0000-000000000001', 'benevole@example.test', 100
    );
    raise exception 'TEST: bénévole autorisé';
  exception when insufficient_privilege then null;
  end;
end;
$$;

-- Gel : le portefeuille et son solde restent inchangés.
select set_config('request.jwt.claims',
  '{"sub":"22000000-0000-0000-0000-000000000001","role":"authenticated","app_metadata":{}}', true);
update public.portefeuilles set gele = true where id = (select portefeuille_id from first_credit);
do $$
begin
  if (select raison from public.creer_credit_manuel(
      '32000000-0000-0000-0000-000000000001', 'buyer@example.test', 100)) <> 'PORTEFEUILLE_GELE' then
    raise exception 'TEST: portefeuille gelé crédité';
  end if;
  if (select solde_centimes from public.portefeuilles where id = (select portefeuille_id from first_credit)) <> 1300 then
    raise exception 'TEST: solde gelé modifié';
  end if;
end;
$$;

rollback;
