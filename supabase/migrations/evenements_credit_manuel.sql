-- Coupon 2 — Crédit manuel d'un portefeuille depuis l'administration.
-- Le CRUD des événements reste couvert directement par les policies de la table
-- evenements. Cette RPC est le seul chemin d'écriture financière exposé aux
-- admins/contributeurs/super-admins authentifiés.
begin;

create or replace function public.creer_credit_manuel(
  p_evenement_id uuid,
  p_email text,
  p_montant_centimes integer,
  p_portefeuille_id uuid default null
)
returns table (
  ok boolean,
  raison text,
  portefeuille_id uuid,
  code_public text,
  secret text
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_event public.evenements;
  v_wallet public.portefeuilles;
  v_order public.commandes;
  v_email text := lower(btrim(p_email));
  v_new_wallet boolean;
  v_secret text;
begin
  select * into v_event
  from public.evenements
  where id = p_evenement_id
  for share;

  if not found then
    return query select false, 'EVENEMENT_INTROUVABLE', null::uuid, null::text, null::text;
    return;
  end if;

  if auth.uid() is null or not coalesce(
    public.is_current_user_super_admin()
    or v_event.organisation_id = public.current_user_organisation_id(),
    false
  ) then
    raise exception 'ACCES_INTERDIT' using errcode = '42501';
  end if;

  if v_event.statut <> 'ouvert' then
    return query select
      false,
      case when v_event.statut = 'clos' then 'EVENEMENT_CLOS' else 'EVENEMENT_NON_OUVERT' end,
      null::uuid,
      null::text,
      null::text;
    return;
  end if;

  if p_montant_centimes is null or p_montant_centimes <= 0 then
    return query select false, 'MONTANT_INVALIDE', null::uuid, null::text, null::text;
    return;
  end if;

  if p_portefeuille_id is not null then
    select * into v_wallet
    from public.portefeuilles
    where id = p_portefeuille_id
    for update;

    if not found then
      return query select false, 'PORTEFEUILLE_INTROUVABLE', null::uuid, null::text, null::text;
      return;
    end if;
    if v_wallet.evenement_id <> v_event.id then
      return query select false, 'AUTRE_EVENEMENT', null::uuid, null::text, null::text;
      return;
    end if;
    v_email := v_wallet.email;
  end if;

  if v_email is null or v_email !~ '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$' then
    return query select false, 'EMAIL_INVALIDE', null::uuid, null::text, null::text;
    return;
  end if;

  if p_portefeuille_id is null then
    insert into public.portefeuilles (organisation_id, evenement_id, email)
    values (v_event.organisation_id, v_event.id, v_email)
    on conflict (evenement_id, lower(email)) do nothing
    returning * into v_wallet;

    v_new_wallet := found;
    if not v_new_wallet then
      select * into v_wallet
      from public.portefeuilles
      where evenement_id = v_event.id and lower(email) = v_email
      for update;
    end if;
  else
    v_new_wallet := false;
  end if;

  if v_wallet.gele then
    return query select false, 'PORTEFEUILLE_GELE', v_wallet.id, v_wallet.code_public, null::text;
    return;
  end if;

  insert into public.commandes (
    organisation_id,
    evenement_id,
    email,
    montant_centimes,
    moyen_paiement,
    statut,
    reference_paiement,
    payee_le,
    portefeuille_id
  ) values (
    v_event.organisation_id,
    v_event.id,
    v_email,
    p_montant_centimes,
    'manuel',
    'payee',
    'manuel:' || auth.uid()::text || ':' || clock_timestamp()::text,
    clock_timestamp(),
    v_wallet.id
  )
  returning * into v_order;

  update public.portefeuilles
  set solde_centimes = solde_centimes + p_montant_centimes
  where id = v_wallet.id
  returning * into v_wallet;

  insert into public.mouvements_portefeuille (
    organisation_id,
    portefeuille_id,
    type,
    montant_centimes,
    solde_apres_centimes,
    commande_id,
    acteur_id
  ) values (
    v_wallet.organisation_id,
    v_wallet.id,
    case when v_new_wallet then 'credit_initial' else 'credit_recharge' end,
    p_montant_centimes,
    v_wallet.solde_centimes,
    v_order.id,
    auth.uid()
  );

  v_secret := public.ajouter_secret_portefeuille(v_wallet.id);
  return query select true, null::text, v_wallet.id, v_wallet.code_public, v_secret;
end;
$$;

revoke execute on function public.creer_credit_manuel(uuid, text, integer, uuid)
  from public, anon, authenticated;
grant execute on function public.creer_credit_manuel(uuid, text, integer, uuid)
  to authenticated;

commit;
