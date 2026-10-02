-- Tests transactionnels Coupon 9 : récupération du lien et non-énumération.
begin;

do $$
begin
  if has_function_privilege(
      'anon',
      'public.demander_lien_portefeuille(uuid,text,text)',
      'execute'
    )
    or has_function_privilege(
      'authenticated',
      'public.demander_lien_portefeuille(uuid,text,text)',
      'execute'
    )
    or not has_function_privilege(
      'service_role',
      'public.demander_lien_portefeuille(uuid,text,text)',
      'execute'
    ) then
    raise exception 'TEST: privilèges récupération incorrects';
  end if;
end;
$$;

insert into public.organisations(id, nom, slug, code_pin_benevole, fonctionnalites_activees)
values (
  '91000000-0000-0000-0000-000000000001',
  'Organisation récupération',
  'organisation-recuperation',
  '910001',
  '{"dons":true,"adherents":true,"evenements":true}'
);

insert into public.evenements(
  id, organisation_id, slug, nom, date_evenement, date_fin, statut
)
values (
  '92000000-0000-0000-0000-000000000001',
  '91000000-0000-0000-0000-000000000001',
  'fete-recuperation',
  'Fête récupération',
  current_date,
  current_date + 1,
  'ouvert'
);

insert into public.portefeuilles(
  id, organisation_id, evenement_id, email, code_public, solde_centimes
)
values
  (
    '93000000-0000-0000-0000-000000000001',
    '91000000-0000-0000-0000-000000000001',
    '92000000-0000-0000-0000-000000000001',
    'acheteur@example.test',
    'ABCDEF234567',
    1500
  ),
  (
    '93000000-0000-0000-0000-000000000002',
    '91000000-0000-0000-0000-000000000001',
    '92000000-0000-0000-0000-000000000001',
    'autre@example.test',
    'ABCDEF234568',
    500
  );

insert into public.secrets_portefeuille(
  organisation_id, portefeuille_id, secret_hash
)
values
  (
    '91000000-0000-0000-0000-000000000001',
    '93000000-0000-0000-0000-000000000001',
    encode(sha256(convert_to(repeat('a', 64), 'UTF8')), 'hex')
  ),
  (
    '91000000-0000-0000-0000-000000000001',
    '93000000-0000-0000-0000-000000000002',
    encode(sha256(convert_to(repeat('b', 64), 'UTF8')), 'hex')
  );

create temporary table recovery_known as
select public.demander_lien_portefeuille(
  '92000000-0000-0000-0000-000000000001',
  ' Acheteur@Example.Test ',
  repeat('1', 64)
) as result;

create temporary table recovery_unknown as
select public.demander_lien_portefeuille(
  '92000000-0000-0000-0000-000000000001',
  'inconnu@example.test',
  repeat('2', 64)
) as result;

do $$
declare
  v_known jsonb := (select result from recovery_known);
  v_unknown jsonb := (select result from recovery_unknown);
  v_new_secret text := v_known ->> 'secret';
begin
  if (select array_agg(key order by key) from jsonb_object_keys(v_known) key)
      is distinct from
      (select array_agg(key order by key) from jsonb_object_keys(v_unknown) key) then
    raise exception 'TEST: formes de réponse différentes entre email connu et inconnu';
  end if;

  if v_known ->> 'ok' <> 'true'
    or length(v_new_secret) <> 64
    or v_known ->> 'envoi_id' is null
    or v_known ->> 'evenement_nom' <> 'Fête récupération'
    or v_known ->> 'organisation_nom' <> 'Organisation récupération' then
    raise exception 'TEST: résultat de récupération connu incomplet';
  end if;

  if v_unknown ->> 'ok' <> 'true'
    or v_unknown ->> 'secret' is not null
    or v_unknown ->> 'envoi_id' is not null then
    raise exception 'TEST: réponse inconnue révélatrice';
  end if;

  if (select count(*) from public.secrets_portefeuille
      where portefeuille_id = '93000000-0000-0000-0000-000000000001') <> 2 then
    raise exception 'TEST: le nouveau secret n''a pas été ajouté';
  end if;

  if not exists (
      select 1 from public.resoudre_secret_portefeuille(repeat('a', 64))
      where portefeuille_id = '93000000-0000-0000-0000-000000000001'
    )
    or not exists (
      select 1 from public.resoudre_secret_portefeuille(v_new_secret)
      where portefeuille_id = '93000000-0000-0000-0000-000000000001'
    ) then
    raise exception 'TEST: ancien ou nouveau secret invalide';
  end if;

  if (select count(*) from public.acces_portefeuille_rate_limits
      where scope = 'recuperation' and ip_hash = repeat('2', 64)
        and portefeuille_id is null) <> 1 then
    raise exception 'TEST: la tentative inconnue n''est pas comptée';
  end if;
end;
$$;

-- Le délai minimal est commun au portefeuille, même depuis une autre IP.
create temporary table recovery_too_soon as
select public.demander_lien_portefeuille(
  '92000000-0000-0000-0000-000000000001',
  'acheteur@example.test',
  repeat('3', 64)
) as result;

do $$
begin
  if (select result ->> 'secret' from recovery_too_soon) is not null
    or (select count(*) from public.secrets_portefeuille
      where portefeuille_id = '93000000-0000-0000-0000-000000000001') <> 2 then
    raise exception 'TEST: délai minimal non appliqué';
  end if;
end;
$$;

update public.acces_portefeuille_rate_limits
set created_at = created_at - interval '3 minutes'
where scope = 'recuperation'
  and portefeuille_id = '93000000-0000-0000-0000-000000000001';

create temporary table recovery_after_delay as
select public.demander_lien_portefeuille(
  '92000000-0000-0000-0000-000000000001',
  'acheteur@example.test',
  repeat('4', 64)
) as result;

do $$
begin
  if (select result ->> 'secret' from recovery_after_delay) is null
    or (select count(*) from public.secrets_portefeuille
      where portefeuille_id = '93000000-0000-0000-0000-000000000001') <> 3 then
    raise exception 'TEST: renvoi après délai impossible';
  end if;
end;
$$;

-- Trois envois par heure sont autorisés ; le quatrième est bloqué même si le
-- délai minimal de deux minutes est écoulé.
update public.acces_portefeuille_rate_limits
set created_at = created_at - interval '3 minutes'
where scope = 'recuperation'
  and portefeuille_id = '93000000-0000-0000-0000-000000000001';

create temporary table recovery_third_send as
select public.demander_lien_portefeuille(
  '92000000-0000-0000-0000-000000000001',
  'acheteur@example.test',
  repeat('7', 64)
) as result;

update public.acces_portefeuille_rate_limits
set created_at = created_at - interval '3 minutes'
where scope = 'recuperation'
  and portefeuille_id = '93000000-0000-0000-0000-000000000001';

create temporary table recovery_wallet_limited as
select public.demander_lien_portefeuille(
  '92000000-0000-0000-0000-000000000001',
  'acheteur@example.test',
  repeat('8', 64)
) as result;

do $$
begin
  if (select result ->> 'secret' from recovery_third_send) is null
    or (select result ->> 'secret' from recovery_wallet_limited) is not null
    or (select count(*) from public.secrets_portefeuille
      where portefeuille_id = '93000000-0000-0000-0000-000000000001') <> 4 then
    raise exception 'TEST: limite portefeuille incorrecte';
  end if;
end;
$$;

-- Six tentatives inconnues consomment la limite IP ; la septième, même connue,
-- reste générique et ne crée aucun secret.
select public.demander_lien_portefeuille(
  '92000000-0000-0000-0000-000000000001',
  'inconnu-' || attempt || '@example.test',
  repeat('5', 64)
)
from generate_series(1, 6) attempt;

create temporary table recovery_ip_limited as
select public.demander_lien_portefeuille(
  '92000000-0000-0000-0000-000000000001',
  'autre@example.test',
  repeat('5', 64)
) as result;

do $$
begin
  if (select result ->> 'secret' from recovery_ip_limited) is not null
    or (select count(*) from public.secrets_portefeuille
      where portefeuille_id = '93000000-0000-0000-0000-000000000002') <> 1
    or (select count(*) from public.acces_portefeuille_rate_limits
      where scope = 'recuperation' and ip_hash = repeat('5', 64)) <> 7 then
    raise exception 'TEST: limite IP incorrecte';
  end if;
end;
$$;

-- Sans le flag, aucun secret et aucune entrée de compteur ne sont créés.
update public.organisations
set fonctionnalites_activees = jsonb_set(
  fonctionnalites_activees,
  '{evenements}',
  'false'::jsonb
)
where id = '91000000-0000-0000-0000-000000000001';

create temporary table recovery_disabled as
select public.demander_lien_portefeuille(
  '92000000-0000-0000-0000-000000000001',
  'autre@example.test',
  repeat('6', 64)
) as result;

do $$
begin
  if (select result ->> 'secret' from recovery_disabled) is not null
    or exists (
      select 1 from public.acces_portefeuille_rate_limits
      where scope = 'recuperation' and ip_hash = repeat('6', 64)
    ) then
    raise exception 'TEST: organisation désactivée avec effet de bord';
  end if;
end;
$$;

rollback;
