-- Tests transactionnels Coupon 9 — renvoi d'accès par un admin.
begin;

do $$
begin
  if has_function_privilege(
      'anon',
      'public.renvoyer_acces_portefeuille(uuid,text,boolean)',
      'execute'
    )
    or not has_function_privilege(
      'authenticated',
      'public.renvoyer_acces_portefeuille(uuid,text,boolean)',
      'execute'
    ) then
    raise exception 'TEST: privilèges EXECUTE incorrects';
  end if;
end;
$$;

insert into public.organisations (id, nom, slug, code_pin_benevole, fonctionnalites_activees)
values
  ('91000000-0000-0000-0000-000000000001', 'Renvoi accès A', 'renvoi-acces-a', '910001',
    '{"dons":true,"adherents":true,"evenements":true}'),
  ('91000000-0000-0000-0000-000000000002', 'Renvoi accès B', 'renvoi-acces-b', '910002',
    '{"dons":true,"adherents":true,"evenements":true}');

insert into auth.users (id, email, role, aud, raw_app_meta_data)
values
  ('92000000-0000-0000-0000-000000000001', 'contributeur-renvoi@example.test', 'authenticated', 'authenticated', '{}'),
  ('92000000-0000-0000-0000-000000000002', 'admin-renvoi@example.test', 'authenticated', 'authenticated', '{}'),
  ('92000000-0000-0000-0000-000000000003', 'autre-admin-renvoi@example.test', 'authenticated', 'authenticated', '{}'),
  ('92000000-0000-0000-0000-000000000004', 'super-admin-renvoi@example.test', 'authenticated', 'authenticated',
    '{"is_super_admin":true}');

insert into public.profils_organisation (utilisateur_id, organisation_id, nom_affiche, role)
values
  ('92000000-0000-0000-0000-000000000001', '91000000-0000-0000-0000-000000000001', 'Contributeur A', 'contributeur'),
  ('92000000-0000-0000-0000-000000000002', '91000000-0000-0000-0000-000000000001', 'Admin A', 'admin'),
  ('92000000-0000-0000-0000-000000000003', '91000000-0000-0000-0000-000000000002', 'Admin B', 'admin');

insert into public.evenements (id, organisation_id, slug, nom, date_evenement, date_fin, statut)
values
  ('93000000-0000-0000-0000-000000000001', '91000000-0000-0000-0000-000000000001',
    'evenement-clos', 'Événement clos', current_date - 1, current_date, 'clos'),
  ('93000000-0000-0000-0000-000000000002', '91000000-0000-0000-0000-000000000002',
    'evenement-b', 'Événement B', current_date, current_date, 'ouvert');

insert into public.portefeuilles
  (id, organisation_id, evenement_id, email, code_public, solde_centimes, gele)
values
  ('94000000-0000-0000-0000-000000000001', '91000000-0000-0000-0000-000000000001',
    '93000000-0000-0000-0000-000000000001', 'ancienne@example.test', 'AAAAAA2222', 1500, true),
  ('94000000-0000-0000-0000-000000000002', '91000000-0000-0000-0000-000000000001',
    '93000000-0000-0000-0000-000000000001', 'collision@example.test', 'BBBBBB3333', 500, false),
  ('94000000-0000-0000-0000-000000000003', '91000000-0000-0000-0000-000000000002',
    '93000000-0000-0000-0000-000000000002', 'autre-org@example.test', 'CCCCCC4444', 800, false);

create temporary table initial_secret as
select public.ajouter_secret_portefeuille('94000000-0000-0000-0000-000000000001') as secret;

do $$
begin
  if exists (
    select 1 from public.secrets_portefeuille
    where portefeuille_id = '94000000-0000-0000-0000-000000000001'
      and cree_par is not null
  ) then
    raise exception 'TEST: un secret créé hors renvoi est attribué à un admin';
  end if;
end;
$$;

create temporary table resend_result (
  secret text,
  secret_id uuid,
  email text,
  evenement_nom text,
  organisation_nom text
);
grant select, insert, delete on resend_result to authenticated;

-- Le contributeur peut corriger l'adresse sur un portefeuille gelé et un
-- événement clos, sans révoquer le lien existant.
select set_config('request.jwt.claims',
  '{"sub":"92000000-0000-0000-0000-000000000001","role":"authenticated","app_metadata":{}}', true);
set local role authenticated;
insert into resend_result
select * from public.renvoyer_acces_portefeuille(
  '94000000-0000-0000-0000-000000000001',
  '  Nouvelle@Example.Test ',
  false
);
reset role;

do $$
declare
  v_old_secret text := (select secret from initial_secret);
  v_new_secret text := (select secret from resend_result limit 1);
begin
  if (select email from resend_result limit 1) <> 'nouvelle@example.test'
    or (select evenement_nom from resend_result limit 1) <> 'Événement clos'
    or (select organisation_nom from resend_result limit 1) <> 'Renvoi accès A' then
    raise exception 'TEST: retour de la RPC incorrect';
  end if;
  if (select email from public.portefeuilles where id = '94000000-0000-0000-0000-000000000001')
      <> 'nouvelle@example.test'
    or (select email_modifie_par from public.portefeuilles where id = '94000000-0000-0000-0000-000000000001')
      <> '92000000-0000-0000-0000-000000000001'
    or (select email_modifie_le from public.portefeuilles where id = '94000000-0000-0000-0000-000000000001') is null then
    raise exception 'TEST: correction de l''email non tracée';
  end if;
  if not exists (select 1 from public.resoudre_secret_portefeuille(v_old_secret))
    or not exists (select 1 from public.resoudre_secret_portefeuille(v_new_secret)) then
    raise exception 'TEST: révocation implicite ou nouveau secret invalide';
  end if;
  if not exists (
    select 1 from public.secrets_portefeuille
    where id = (select secret_id from resend_result limit 1)
      and cree_par = '92000000-0000-0000-0000-000000000001'
  ) then
    raise exception 'TEST: créateur du secret absent';
  end if;
end;
$$;

-- L'admin peut renvoyer sans changer l'adresse et demander la révocation.
delete from resend_result;
select set_config('request.jwt.claims',
  '{"sub":"92000000-0000-0000-0000-000000000002","role":"authenticated","app_metadata":{}}', true);
set local role authenticated;
insert into resend_result
select * from public.renvoyer_acces_portefeuille(
  '94000000-0000-0000-0000-000000000001', null, true
);
reset role;

do $$
declare v_new_secret text := (select secret from resend_result limit 1);
begin
  if (select count(*) from public.secrets_portefeuille
      where portefeuille_id = '94000000-0000-0000-0000-000000000001'
        and revoque_le is null) <> 1
    or not exists (select 1 from public.resoudre_secret_portefeuille(v_new_secret)) then
    raise exception 'TEST: révocation optionnelle incorrecte';
  end if;
  if (select cree_par from public.secrets_portefeuille
      where id = (select secret_id from resend_result limit 1))
      <> '92000000-0000-0000-0000-000000000002' then
    raise exception 'TEST: renvoi admin non tracé';
  end if;
end;
$$;

-- Une collision refuse toute la transaction : ni email ni secret nouveau.
do $$
declare v_before integer := (select count(*) from public.secrets_portefeuille);
begin
  begin
    perform public.renvoyer_acces_portefeuille(
      '94000000-0000-0000-0000-000000000001', 'collision@example.test', false
    );
    raise exception 'TEST: collision email acceptée';
  exception when unique_violation then
    if sqlerrm <> 'EMAIL_DEJA_UTILISE' then raise; end if;
  end;
  if (select email from public.portefeuilles where id = '94000000-0000-0000-0000-000000000001')
      <> 'nouvelle@example.test'
    or (select count(*) from public.secrets_portefeuille) <> v_before then
    raise exception 'TEST: collision non atomique';
  end if;
end;
$$;

-- Un admin d'une autre organisation et un compte PIN sont refusés.
select set_config('request.jwt.claims',
  '{"sub":"92000000-0000-0000-0000-000000000003","role":"authenticated","app_metadata":{}}', true);
do $$
begin
  begin
    perform public.renvoyer_acces_portefeuille(
      '94000000-0000-0000-0000-000000000001', null, false
    );
    raise exception 'TEST: autre organisation autorisée';
  exception when insufficient_privilege then null;
  end;
end;
$$;

select set_config('request.jwt.claims',
  '{"sub":"92000000-0000-0000-0000-000000000099","role":"authenticated","app_metadata":{"role":"benevole","organisation_id":"91000000-0000-0000-0000-000000000001"}}', true);
do $$
begin
  begin
    perform public.renvoyer_acces_portefeuille(
      '94000000-0000-0000-0000-000000000001', null, false
    );
    raise exception 'TEST: compte PIN autorisé';
  exception when insufficient_privilege then null;
  end;
end;
$$;

-- Le super-admin conserve le bypass multi-organisation.
delete from resend_result;
select set_config('request.jwt.claims',
  '{"sub":"92000000-0000-0000-0000-000000000004","role":"authenticated","app_metadata":{"is_super_admin":true}}', true);
set local role authenticated;
insert into resend_result
select * from public.renvoyer_acces_portefeuille(
  '94000000-0000-0000-0000-000000000003', null, false
);
reset role;

do $$
begin
  if (select email from resend_result limit 1) <> 'autre-org@example.test' then
    raise exception 'TEST: bypass super-admin refusé';
  end if;
end;
$$;

rollback;
