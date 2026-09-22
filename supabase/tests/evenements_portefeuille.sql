-- Tests transactionnels de Coupon 1. Toutes les données sont annulées à la fin.
begin;

do $$
begin
  if exists (
    select 1 from public.audit_missing_super_admin_bypass()
    where tablename in ('evenements', 'commandes', 'portefeuilles', 'secrets_portefeuille',
      'demandes_paiement', 'mouvements_portefeuille')
  ) then
    raise exception 'TEST: bypass super-admin absent d''une policy';
  end if;
  if has_table_privilege('anon', 'public.evenements', 'select')
    or has_table_privilege('anon', 'public.commandes', 'insert')
    or has_table_privilege('authenticated', 'public.commandes', 'insert,update,delete') then
    raise exception 'TEST: privilèges de table trop larges';
  end if;
  if not has_function_privilege('anon', 'public.get_evenement_public(text,text)', 'execute')
    or has_function_privilege('anon', 'public.creer_commande_en_attente(uuid,text,integer,text,uuid)', 'execute')
    or has_function_privilege('authenticated', 'public.activer_commande(uuid,text)', 'execute')
    or not has_function_privilege('service_role', 'public.activer_commande(uuid,text)', 'execute') then
    raise exception 'TEST: privilèges EXECUTE incorrects';
  end if;
end;
$$;

insert into public.organisations (id, nom, slug, code_pin_benevole, fonctionnalites_activees)
values
  ('10000000-0000-0000-0000-000000000001', 'Wallet test A', 'wallet-test-a', '100001',
    '{"dons":true,"adherents":true,"evenements":true}'),
  ('10000000-0000-0000-0000-000000000002', 'Wallet test B', 'wallet-test-b', '100002',
    '{"dons":true,"adherents":true,"evenements":true}');

insert into auth.users (id, email, role, aud, raw_app_meta_data)
values
  ('20000000-0000-0000-0000-000000000001', 'wallet-admin-a@example.test', 'authenticated', 'authenticated', '{}'),
  ('20000000-0000-0000-0000-000000000002', 'wallet-admin-b@example.test', 'authenticated', 'authenticated', '{}');

insert into public.profils_organisation (utilisateur_id, organisation_id, nom_affiche, role)
values
  ('20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'Admin A', 'admin'),
  ('20000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000002', 'Admin B', 'admin');

insert into public.evenements (id, organisation_id, slug, nom, date_evenement, statut)
values
  ('30000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001',
    'fete-a', 'Fête A', current_date, 'ouvert'),
  ('30000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000002',
    'fete-b', 'Fête B', current_date, 'ouvert');

do $$
begin
  begin
    insert into public.portefeuilles (organisation_id, evenement_id, email)
    values ('10000000-0000-0000-0000-000000000002',
      '30000000-0000-0000-0000-000000000001', 'tenant-mismatch@example.test');
    raise exception 'TEST: référence inter-organisation acceptée';
  exception when foreign_key_violation then
    null;
  end;
end;
$$;

-- Idempotence de création et normalisation de l'email.
select public.creer_commande_en_attente(
  '30000000-0000-0000-0000-000000000001', '  Buyer@Example.Test ', 1000, 'idem-1'
);
select public.creer_commande_en_attente(
  '30000000-0000-0000-0000-000000000001', 'buyer@example.test', 1000, 'idem-1'
);

do $$
begin
  if (select count(*) from public.commandes where cle_idempotence = 'idem-1') <> 1 then
    raise exception 'TEST: la commande idempotente a été dupliquée';
  end if;
end;
$$;

create temporary table wallet_activation as
select * from public.activer_commande(
  (select id from public.commandes where cle_idempotence = 'idem-1'), 'payment-1'
);
grant select on wallet_activation to authenticated;

-- Un second appel ne recrédite pas et ne révèle plus le secret.
select public.activer_commande(
  (select id from public.commandes where cle_idempotence = 'idem-1'), 'payment-1'
);

do $$
declare
  v_wallet uuid := (select portefeuille_id from wallet_activation);
  v_secret text := (select secret from wallet_activation);
begin
  if v_secret is null or length(v_secret) < 32 then
    raise exception 'TEST: secret absent';
  end if;
  if (select count(*) from public.mouvements_portefeuille where portefeuille_id = v_wallet) <> 1 then
    raise exception 'TEST: activation non idempotente';
  end if;
  if exists (select 1 from public.secrets_portefeuille where secret_hash = v_secret) then
    raise exception 'TEST: secret stocké en clair';
  end if;
  if not exists (select 1 from public.resoudre_secret_portefeuille(v_secret)) then
    raise exception 'TEST: secret valide non résolu';
  end if;
end;
$$;

-- Recharge : même email et même événement => même portefeuille.
select public.creer_commande_en_attente(
  '30000000-0000-0000-0000-000000000001', 'buyer@example.test', 500, 'idem-2'
);
select public.activer_commande(
  (select id from public.commandes where cle_idempotence = 'idem-2'), 'payment-2'
);

do $$
declare
  v_wallet uuid := (select portefeuille_id from wallet_activation);
begin
  if (select count(*) from public.portefeuilles where evenement_id = '30000000-0000-0000-0000-000000000001') <> 1
    or (select solde_centimes from public.portefeuilles where id = v_wallet) <> 1500
    or (select count(*) from public.mouvements_portefeuille where portefeuille_id = v_wallet) <> 2 then
    raise exception 'TEST: recharge incorrecte';
  end if;
end;
$$;

-- Un second secret n'invalide pas le premier ; la révocation invalide les deux.
create temporary table wallet_second_secret as
select public.ajouter_secret_portefeuille((select portefeuille_id from wallet_activation)) as secret;

do $$
declare
  v_first text := (select secret from wallet_activation);
  v_second text := (select secret from wallet_second_secret);
begin
  if not exists (select 1 from public.resoudre_secret_portefeuille(v_first))
    or not exists (select 1 from public.resoudre_secret_portefeuille(v_second))
    or exists (select 1 from public.resoudre_secret_portefeuille('mauvais-secret')) then
    raise exception 'TEST: cycle des secrets incorrect';
  end if;
end;
$$;

-- RLS admin : A ne voit jamais B.
select set_config('request.jwt.claims',
  '{"sub":"20000000-0000-0000-0000-000000000001","role":"authenticated","app_metadata":{}}', true);
set local role authenticated;
do $$
begin
  if (select count(*) from public.evenements) <> 1 then
    raise exception 'TEST: isolation admin multi-tenant incorrecte';
  end if;
end;
$$;
reset role;

-- Le vendeur authentifié peut créer une demande, mais ne lit pas le portefeuille.
select set_config('request.jwt.claims',
  '{"sub":"20000000-0000-0000-0000-000000000003","role":"authenticated","app_metadata":{"role":"benevole","organisation_id":"10000000-0000-0000-0000-000000000001"}}', true);
create temporary table wallet_request as
select * from public.creer_demande_paiement(
  '30000000-0000-0000-0000-000000000001',
  (select code_public from wallet_activation),
  400
);
do $$
begin
  if not (select ok from wallet_request) then
    raise exception 'TEST: création de demande bénévole refusée';
  end if;
end;
$$;
set local role authenticated;
do $$
begin
  if (select count(*) from public.portefeuilles) <> 0
    or (select count(*) from public.commandes) <> 0
    or (select count(*) from public.secrets_portefeuille) <> 0
    or (select count(*) from public.mouvements_portefeuille) <> 0
    or (select count(*) from public.demandes_paiement) <> 1 then
    raise exception 'TEST: lecture bénévole incorrecte';
  end if;
end;
$$;
reset role;

-- Décision atomique et idempotente : un seul débit.
select public.decider_demande_paiement(
  (select portefeuille_id from wallet_activation), (select demande_id from wallet_request), true
);
select public.decider_demande_paiement(
  (select portefeuille_id from wallet_activation), (select demande_id from wallet_request), true
);
do $$
declare v_wallet uuid := (select portefeuille_id from wallet_activation);
begin
  if (select solde_centimes from public.portefeuilles where id = v_wallet) <> 1100
    or (select count(*) from public.mouvements_portefeuille where portefeuille_id = v_wallet and type = 'debit') <> 1 then
    raise exception 'TEST: débit non atomique/idempotent';
  end if;
end;
$$;

-- Une demande expirée est libérée et ne peut plus être décidée.
insert into public.demandes_paiement
  (organisation_id, portefeuille_id, montant_centimes, statut, expire_le, cree_par)
values
  ('10000000-0000-0000-0000-000000000001', (select portefeuille_id from wallet_activation),
    100, 'en_attente', clock_timestamp() - interval '1 second', '20000000-0000-0000-0000-000000000001');

select set_config('request.jwt.claims',
  '{"sub":"20000000-0000-0000-0000-000000000003","role":"authenticated","app_metadata":{"role":"benevole","organisation_id":"10000000-0000-0000-0000-000000000001"}}', true);
create temporary table wallet_request_after_expiry as
select * from public.creer_demande_paiement(
  '30000000-0000-0000-0000-000000000001',
  (select code_public from wallet_activation),
  100
);

do $$
begin
  if not (select ok from wallet_request_after_expiry)
    or (select count(*) from public.demandes_paiement where statut = 'expiree') <> 1 then
    raise exception 'TEST: remplacement après expiration incorrect';
  end if;
end;
$$;

-- Le journal est en ajout seul.
do $$
begin
  begin
    update public.mouvements_portefeuille set montant_centimes = 1 where portefeuille_id = (select portefeuille_id from wallet_activation);
    raise exception 'TEST: mise à jour du journal autorisée';
  exception when raise_exception then
    if sqlerrm <> 'JOURNAL_IMMUABLE' then raise; end if;
  end;
  begin
    delete from public.mouvements_portefeuille where portefeuille_id = (select portefeuille_id from wallet_activation);
    raise exception 'TEST: suppression du journal autorisée';
  exception when raise_exception then
    if sqlerrm <> 'JOURNAL_IMMUABLE' then raise; end if;
  end;
end;
$$;

-- Après clôture, toutes les RPC d'écriture liées à l'événement refusent.
update public.evenements set statut = 'clos' where id = '30000000-0000-0000-0000-000000000001';
do $$
begin
  begin
    perform public.creer_commande_en_attente(
      '30000000-0000-0000-0000-000000000001', 'closed@example.test', 500, 'closed'
    );
    raise exception 'TEST: commande acceptée après clôture';
  exception when raise_exception then
    if sqlerrm <> 'EVENEMENT_CLOS' then raise; end if;
  end;
  if (select raison from public.decider_demande_paiement(
    (select portefeuille_id from wallet_activation),
    (select demande_id from wallet_request_after_expiry), true
  )) <> 'EVENEMENT_CLOS' then
    raise exception 'TEST: décision acceptée après clôture';
  end if;
end;
$$;

-- Le public ne voit que l'événement ouvert avec flag actif.
do $$
begin
  if exists (select 1 from public.get_evenement_public('wallet-test-a', 'fete-a')) then
    raise exception 'TEST: événement clos exposé publiquement';
  end if;
  if not exists (select 1 from public.get_evenement_public('wallet-test-b', 'fete-b')) then
    raise exception 'TEST: événement public ouvert absent';
  end if;
end;
$$;

-- Les secrets révoqués ne se résolvent plus.
select set_config('request.jwt.claims',
  '{"sub":"20000000-0000-0000-0000-000000000001","role":"authenticated","app_metadata":{}}', true);
set local role authenticated;
select public.revoquer_secrets_portefeuille((select portefeuille_id from wallet_activation));
reset role;
do $$
begin
  if exists (select 1 from public.resoudre_secret_portefeuille((select secret from wallet_activation))) then
    raise exception 'TEST: secret révoqué encore résolu';
  end if;
end;
$$;

rollback;
