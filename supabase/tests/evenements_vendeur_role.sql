-- Coupon 13 : le vendeur accède au paiement événement et reste exclu des dons/adhésions.
begin;

insert into public.organisations (
  id, nom, slug, code_pin_benevole, code_pin_vendeur_evenement, fonctionnalites_activees
)
values
  ('13000000-0000-0000-0000-000000000001', 'Vendeur test A', 'vendeur-test-a', '130001', '139001',
    '{"dons":true,"adherents":true,"evenements":true}'),
  ('13000000-0000-0000-0000-000000000002', 'Vendeur test B', 'vendeur-test-b', '130002', '139002',
    '{"dons":true,"adherents":true,"evenements":true}');

insert into auth.users (id, email, role, aud, raw_app_meta_data)
values (
  '23000000-0000-0000-0000-000000000001',
  'vendeur-13000000-0000-0000-0000-000000000001@mothana.internal',
  'authenticated',
  'authenticated',
  '{"role":"vendeur","organisation_id":"13000000-0000-0000-0000-000000000001"}'
);

insert into public.evenements (id, organisation_id, slug, nom, date_evenement, date_fin, statut)
values
  ('33000000-0000-0000-0000-000000000001', '13000000-0000-0000-0000-000000000001',
    'ouvert-a', 'Événement ouvert A', current_date, current_date, 'ouvert'),
  ('33000000-0000-0000-0000-000000000002', '13000000-0000-0000-0000-000000000001',
    'brouillon-a', 'Événement brouillon A', current_date, current_date, 'brouillon'),
  ('33000000-0000-0000-0000-000000000003', '13000000-0000-0000-0000-000000000002',
    'ouvert-b', 'Événement ouvert B', current_date, current_date, 'ouvert');

insert into public.portefeuilles (
  id, organisation_id, evenement_id, email, code_public, solde_centimes
)
values (
  '43000000-0000-0000-0000-000000000001',
  '13000000-0000-0000-0000-000000000001',
  '33000000-0000-0000-0000-000000000001',
  'acheteur@example.test',
  'ABCDEFGH2345',
  1000
);

insert into public.personnes (id, nom)
values
  ('53000000-0000-0000-0000-000000000001', 'Donateur caché'),
  ('53000000-0000-0000-0000-000000000002', 'Nouveau donateur interdit');

insert into public.profils_participant (id, personne_id, organisation_id)
values (
  '63000000-0000-0000-0000-000000000001',
  '53000000-0000-0000-0000-000000000001',
  '13000000-0000-0000-0000-000000000001'
);

insert into public.dons (
  id, profil_participant_id, organisation_id, montant, date, mode_paiement, created_by_role
)
values (
  '73000000-0000-0000-0000-000000000001',
  '63000000-0000-0000-0000-000000000001',
  '13000000-0000-0000-0000-000000000001',
  10,
  current_date,
  3,
  'admin'
);

insert into public.adherents (id, organisation_id, nom)
values (
  '83000000-0000-0000-0000-000000000001',
  '13000000-0000-0000-0000-000000000001',
  'Adhérent caché'
);

insert into public.adhesions (id, adherent_id, date_debut)
values (
  '93000000-0000-0000-0000-000000000001',
  '83000000-0000-0000-0000-000000000001',
  current_date
);

select set_config(
  'request.jwt.claims',
  '{"sub":"23000000-0000-0000-0000-000000000001","role":"authenticated","app_metadata":{"role":"vendeur","organisation_id":"13000000-0000-0000-0000-000000000001"}}',
  true
);
set local role authenticated;

do $$
declare
  v_creation record;
  v_annulation record;
begin
  if public.current_vendeur_organisation_id()
      is distinct from '13000000-0000-0000-0000-000000000001'::uuid then
    raise exception 'TEST: organisation vendeur non résolue';
  end if;

  if public.current_benevole_organisation_id() is not null
      or public.current_effective_organisation_id() is not null then
    raise exception 'TEST: vendeur confondu avec un bénévole/admin';
  end if;

  if (select count(*) from public.evenements) <> 1 then
    raise exception 'TEST: isolation des événements vendeur incorrecte';
  end if;

  select * into v_creation from public.creer_demande_paiement(
    '33000000-0000-0000-0000-000000000001',
    'ABCDEFGH2345',
    250
  );
  if not v_creation.ok or v_creation.demande_id is null then
    raise exception 'TEST: création de demande vendeur refusée';
  end if;

  if (select count(*) from public.demandes_paiement) <> 1 then
    raise exception 'TEST: lecture de la demande vendeur refusée';
  end if;

  select * into v_annulation from public.annuler_demande_paiement(v_creation.demande_id);
  if not v_annulation.ok or v_annulation.statut <> 'annulee' then
    raise exception 'TEST: annulation de demande vendeur refusée';
  end if;

  -- Critère de sécurité : un JWT vendeur ne lit aucune donnée dons/adhésions.
  if (select count(*) from public.dons) <> 0
      or (select count(*) from public.profils_participant) <> 0
      or (select count(*) from public.adherents) <> 0
      or (select count(*) from public.adhesions) <> 0 then
    raise exception 'TEST: fuite de données dons/adhésions vers le vendeur';
  end if;

  -- Les écritures directes restent refusées par les policies existantes.
  begin
    insert into public.profils_participant (personne_id, organisation_id)
    values (
      '53000000-0000-0000-0000-000000000002',
      '13000000-0000-0000-0000-000000000001'
    );
    raise exception 'TEST: création de donateur vendeur autorisée';
  exception when insufficient_privilege then null;
  end;

  begin
    insert into public.dons (
      profil_participant_id, organisation_id, montant, date, mode_paiement, created_by_role
    ) values (
      '63000000-0000-0000-0000-000000000001',
      '13000000-0000-0000-0000-000000000001',
      5,
      current_date,
      3,
      'benevole'
    );
    raise exception 'TEST: création de don vendeur autorisée';
  exception when insufficient_privilege then null;
  end;

  begin
    insert into public.adherents (organisation_id, nom)
    values ('13000000-0000-0000-0000-000000000001', 'Interdit');
    raise exception 'TEST: création d''adhérent vendeur autorisée';
  exception when insufficient_privilege then null;
  end;

  begin
    insert into public.adhesions (adherent_id, date_debut)
    values ('83000000-0000-0000-0000-000000000001', current_date);
    raise exception 'TEST: création d''adhésion vendeur autorisée';
  exception when insufficient_privilege then null;
  end;

  -- Les RPC métier d'import refusent aussi l'absence de contexte admin.
  begin
    perform public.import_upsert_dons('[]'::jsonb, null);
    raise exception 'TEST: RPC dons vendeur autorisée';
  exception when raise_exception then
    if sqlerrm not like 'Unauthorized:%' then raise; end if;
  end;

  begin
    perform public.import_upsert_adherents('[]'::jsonb, null);
    raise exception 'TEST: RPC adhérents vendeur autorisée';
  exception when raise_exception then
    if sqlerrm not like 'Unauthorized:%' then raise; end if;
  end;
end;
$$;

reset role;
rollback;
