-- Coupon 13 : compte vendeur événement isolé du rôle bénévole.

alter table public.organisations
  add column if not exists code_pin_vendeur_evenement text unique;

comment on column public.organisations.code_pin_vendeur_evenement is
  'PIN aléatoire du compte technique vendeur événement, distinct du PIN bénévole';

create or replace function public.current_vendeur_organisation_id()
returns uuid as $$
  select ((select auth.jwt()) -> 'app_metadata' ->> 'organisation_id')::uuid
  where ((select auth.jwt()) -> 'app_metadata' ->> 'role') = 'vendeur';
$$ language sql stable security definer set search_path = public, pg_temp;

-- 1/4 : lecture des événements non brouillon par le vendeur de l'organisation.
drop policy if exists evenements_benevole_select on public.evenements;
create policy evenements_benevole_select on public.evenements for select to authenticated
  using (((select auth.jwt()) -> 'app_metadata' ->> 'is_super_admin')::boolean = true
    or (organisation_id = (select public.current_benevole_organisation_id()) and statut <> 'brouillon')
    or (organisation_id = (select public.current_vendeur_organisation_id()) and statut <> 'brouillon'));

-- 2/4 : lecture des demandes de paiement par le vendeur de l'organisation.
drop policy if exists demandes_paiement_benevole_select on public.demandes_paiement;
create policy demandes_paiement_benevole_select on public.demandes_paiement for select to authenticated
  using (((select auth.jwt()) -> 'app_metadata' ->> 'is_super_admin')::boolean = true
    or organisation_id = (select public.current_benevole_organisation_id())
    or organisation_id = (select public.current_vendeur_organisation_id()));

-- 3/4 : création d'une demande de paiement par le vendeur.
create or replace function public.creer_demande_paiement(
  p_evenement_id uuid,
  p_code_public text,
  p_montant_centimes integer
)
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
    or v_event.organisation_id = public.current_benevole_organisation_id()
    or v_event.organisation_id = public.current_vendeur_organisation_id(), false) then
    raise exception 'ACCES_INTERDIT' using errcode = '42501';
  end if;
  if v_event.statut <> 'ouvert' then
    return query select false, case when v_event.statut = 'clos' then 'EVENEMENT_CLOS' else 'EVENEMENT_NON_OUVERT' end, null::uuid; return;
  end if;
  if p_montant_centimes is null or p_montant_centimes <= 0 then
    return query select false, 'MONTANT_INVALIDE', null::uuid; return;
  end if;
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

-- 4/4 : annulation d'une demande de paiement par le vendeur.
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
    or v_event.organisation_id = public.current_benevole_organisation_id()
    or v_event.organisation_id = public.current_vendeur_organisation_id(), false) then
    raise exception 'ACCES_INTERDIT' using errcode = '42501';
  end if;
  if v_event.statut <> 'ouvert' then
    return query select false, case when v_event.statut = 'clos' then 'EVENEMENT_CLOS' else 'EVENEMENT_NON_OUVERT' end, null::text; return;
  end if;
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
