-- Coupon 1 — RPC du porte-monnaie (après evenements_portefeuille_tables.sql).
-- Ordre de verrouillage : événement SHARE, commande UPDATE (activation),
-- portefeuille UPDATE, demande UPDATE. SHARE interdit une clôture concurrente
-- tout en permettant des transactions sur des portefeuilles différents.
-- clock_timestamp() mesure les délais après attente des verrous.
begin;

create or replace function public.get_evenement_public(p_org_slug text, p_slug text)
returns table (id uuid, nom text, date_evenement date, montants_credit_centimes integer[], nom_organisation text)
language sql stable security definer set search_path = public, pg_temp as $$
  select e.id, e.nom, e.date_evenement, e.montants_credit_centimes, o.nom
  from public.evenements e join public.organisations o on o.id = e.organisation_id
  where o.slug = p_org_slug and e.slug = p_slug and e.statut = 'ouvert'
    and o.fonctionnalites_activees -> 'evenements' = 'true'::jsonb;
$$;
revoke execute on function public.get_evenement_public(text, text) from public, anon, authenticated;
grant execute on function public.get_evenement_public(text, text) to anon, authenticated, service_role;

create or replace function public.creer_commande_en_attente(
  p_evenement_id uuid, p_email text, p_montant_centimes integer,
  p_cle_idempotence text, p_portefeuille_id uuid default null
)
returns public.commandes
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_event public.evenements;
  v_wallet public.portefeuilles;
  v_order public.commandes;
  v_email text := lower(btrim(p_email));
begin
  select * into v_event from public.evenements where id = p_evenement_id for share;
  if not found then raise exception 'EVENEMENT_INTROUVABLE'; end if;
  if v_event.statut = 'clos' then raise exception 'EVENEMENT_CLOS'; end if;
  if v_event.statut <> 'ouvert' then raise exception 'EVENEMENT_NON_OUVERT'; end if;
  if not exists (select 1 from public.organisations o where o.id = v_event.organisation_id
    and o.fonctionnalites_activees -> 'evenements' = 'true'::jsonb) then
    raise exception 'MODULE_DESACTIVE';
  end if;
  if p_portefeuille_id is not null then
    select * into v_wallet from public.portefeuilles where id = p_portefeuille_id for update;
    if not found then raise exception 'PORTEFEUILLE_INTROUVABLE'; end if;
    if v_wallet.evenement_id <> v_event.id then raise exception 'AUTRE_EVENEMENT'; end if;
    v_email := v_wallet.email;
  end if;
  if v_email is null or v_email !~ '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$' then
    raise exception 'EMAIL_INVALIDE';
  end if;
  if p_montant_centimes is null or not (p_montant_centimes = any(v_event.montants_credit_centimes)) then
    raise exception 'MONTANT_INVALIDE';
  end if;
  if p_cle_idempotence is not null and btrim(p_cle_idempotence) = '' then
    raise exception 'CLE_IDEMPOTENCE_INVALIDE';
  end if;
  -- ON CONFLICT attend aussi une insertion concurrente de la même clé.
  insert into public.commandes(organisation_id, evenement_id, email, montant_centimes,
    cle_idempotence, portefeuille_id, expire_le)
  values (v_event.organisation_id, v_event.id, v_email, p_montant_centimes,
    p_cle_idempotence, p_portefeuille_id, clock_timestamp() + interval '30 minutes')
  on conflict (cle_idempotence) do nothing returning * into v_order;
  if not found then
    select * into v_order from public.commandes where cle_idempotence = p_cle_idempotence;
    -- Une clé ne peut pas être recyclée pour un autre achat / tenant.
    if v_order.evenement_id <> v_event.id or v_order.email <> v_email
      or v_order.montant_centimes <> p_montant_centimes
      or (p_portefeuille_id is not null and v_order.portefeuille_id is distinct from p_portefeuille_id) then
      raise exception 'CONFLIT_IDEMPOTENCE';
    end if;
  end if;
  return v_order;
end;
$$;
revoke execute on function public.creer_commande_en_attente(uuid, text, integer, text, uuid) from public, anon, authenticated;
grant execute on function public.creer_commande_en_attente(uuid, text, integer, text, uuid) to service_role;

create or replace function public.ajouter_secret_portefeuille(p_portefeuille_id uuid)
returns text
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_org uuid;
  v_secret text := replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '');
begin
  -- Même verrou que la révocation : ordre déterministe entre récupération et révocation.
  select organisation_id into v_org from public.portefeuilles where id = p_portefeuille_id for update;
  if not found then raise exception 'PORTEFEUILLE_INTROUVABLE'; end if;
  insert into public.secrets_portefeuille(organisation_id, portefeuille_id, secret_hash)
  values (v_org, p_portefeuille_id, encode(sha256(convert_to(v_secret, 'UTF8')), 'hex'));
  return v_secret;
end;
$$;
revoke execute on function public.ajouter_secret_portefeuille(uuid) from public, anon, authenticated;
grant execute on function public.ajouter_secret_portefeuille(uuid) to service_role;

create or replace function public.resoudre_secret_portefeuille(p_secret text)
returns table (portefeuille_id uuid, evenement_id uuid, organisation_id uuid)
language sql stable security definer set search_path = public, pg_temp as $$
  select w.id, w.evenement_id, w.organisation_id
  from public.secrets_portefeuille s join public.portefeuilles w on w.id = s.portefeuille_id
  where s.secret_hash = encode(sha256(convert_to(p_secret, 'UTF8')), 'hex') and s.revoque_le is null;
$$;
revoke execute on function public.resoudre_secret_portefeuille(text) from public, anon, authenticated;
grant execute on function public.resoudre_secret_portefeuille(text) to service_role;

create or replace function public.activer_commande(p_commande_id uuid, p_reference_paiement text)
returns table (ok boolean, raison text, portefeuille_id uuid, code_public text, secret text)
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_event public.evenements;
  v_order public.commandes;
  v_wallet public.portefeuilles;
  v_new boolean;
  v_secret text;
begin
  select e.* into v_event from public.evenements e
    join public.commandes c on c.evenement_id = e.id where c.id = p_commande_id for share of e;
  if not found then return query select false, 'COMMANDE_INTROUVABLE', null::uuid, null::text, null::text; return; end if;
  if v_event.statut <> 'ouvert' then
    return query select false, case when v_event.statut = 'clos' then 'EVENEMENT_CLOS' else 'EVENEMENT_NON_OUVERT' end,
      null::uuid, null::text, null::text; return;
  end if;
  select * into v_order from public.commandes where id = p_commande_id for update;
  if v_order.statut = 'payee' then
    select * into v_wallet from public.portefeuilles where id = v_order.portefeuille_id;
    return query select true, 'DEJA_PAYEE', v_wallet.id, v_wallet.code_public, null::text; return;
  end if;
  if v_order.statut not in ('en_attente_paiement', 'expiree') then
    return query select false, 'COMMANDE_NON_ACTIVABLE', null::uuid, null::text, null::text; return;
  end if;
  if p_reference_paiement is null or btrim(p_reference_paiement) = '' then
    return query select false, 'REFERENCE_PAIEMENT_INVALIDE', null::uuid, null::text, null::text; return;
  end if;
  -- Ne pas recontrôler le flag ni les paliers après réception d'un paiement :
  -- la commande a déjà été validée. La clôture et le gel restent bloquants.
  insert into public.portefeuilles(organisation_id, evenement_id, email)
  values (v_order.organisation_id, v_order.evenement_id, v_order.email)
  on conflict (evenement_id, lower(email)) do nothing returning * into v_wallet;
  v_new := found;
  if not v_new then
    select * into v_wallet from public.portefeuilles
    where evenement_id = v_order.evenement_id and lower(email) = v_order.email for update;
  end if;
  if v_wallet.gele then
    return query select false, 'PORTEFEUILLE_GELE', v_wallet.id, v_wallet.code_public, null::text; return;
  end if;
  -- Les contraintes unique reference_paiement / commande_id sont le dernier
  -- filet : toute collision annule la transaction entière, y compris le crédit.
  update public.commandes set statut = 'payee', reference_paiement = p_reference_paiement,
    payee_le = clock_timestamp(), portefeuille_id = v_wallet.id where id = v_order.id;
  update public.portefeuilles set solde_centimes = solde_centimes + v_order.montant_centimes
    where id = v_wallet.id returning * into v_wallet;
  insert into public.mouvements_portefeuille(organisation_id, portefeuille_id, type,
    montant_centimes, solde_apres_centimes, commande_id, acteur_id)
  values (v_wallet.organisation_id, v_wallet.id, case when v_new then 'credit_initial' else 'credit_recharge' end,
    v_order.montant_centimes, v_wallet.solde_centimes, v_order.id, auth.uid());
  v_secret := public.ajouter_secret_portefeuille(v_wallet.id);
  return query select true, null::text, v_wallet.id, v_wallet.code_public, v_secret;
end;
$$;
revoke execute on function public.activer_commande(uuid, text) from public, anon, authenticated;
grant execute on function public.activer_commande(uuid, text) to service_role;

create or replace function public.creer_demande_paiement(p_evenement_id uuid, p_code_public text, p_montant_centimes integer)
returns table (ok boolean, raison text, demande_id uuid)
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_ttl constant interval := interval '90 seconds';
  v_event public.evenements;
  v_wallet public.portefeuilles;
  v_id uuid;
begin
  select * into v_event from public.evenements where id = p_evenement_id for share;
  if not found then return query select false, 'EVENEMENT_INTROUVABLE', null::uuid; return; end if;
  if auth.uid() is null or not coalesce(public.is_current_user_super_admin()
    or v_event.organisation_id = public.current_user_organisation_id()
    or v_event.organisation_id = public.current_benevole_organisation_id(), false) then
    raise exception 'ACCES_INTERDIT' using errcode = '42501';
  end if;
  if v_event.statut <> 'ouvert' then
    return query select false, case when v_event.statut = 'clos' then 'EVENEMENT_CLOS' else 'EVENEMENT_NON_OUVERT' end, null::uuid; return;
  end if;
  if p_montant_centimes is null or p_montant_centimes <= 0 then
    return query select false, 'MONTANT_INVALIDE', null::uuid; return;
  end if;
  -- Un code d'une autre organisation reste indiscernable d'un code inexistant.
  select * into v_wallet from public.portefeuilles
    where code_public = p_code_public and organisation_id = v_event.organisation_id for update;
  if not found then return query select false, 'PORTEFEUILLE_INTROUVABLE', null::uuid; return; end if;
  if v_wallet.evenement_id <> v_event.id then return query select false, 'AUTRE_EVENEMENT', null::uuid; return; end if;
  if v_wallet.gele then return query select false, 'PORTEFEUILLE_GELE', null::uuid; return; end if;
  if v_wallet.solde_centimes < p_montant_centimes then return query select false, 'SOLDE_INSUFFISANT', null::uuid; return; end if;
  update public.demandes_paiement set statut = 'expiree', decidee_le = clock_timestamp()
    where portefeuille_id = v_wallet.id and statut = 'en_attente' and expire_le <= clock_timestamp();
  if exists (select 1 from public.demandes_paiement where portefeuille_id = v_wallet.id and statut = 'en_attente') then
    return query select false, 'DEMANDE_EN_COURS', null::uuid; return;
  end if;
  insert into public.demandes_paiement(organisation_id, portefeuille_id, montant_centimes, expire_le, cree_par)
    values (v_wallet.organisation_id, v_wallet.id, p_montant_centimes, clock_timestamp() + v_ttl, auth.uid()) returning id into v_id;
  return query select true, null::text, v_id;
end;
$$;
revoke execute on function public.creer_demande_paiement(uuid, text, integer) from public, anon, authenticated;
grant execute on function public.creer_demande_paiement(uuid, text, integer) to authenticated;

create or replace function public.decider_demande_paiement(p_portefeuille_id uuid, p_demande_id uuid, p_valider boolean)
returns table (ok boolean, raison text, statut text, solde_apres_centimes integer)
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_event public.evenements;
  v_wallet public.portefeuilles;
  v_request public.demandes_paiement;
  v_reason text;
begin
  select e.* into v_event from public.evenements e
    join public.portefeuilles w on w.evenement_id = e.id where w.id = p_portefeuille_id for share of e;
  if not found then return query select false, 'PORTEFEUILLE_INTROUVABLE', null::text, null::integer; return; end if;
  if v_event.statut <> 'ouvert' then
    return query select false, case when v_event.statut = 'clos' then 'EVENEMENT_CLOS' else 'EVENEMENT_NON_OUVERT' end,
      null::text, null::integer; return;
  end if;
  select * into v_wallet from public.portefeuilles where id = p_portefeuille_id for update;
  select d.* into v_request from public.demandes_paiement d
    where d.id = p_demande_id and d.portefeuille_id = p_portefeuille_id for update;
  if not found then return query select false, 'DEMANDE_INTROUVABLE', null::text, null::integer; return; end if;
  if v_request.statut <> 'en_attente' then
    return query select v_request.statut in ('validee', 'refusee'), 'DEJA_DECIDEE', v_request.statut, v_wallet.solde_centimes; return;
  end if;
  if v_request.expire_le <= clock_timestamp() then
    update public.demandes_paiement set statut = 'expiree', decidee_le = clock_timestamp() where id = v_request.id;
    return query select false, 'DEMANDE_EXPIREE', 'expiree', v_wallet.solde_centimes; return;
  end if;
  if p_valider is null then
    return query select false, 'DECISION_INVALIDE', v_request.statut, v_wallet.solde_centimes; return;
  end if;
  if p_valider then
    if v_wallet.gele then v_reason := 'PORTEFEUILLE_GELE';
    elsif v_wallet.solde_centimes < v_request.montant_centimes then v_reason := 'SOLDE_INSUFFISANT';
    end if;
  end if;
  if not p_valider or v_reason is not null then
    update public.demandes_paiement set statut = 'refusee', decidee_le = clock_timestamp() where id = v_request.id;
    return query select v_reason is null, v_reason, 'refusee', v_wallet.solde_centimes; return;
  end if;
  update public.portefeuilles set solde_centimes = solde_centimes - v_request.montant_centimes
    where id = v_wallet.id returning * into v_wallet;
  insert into public.mouvements_portefeuille(organisation_id, portefeuille_id, type,
    montant_centimes, solde_apres_centimes, demande_paiement_id, acteur_id)
    values (v_wallet.organisation_id, v_wallet.id, 'debit', v_request.montant_centimes,
      v_wallet.solde_centimes, v_request.id, v_request.cree_par);
  update public.demandes_paiement set statut = 'validee', decidee_le = clock_timestamp() where id = v_request.id;
  return query select true, null::text, 'validee', v_wallet.solde_centimes;
end;
$$;
revoke execute on function public.decider_demande_paiement(uuid, uuid, boolean) from public, anon, authenticated;
grant execute on function public.decider_demande_paiement(uuid, uuid, boolean) to service_role;

create or replace function public.annuler_demande_paiement(p_demande_id uuid)
returns table (ok boolean, raison text, statut text)
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_event public.evenements;
  v_request public.demandes_paiement;
begin
  select e.* into v_event from public.evenements e join public.portefeuilles w on w.evenement_id = e.id
    join public.demandes_paiement d on d.portefeuille_id = w.id where d.id = p_demande_id for share of e;
  if not found then return query select false, 'DEMANDE_INTROUVABLE', null::text; return; end if;
  if auth.uid() is null or not coalesce(public.is_current_user_super_admin()
    or v_event.organisation_id = public.current_user_organisation_id()
    or v_event.organisation_id = public.current_benevole_organisation_id(), false) then
    raise exception 'ACCES_INTERDIT' using errcode = '42501';
  end if;
  if v_event.statut <> 'ouvert' then
    return query select false, case when v_event.statut = 'clos' then 'EVENEMENT_CLOS' else 'EVENEMENT_NON_OUVERT' end, null::text; return;
  end if;
  -- Annuler ne verrouille que la demande, ne demande jamais le portefeuille ensuite.
  select * into v_request from public.demandes_paiement where id = p_demande_id for update;
  if v_request.statut = 'en_attente' then
    update public.demandes_paiement set
      statut = case when expire_le <= clock_timestamp() then 'expiree' else 'annulee' end,
      decidee_le = clock_timestamp() where id = v_request.id returning * into v_request;
  end if;
  return query select v_request.statut = 'annulee',
    case when v_request.statut = 'annulee' then null::text else 'DEMANDE_NON_ANNULABLE' end, v_request.statut;
end;
$$;
revoke execute on function public.annuler_demande_paiement(uuid) from public, anon, authenticated;
grant execute on function public.annuler_demande_paiement(uuid) to authenticated;

create or replace function public.geler_portefeuille(p_portefeuille_id uuid, p_gele boolean)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
declare v_wallet public.portefeuilles;
begin
  select * into v_wallet from public.portefeuilles where id = p_portefeuille_id for update;
  if not found then raise exception 'PORTEFEUILLE_INTROUVABLE'; end if;
  if auth.uid() is null or not coalesce(public.is_current_user_super_admin()
    or v_wallet.organisation_id = public.current_user_organisation_id(), false) then
    raise exception 'ACCES_INTERDIT' using errcode = '42501';
  end if;
  if p_gele is null then raise exception 'GEL_INVALIDE'; end if;
  update public.portefeuilles set gele = p_gele where id = p_portefeuille_id;
end;
$$;
revoke execute on function public.geler_portefeuille(uuid, boolean) from public, anon, authenticated;
grant execute on function public.geler_portefeuille(uuid, boolean) to authenticated;

create or replace function public.revoquer_secrets_portefeuille(p_portefeuille_id uuid)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
declare v_wallet public.portefeuilles;
begin
  select * into v_wallet from public.portefeuilles where id = p_portefeuille_id for update;
  if not found then raise exception 'PORTEFEUILLE_INTROUVABLE'; end if;
  if auth.uid() is null or not coalesce(public.is_current_user_super_admin()
    or v_wallet.organisation_id = public.current_user_organisation_id(), false) then
    raise exception 'ACCES_INTERDIT' using errcode = '42501';
  end if;
  update public.secrets_portefeuille set revoque_le = clock_timestamp()
    where portefeuille_id = p_portefeuille_id and revoque_le is null;
end;
$$;
revoke execute on function public.revoquer_secrets_portefeuille(uuid) from public, anon, authenticated;
grant execute on function public.revoquer_secrets_portefeuille(uuid) to authenticated;

commit;
