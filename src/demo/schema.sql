-- Généré par `npm run demo:schema` (scripts/demo-schema-dump.sql + scripts/demo-schema-build.py)
-- depuis le catalogue de staging — ne pas éditer à la main. Changer DATA_VERSION (backend.ts).
set check_function_bodies = off;
create extension if not exists unaccent with schema extensions;
create or replace function extensions.gen_random_bytes(n integer) returns bytea language sql volatile as $$ select substring(decode(replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', ''), 'hex') from 1 for n) $$;
create table public.acces_portefeuille_rate_limits (id bigint generated always as identity not null, ip_hash text not null, portefeuille_id uuid, scope text not null, created_at timestamp with time zone not null);
create table public.activites (id uuid not null, organisation_id uuid not null, nom text not null, created_at timestamp with time zone not null, id_externe text, date_debut date, date_fin date);
create table public.adherents (id uuid not null, organisation_id uuid not null, id_externe text, civilite smallint not null, nom text not null, prenom text, date_naissance date, adresse text, code_postal text, ville text, telephone text, courriel text, statut text not null, statuts_acceptes boolean not null, consent_rgpd boolean not null, created_at timestamp with time zone not null, updated_at timestamp with time zone not null, pays text, mailing_opt_out boolean not null, mailing_opt_out_at timestamp with time zone, mailing_unsubscribe_token uuid not null, tags text[] not null, email_invalide_at timestamp with time zone, email_invalide_evenement text, email_invalide_raison text);
create table public.adhesions (id uuid not null, adherent_id uuid not null, date_debut date not null, date_fin date, montant_cotisation numeric(10,2), date_paiement_cotisation date, mode_paiement smallint, renouvellement boolean not null, droit_vote_ag boolean not null, bulletin_signe boolean not null, created_at timestamp with time zone not null);
create table public.campagnes_courrier (id uuid not null, organisation_id uuid not null, activite_id uuid not null, selection_label text not null, nombre_destinataires integer not null, nombre_exclus integer not null, genere_par uuid, created_at timestamp with time zone not null, exclusion_label text, detail_enregistre boolean not null, notes text);
create table public.campagnes_courrier_destinataires (id uuid not null, campagne_id uuid not null, organisation_id uuid not null, adherent_id uuid not null, nom text not null, adresse text, statut text not null, raison_exclusion text);
create table public.campagnes_mailing (id uuid not null, organisation_id uuid not null, sujet text not null, corps_html text not null, nombre_destinataires integer not null, nombre_exclus integer not null, envoye_par uuid, created_at timestamp with time zone not null, selection_label text, exclusion_label text, nombre_pieces_jointes integer, notes text, pieces_jointes_noms text[]);
create table public.campagnes_mailing_destinataires (id uuid not null, campagne_id uuid not null, organisation_id uuid not null, adherent_id uuid not null, nom text not null, courriel text, statut text not null, raison_exclusion text);
create table public.commandes (id uuid not null, organisation_id uuid not null, evenement_id uuid not null, email text not null, montant_centimes integer not null, moyen_paiement text not null, statut text not null, reference_paiement text, cle_idempotence text, expire_le timestamp with time zone not null, payee_le timestamp with time zone, portefeuille_id uuid, created_at timestamp with time zone not null, updated_at timestamp with time zone not null);
create table public.coupon_transport_spike (id uuid not null, seller_hash text not null, buyer_hash text not null, topic text not null, revision integer not null, status text not null, request_id uuid, changed_at timestamp with time zone not null, request_expires_at timestamp with time zone, expires_at timestamp with time zone not null);
create table public.demandes_adhesion (id uuid not null, organisation_id uuid not null, civilite smallint not null, nom text not null, prenom text, date_naissance date, adresse text, code_postal text, ville text, telephone text, courriel text, signature_data_url text not null, accepte_statuts boolean not null, consent_rgpd boolean not null, statut text not null, decided_at timestamp with time zone, decided_by uuid, adherent_id uuid, created_at timestamp with time zone not null, pays text, motif_refus text, email_bounced_at timestamp with time zone, type text not null, adherent_vise_id uuid);
create table public.demandes_inscription (id uuid not null, nom_association text not null, ville text not null, rna text, siren text, prenom text not null, nom text not null, email text not null, message text, cgu_acceptees_le timestamp with time zone, statut text not null, organisation_id uuid, traitee_par uuid, traitee_le timestamp with time zone, admin_utilisateur_id uuid, invitation_envoyee_le timestamp with time zone, erreur_invitation text, created_at timestamp with time zone not null, confirmation_jeton_hash text, confirmation_expire_le timestamp with time zone, confirmee_le timestamp with time zone);
create table public.demandes_paiement (id uuid not null, organisation_id uuid not null, portefeuille_id uuid not null, montant_centimes integer not null, statut text not null, expire_le timestamp with time zone not null, cree_par uuid not null, decidee_le timestamp with time zone, created_at timestamp with time zone not null, updated_at timestamp with time zone not null);
create table public.dons (id uuid not null, profil_participant_id uuid not null, organisation_id uuid not null, activite_id uuid, montant numeric(10,2) not null, date date not null, mode_paiement smallint not null, created_by_role text not null, created_at timestamp with time zone not null, updated_at timestamp with time zone not null, id_externe text, don_regulier_id uuid);
create table public.dons_fichiers (id uuid not null, don_id uuid not null, organisation_id uuid not null, chemin_storage text not null, nom_original text not null, type_mime text not null, taille bigint not null, uploaded_by uuid, created_at timestamp with time zone not null);
create table public.dons_reguliers (id uuid not null, organisation_id uuid not null, profil_participant_id uuid not null, activite_id uuid, montant numeric(10,2) not null, jour_prelevement smallint not null, date_debut date not null, date_fin date, statut text not null, created_at timestamp with time zone not null, updated_at timestamp with time zone not null);
create table public.evenements (id uuid not null, organisation_id uuid not null, slug text not null, nom text not null, date_evenement date not null, statut text not null, montants_credit_centimes integer[] not null, created_at timestamp with time zone not null, updated_at timestamp with time zone not null, activite_id uuid, date_fin date not null);
create table public.journal_modifications (id uuid not null, organisation_id uuid not null, table_cible text not null, ligne_id uuid not null, action text not null, details jsonb, auteur_id uuid, created_at timestamp with time zone not null);
create table public.liens_renouvellement (id uuid not null, organisation_id uuid not null, adherent_id uuid not null, secret_hash text not null, cree_le timestamp with time zone not null, expire_le timestamp with time zone not null, utilise_le timestamp with time zone, revoque_le timestamp with time zone);
create table public.listes_diffusion (id uuid not null, organisation_id uuid not null, nom text not null, created_at timestamp with time zone not null);
create table public.mailing_templates (id uuid not null, organisation_id uuid not null, nom text not null, sujet text not null, corps_html text not null, created_at timestamp with time zone not null);
create table public.mouvements_portefeuille (id uuid not null, organisation_id uuid not null, portefeuille_id uuid not null, type text not null, montant_centimes integer not null, solde_apres_centimes integer not null, commande_id uuid, demande_paiement_id uuid, acteur_id uuid, created_at timestamp with time zone not null);
create table public.organisation_assets (id uuid not null, organisation_id uuid not null, identifiant text not null, libelle text not null, url text not null, created_at timestamp with time zone not null);
create table public.organisation_secrets (organisation_id uuid not null, brevo_api_key text, code_pin_benevole text, code_pin_vendeur_evenement text, updated_at timestamp with time zone not null, brevo_webhook_secret text);
create table public.organisations (id uuid not null, nom text not null, modele_recu_pdf jsonb, created_at timestamp with time zone not null, updated_at timestamp with time zone not null, adresse text, code_postal text, ville text, pays text, slug text not null, statuts_url text, formulaire_adhesion_header_html text, formulaire_adhesion_footer_html text, formulaire_adhesion_css text, formulaire_adhesion_message_succes text, brevo_expediteur_nom text, brevo_expediteur_email text, fonctionnalites_activees jsonb not null, archived_at timestamp with time zone, conservation_evenements_mois integer not null, url_politique_confidentialite text, adhesion_regle_fin text not null, adhesion_mois_bascule smallint not null, notif_demandes_adhesion boolean not null, saisie_adhesion_benevole boolean not null, logo_asset_id uuid);
create table public.personnes (id uuid not null, nom text not null, prenom text, email text, telephone text, created_at timestamp with time zone not null, updated_at timestamp with time zone not null, civilite smallint, adresse text, code_postal text, ville text, pays text, nom2 text, prenom2 text);
create table public.portefeuilles (id uuid not null, organisation_id uuid not null, evenement_id uuid not null, email text not null, code_public text not null, solde_centimes integer not null, gele boolean not null, created_at timestamp with time zone not null, updated_at timestamp with time zone not null, email_modifie_le timestamp with time zone, email_modifie_par uuid, anonymise_le timestamp with time zone, anonymise_par uuid);
create table public.profils_organisation (id uuid not null, utilisateur_id uuid not null, organisation_id uuid not null, nom_affiche text, role text not null, created_at timestamp with time zone not null, notif_demandes_adhesion boolean not null, notif_demandes_adhesion_updated_at timestamp with time zone);
create table public.profils_participant (id uuid not null, personne_id uuid not null, organisation_id uuid not null, notes text, created_at timestamp with time zone not null, id_externe text, email_invalide_at timestamp with time zone, email_invalide_evenement text, email_invalide_raison text);
create table public.recus_fiscaux (id uuid not null, profil_participant_id uuid not null, organisation_id uuid not null, annee integer not null, montant_total numeric(10,2) not null, fichier_url text, date_generation timestamp with time zone not null, numero_ordre text, type_cerfa text, template_id uuid, snapshot_donateur jsonb, snapshot_organisation jsonb, email_envoye_at timestamp with time zone, email_canal text);
create table public.recus_fiscaux_versions (id uuid not null, recu_id uuid not null, organisation_id uuid not null, version integer not null, fichier_url text not null, numero_ordre text, montant_total numeric not null, type_cerfa text, template_id uuid, snapshot_donateur jsonb, snapshot_organisation jsonb, genere_le timestamp with time zone not null, genere_par uuid, email_envoye_le timestamp with time zone);
create table public.recus_lot_lignes (id uuid not null, lot_id uuid not null, organisation_id uuid not null, profil_participant_id uuid not null, rang integer not null, statut text not null, tentatives integer not null, erreur text, recu_id uuid, recu_preexistant boolean not null, modifie_le timestamp with time zone not null, version_id uuid, envoye_le timestamp with time zone, email_canal text, deja_envoye boolean not null);
create table public.recus_lots (id uuid not null, organisation_id uuid not null, annee integer not null, type text not null, statut text not null, cree_par uuid, cree_le timestamp with time zone not null, arrete_par uuid, arrete_le timestamp with time zone, termine_le timestamp with time zone, nb_total integer not null, nb_faits integer not null, nb_echecs integer not null, traitement_jusqu_a timestamp with time zone, nb_a_verifier integer not null, en_attente_jusqu_a timestamp with time zone);
create table public.secrets_portefeuille (id uuid not null, organisation_id uuid not null, portefeuille_id uuid not null, secret_hash text not null, created_at timestamp with time zone not null, updated_at timestamp with time zone not null, revoque_le timestamp with time zone, cree_par uuid);
create table public.signatures_adhesion (adhesion_id uuid not null, organisation_id uuid not null, signature_data_url text not null, created_at timestamp with time zone not null);
create table public.templates_carte_adherent (id uuid not null, organisation_id uuid not null, nom text not null, html_template text not null, css text, is_active boolean not null, is_archived boolean not null, created_at timestamp with time zone not null, updated_at timestamp with time zone not null);
create table public.templates_recu (id uuid not null, organisation_id uuid not null, nom text not null, type_cerfa text not null, html_template text not null, css text, is_active boolean not null, is_archived boolean not null, created_at timestamp with time zone not null, updated_at timestamp with time zone not null);
CREATE OR REPLACE FUNCTION public.activer_commande(p_commande_id uuid, p_reference_paiement text)
 RETURNS TABLE(ok boolean, raison text, portefeuille_id uuid, code_public text, secret text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
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
$function$
;
CREATE OR REPLACE FUNCTION public.add_adherents_tag(p_organisation_id uuid, p_adherent_ids uuid[], p_tag text)
 RETURNS void
 LANGUAGE sql
AS $function$
  update adherents
  set tags = (
    select array_agg(distinct t order by t)
    from unnest(tags || array[p_tag]) as t
  )
  where organisation_id = p_organisation_id
    and id = any(p_adherent_ids);
$function$
;
CREATE OR REPLACE FUNCTION public.adherent_doublon_existe(p_organisation_id uuid, p_nom text, p_prenom text, p_courriel text)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  select exists (
    select 1 from public.adherents a
    where a.organisation_id = p_organisation_id
      and (
        (
          nullif(public.nettoyer_texte_saisie(p_nom), '') is not null
          and lower(public.nettoyer_texte_saisie(a.nom)) = lower(public.nettoyer_texte_saisie(p_nom))
          and lower(coalesce(public.nettoyer_texte_saisie(a.prenom), '')) = lower(coalesce(public.nettoyer_texte_saisie(p_prenom), ''))
        )
        or (
          nullif(public.nettoyer_texte_saisie(p_courriel), '') is not null
          and lower(public.nettoyer_texte_saisie(a.courriel)) = lower(public.nettoyer_texte_saisie(p_courriel))
        )
      )
  );
$function$
;
CREATE OR REPLACE FUNCTION public.adherents_par_emails(p_organisation_id uuid, p_emails text[])
 RETURNS TABLE(adherent_id uuid, email_normalise text)
 LANGUAGE sql
 STABLE
 SET search_path TO ''
AS $function$
  select a.id, lower(btrim(a.courriel, E' \t\r\n'))
  from public.adherents a
  where a.organisation_id = p_organisation_id
    and a.courriel is not null
    and lower(btrim(a.courriel, E' \t\r\n')) in (select lower(btrim(e, E' \t\r\n')) from unnest(p_emails) as e);
$function$
;
CREATE OR REPLACE FUNCTION public.adhesions_poser_date_fin()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_organisation_id uuid;
begin
  select a.organisation_id into v_organisation_id from public.adherents a where a.id = new.adherent_id;
  new.date_fin := public.calculer_date_fin_adhesion(v_organisation_id, new.date_debut);
  if new.date_fin is null then
    raise exception 'REGLE_ADHESION_INTROUVABLE' using errcode = '42501';
  end if;
  return new;
end;
$function$
;
CREATE OR REPLACE FUNCTION public.ajouter_secret_portefeuille(p_portefeuille_id uuid)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
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
$function$
;
CREATE OR REPLACE FUNCTION public.annuler_demande_paiement(p_demande_id uuid)
 RETURNS TABLE(ok boolean, raison text, statut text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
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
$function$
;
CREATE OR REPLACE FUNCTION public.anonymiser_portefeuille(p_portefeuille_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_organisation_id uuid;
begin
  select organisation_id into v_organisation_id
  from public.portefeuilles
  where id = p_portefeuille_id;

  if not found then
    raise exception 'PORTEFEUILLE_INTROUVABLE';
  end if;

  if auth.uid() is null or not coalesce(
    public.is_current_user_super_admin()
      or v_organisation_id = public.current_user_organisation_id(),
    false
  ) then
    raise exception 'ACCES_INTERDIT' using errcode = '42501';
  end if;

  perform public.anonymiser_portefeuille_interne(p_portefeuille_id, auth.uid());
end;
$function$
;
CREATE OR REPLACE FUNCTION public.anonymiser_portefeuille_interne(p_portefeuille_id uuid, p_auteur uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_wallet public.portefeuilles;
  v_placeholder text;
begin
  select * into v_wallet
  from public.portefeuilles
  where id = p_portefeuille_id
  for update;

  if not found then
    raise exception 'PORTEFEUILLE_INTROUVABLE';
  end if;
  if v_wallet.anonymise_le is not null then
    return false;
  end if;

  -- Unique par portefeuille (index unique evenement_id + lower(email)) et conforme
  -- au CHECK de format ; le TLD .invalid ne peut recevoir aucun email. Le domaine
  -- est repris côté front (emailCommandeAffiche) pour masquer ces adresses.
  v_placeholder := 'efface+' || replace(v_wallet.id::text, '-', '') || '@anonyme.invalid';

  -- Commandes du portefeuille, et commandes jamais rattachées (paiement abandonné ou
  -- expiré) passées avec la même adresse sur le même événement.
  update public.commandes
  set email = v_placeholder
  where evenement_id = v_wallet.evenement_id
    and (portefeuille_id = v_wallet.id
      or (portefeuille_id is null and email = v_wallet.email));

  update public.secrets_portefeuille
  set revoque_le = clock_timestamp()
  where portefeuille_id = v_wallet.id
    and revoque_le is null;

  delete from public.acces_portefeuille_rate_limits
  where portefeuille_id = v_wallet.id;

  update public.portefeuilles
  set email = v_placeholder,
    anonymise_le = clock_timestamp(),
    anonymise_par = p_auteur
  where id = v_wallet.id;

  return true;
end;
$function$
;
CREATE OR REPLACE FUNCTION public.apercu_recalage_adhesions(p_organisation_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE
 SET search_path TO 'public', 'pg_temp'
AS $function$
begin
  if not coalesce(public.is_current_user_super_admin() or p_organisation_id = public.current_user_organisation_id(), false) then
    raise exception 'ACCES_REFUSE' using errcode = '42501';
  end if;
  return (
    select jsonb_build_object(
      'total', count(*),
      'a_modifier', count(*) filter (
        where h.date_fin is distinct from public.calculer_date_fin_adhesion(p_organisation_id, h.date_debut)
      )
    )
    from public.adhesions h
    join public.adherents a on a.id = h.adherent_id
    where a.organisation_id = p_organisation_id
  );
end;
$function$
;
CREATE OR REPLACE FUNCTION public.arreter_lot_recus(p_lot_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_lot public.recus_lots%rowtype;
begin
  select * into v_lot from public.recus_lots where id = p_lot_id for update;
  if not found then
    raise exception 'LOT_INTROUVABLE';
  end if;

  if not coalesce(
    public.is_current_user_super_admin()
    or (v_lot.organisation_id = public.current_user_organisation_id()
        and public.current_user_role() in ('admin', 'contributeur')),
    false
  ) then
    raise exception 'ACCES_REFUSE' using errcode = '42501';
  end if;

  if v_lot.statut <> 'en_cours' then
    raise exception 'LOT_NON_EN_COURS';
  end if;

  update public.recus_lots
     set statut = 'arrete', arrete_par = auth.uid(), arrete_le = now()
   where id = p_lot_id;
end;
$function$
;
CREATE OR REPLACE FUNCTION public.attribuer_numero_adherent(p_organisation_id uuid)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  seq_name text := 'adherent_id_externe_seq_' || replace(p_organisation_id::text, '-', '_');
  current_max bigint;
  next_val bigint;
begin
  perform pg_advisory_xact_lock(hashtext(seq_name));

  select coalesce(max(id_externe::bigint), 0)
  into current_max
  from public.adherents
  where organisation_id = p_organisation_id
    and id_externe ~ '^[0-9]{1,18}$';

  if not exists (select 1 from pg_sequences where schemaname = 'public' and sequencename = seq_name) then
    execute format('create sequence public.%I start %s', seq_name, current_max + 1);
  else
    execute format(
      'select setval(%L, GREATEST(last_value, %s)) from public.%I',
      'public.' || seq_name, current_max, seq_name
    );
  end if;

  execute format('select nextval(%L)', 'public.' || seq_name) into next_val;
  return next_val::text;
end;
$function$
;
CREATE OR REPLACE FUNCTION public.attribuer_participant_id_externe(p_organisation_id uuid)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  seq_name text;
  next_val bigint;
  current_max bigint;
begin
  seq_name := 'participant_id_externe_seq_' || replace(p_organisation_id::text, '-', '_');
  perform pg_advisory_xact_lock(hashtext(seq_name));

  select coalesce(max(id_externe::bigint), 0)
  into current_max
  from profils_participant
  where organisation_id = p_organisation_id
    and id_externe ~ '^[0-9]{1,18}$';

  if not exists (select 1 from pg_sequences where schemaname = 'public' and sequencename = seq_name) then
    -- Création sérialisée par le verrou consultatif ci-dessus.
    execute format('create sequence public.%I start %s', seq_name, current_max + 1);
  else
    execute format(
      'select setval(%L, GREATEST(last_value, %s)) from public.%I',
      'public.' || seq_name, current_max, seq_name
    );
  end if;

  execute format('select nextval(%L)', 'public.' || seq_name) into next_val;
  return next_val::text;
end;
$function$
;
CREATE OR REPLACE FUNCTION public.audit_missing_super_admin_bypass()
 RETURNS TABLE(tablename text, policyname text, cmd text, qual text, with_check text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  select p.tablename, p.policyname, p.cmd, p.qual::text, p.with_check::text
  from pg_policies p
  where p.schemaname = 'public'
    and (
      coalesce(p.qual, '') ~* 'organisation_id|current_effective_organisation_id|current_user_organisation_id|current_benevole_organisation_id'
      or coalesce(p.with_check, '') ~* 'organisation_id|current_effective_organisation_id|current_user_organisation_id|current_benevole_organisation_id'
    )
    and coalesce(p.qual, '') !~* 'is_super_admin|is_organisation_row_accessible'
    and coalesce(p.with_check, '') !~* 'is_super_admin|is_organisation_row_accessible';
$function$
;
CREATE OR REPLACE FUNCTION public.brevo_configure_organisation(p_organisation_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  select coalesce((
    select nullif(btrim(s.brevo_api_key), '') is not null
           and nullif(btrim(o.brevo_expediteur_nom), '') is not null
           and nullif(btrim(o.brevo_expediteur_email), '') is not null
      from public.organisations o
      left join public.organisation_secrets s on s.organisation_id = o.id
     where o.id = p_organisation_id
  ), false);
$function$
;
CREATE OR REPLACE FUNCTION public.broadcast_portefeuille_payment_wakeup()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_secret_hash text;
begin
  for v_secret_hash in
    select s.secret_hash
    from public.secrets_portefeuille s
    where s.portefeuille_id = new.portefeuille_id
      and s.revoque_le is null
  loop
    begin
      perform realtime.send('{}'::jsonb, 'changed', v_secret_hash, false);
    exception when others then
      -- Le polling réconcilie l'état : un signal indisponible ne doit jamais
      -- annuler la mutation métier ni écrire le secret dans les journaux.
      raise warning 'Coupon payment buyer broadcast unavailable';
    end;
  end loop;
  return null;
end;
$function$
;
CREATE OR REPLACE FUNCTION public.budget_envoi_lot_recus(p_lot_id uuid)
 RETURNS integer
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare
  v_org uuid;
  v_rythme record;
  v_jour integer;
  v_minute integer;
  v_budget integer;
  v_plus_ancien timestamptz;
begin
  select l.organisation_id into v_org from public.recus_lots l where l.id = p_lot_id and l.type = 'envoi';
  if v_org is null then
    raise exception 'LOT_INTROUVABLE';
  end if;

  select * into v_rythme from public.rythme_envoi_recus(v_org);
  v_jour := v_rythme.par_jour - public.envois_recus_depuis(v_org, now() - interval '24 hours');
  -- Fenêtre de 45 s, plus courte que l'intervalle de la tâche planifiée (1 min) : les envois du passage
  -- précédent (faits dans ses premières secondes) n'en font plus partie, sinon le passage suivant, à
  -- quelques fractions de seconde près, les comptait et le débit réel alternait (1 puis 5 par minute).
  -- Une exécution supplémentaire rapprochée (lancement) reste bornée.
  v_minute := v_rythme.par_minute - public.envois_recus_depuis(v_org, now() - interval '45 seconds');
  v_budget := greatest(0, least(v_jour, v_minute));

  if v_jour <= 0 then
    select min(t) into v_plus_ancien from (
      select v.email_envoye_le as t from public.recus_fiscaux_versions v
       where v.organisation_id = v_org and v.email_envoye_le > now() - interval '24 hours'
      union all
      select g.modifie_le from public.recus_lot_lignes g
       where g.organisation_id = v_org and g.statut = 'a_verifier' and g.modifie_le > now() - interval '24 hours'
    ) s;
    update public.recus_lots
       set en_attente_jusqu_a = coalesce(v_plus_ancien, now()) + interval '24 hours' + interval '1 minute'
     where id = p_lot_id;
  elsif v_budget > 0 then
    update public.recus_lots set en_attente_jusqu_a = null where id = p_lot_id and en_attente_jusqu_a is not null;
  end if;

  return v_budget;
end;
$function$
;
CREATE OR REPLACE FUNCTION public.calculer_date_fin_adhesion(p_organisation_id uuid, p_date_debut date)
 RETURNS date
 LANGUAGE sql
 STABLE
 SET search_path TO 'public', 'pg_temp'
AS $function$
  select case
    when o.adhesion_regle_fin = 'annee_civile' then
      make_date(
        extract(year from p_date_debut)::int
          + case when extract(month from p_date_debut)::int >= o.adhesion_mois_bascule then 1 else 0 end,
        12, 31)
    else (p_date_debut + interval '1 year')::date
  end
  from public.organisations o
  where o.id = p_organisation_id;
$function$
;
CREATE OR REPLACE FUNCTION public.changer_role_compte(p_utilisateur_id uuid, p_role text)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'auth'
AS $function$
declare
  v_organisation_id uuid;
  v_role_actuel text;
begin
  if coalesce((auth.jwt() -> 'app_metadata' ->> 'is_super_admin')::boolean, false) is not true then
    raise exception 'Accès refusé — réservé aux super-admins' using errcode = '42501';
  end if;

  if p_role not in ('admin', 'contributeur') then
    raise exception 'Rôle inconnu : %', p_role using errcode = '22023';
  end if;

  select organisation_id, role into v_organisation_id, v_role_actuel
  from profils_organisation
  where utilisateur_id = p_utilisateur_id;

  if v_organisation_id is null then
    raise exception 'Compte introuvable' using errcode = 'P0002';
  end if;

  if v_role_actuel = p_role then
    return p_role;
  end if;

  -- Verrouille les comptes de l'organisation : deux rétrogradations
  -- simultanées ne peuvent pas laisser l'organisation sans administrateur.
  perform 1 from profils_organisation
  where organisation_id = v_organisation_id
  for update;

  if v_role_actuel = 'admin' and public.est_dernier_admin_actif(p_utilisateur_id) then
    raise exception 'Impossible : c''est le dernier administrateur actif de l''organisation. Nommez d''abord un autre administrateur.'
      using errcode = 'P0001';
  end if;

  update profils_organisation
  set role = p_role
  where utilisateur_id = p_utilisateur_id;

  return p_role;
end;
$function$
;
CREATE OR REPLACE FUNCTION public.classer_ligne_envoi_interrompue(p_ligne_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare
  v_ligne public.recus_lot_lignes%rowtype;
  v_envoi record;
begin
  select * into v_ligne from public.recus_lot_lignes g where g.id = p_ligne_id and g.statut = 'en_cours' for update;
  if not found then
    return;
  end if;

  select v.id, v.email_envoye_le into v_envoi
    from public.recus_fiscaux_versions v
   where v.recu_id = v_ligne.recu_id and v.email_envoye_le >= v_ligne.modifie_le
   order by v.version desc
   limit 1;
  if found then
    update public.recus_lot_lignes
       set statut = 'fait', erreur = null, version_id = v_envoi.id, envoye_le = v_envoi.email_envoye_le, modifie_le = now()
     where id = v_ligne.id;
  else
    update public.recus_lot_lignes
       set statut = 'a_verifier', modifie_le = now(),
           erreur = 'Traitement interrompu pendant l''envoi : vérifiez (journal des emails de Brevo, ou auprès du donateur) si l''email est parti'
     where id = v_ligne.id;
  end if;
end;
$function$
;
CREATE OR REPLACE FUNCTION public.codes_pin(p_organisation_id uuid)
 RETURNS TABLE(code_pin_benevole text, code_pin_vendeur_evenement text)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
begin
  if not public.peut_gerer_secrets(p_organisation_id, true) then
    raise exception 'ACCES_REFUSE' using errcode = '42501';
  end if;
  return query
    select s.code_pin_benevole, s.code_pin_vendeur_evenement
    from public.organisation_secrets s
    where s.organisation_id = p_organisation_id;
end;
$function$
;
CREATE OR REPLACE FUNCTION public.codes_pin_benevole_organisations()
 RETURNS TABLE(organisation_id uuid, code_pin_benevole text)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
begin
  if not public.is_current_user_super_admin() then
    raise exception 'ACCES_REFUSE' using errcode = '42501';
  end if;
  return query select s.organisation_id, s.code_pin_benevole from public.organisation_secrets s;
end;
$function$
;
CREATE OR REPLACE FUNCTION public.confirmer_demande_inscription(p_ip_hash text, p_jeton_hash text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_nb integer;
  v_demande public.demandes_inscription%rowtype;
begin
  if p_ip_hash is null or p_ip_hash !~ '^[0-9a-f]{64}$' then
    return jsonb_build_object('ok', false, 'reason', 'ACCES_INVALIDE');
  end if;

  perform pg_advisory_xact_lock(hashtextextended('inscription:confirmation:' || p_ip_hash, 0));
  delete from public.acces_portefeuille_rate_limits
  where scope = 'inscription_confirmation_ip'
    and ip_hash = p_ip_hash
    and created_at < clock_timestamp() - interval '1 day';
  select count(*) into v_nb
  from public.acces_portefeuille_rate_limits
  where scope = 'inscription_confirmation_ip'
    and ip_hash = p_ip_hash
    and created_at > clock_timestamp() - interval '1 hour';
  if v_nb >= 10 then
    return jsonb_build_object('ok', false, 'reason', 'RATE_LIMIT');
  end if;
  insert into public.acces_portefeuille_rate_limits(ip_hash, portefeuille_id, scope)
  values (p_ip_hash, null, 'inscription_confirmation_ip');

  if p_jeton_hash is null or p_jeton_hash !~ '^[0-9a-f]{64}$' then
    return jsonb_build_object('ok', true, 'cas', 'invalide');
  end if;

  select * into v_demande from public.demandes_inscription
  where confirmation_jeton_hash = p_jeton_hash
  for update;
  if not found then
    return jsonb_build_object('ok', true, 'cas', 'invalide');
  end if;
  if v_demande.statut <> 'a_confirmer' then
    return jsonb_build_object('ok', true, 'cas', 'deja_confirmee');
  end if;
  if not coalesce(v_demande.confirmation_expire_le > now(), false) then
    return jsonb_build_object('ok', true, 'cas', 'expiree');
  end if;

  update public.demandes_inscription
  set statut = 'en_attente', confirmee_le = now(), confirmation_expire_le = null
  where id = v_demande.id;

  return jsonb_build_object('ok', true, 'cas', 'confirmee', 'demande', jsonb_build_object(
    'nom_association', v_demande.nom_association,
    'ville', v_demande.ville,
    'rna', v_demande.rna,
    'siren', v_demande.siren,
    'prenom', v_demande.prenom,
    'nom', v_demande.nom,
    'email', v_demande.email,
    'message', v_demande.message));
end;
$function$
;
CREATE OR REPLACE FUNCTION public.coupon_spike_step(p_session_id uuid, p_token text, p_action text, p_request_id uuid DEFAULT NULL::uuid, p_accept boolean DEFAULT NULL::boolean)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  s public.coupon_transport_spike;
  token_hash text := encode(sha256(convert_to(p_token, 'UTF8')), 'hex');
  actor text;
begin
  select * into s from public.coupon_transport_spike where id = p_session_id for update;
  if not found or s.expires_at <= clock_timestamp() or token_hash is null then
    raise exception 'ACCES_INTERDIT' using errcode = '42501';
  end if;
  actor := case when token_hash = s.seller_hash then 'seller' when token_hash = s.buyer_hash then 'buyer' end;
  if actor is null then raise exception 'ACCES_INTERDIT' using errcode = '42501'; end if;
  if p_action is null or p_action not in ('read','request','decide') then raise exception 'ACTION_INVALIDE'; end if;
  if p_action = 'request' and (actor <> 'seller' or p_request_id is null) then
    raise exception 'ACCES_INTERDIT' using errcode = '42501';
  end if;
  if p_action = 'decide' and (actor <> 'buyer' or p_request_id is null or p_accept is null) then
    raise exception 'ACCES_INTERDIT' using errcode = '42501';
  end if;
  if s.status = 'pending' and s.request_expires_at <= clock_timestamp() then
    s.status := 'expired'; s.revision := s.revision + 1; s.changed_at := clock_timestamp();
  end if;
  if p_action = 'request' and p_request_id is distinct from s.request_id then
    if s.status = 'pending' then raise exception 'DEMANDE_EN_COURS'; end if;
    s.request_id := p_request_id; s.status := 'pending'; s.revision := s.revision + 1;
    s.changed_at := clock_timestamp(); s.request_expires_at := s.changed_at + interval '90 seconds';
  elsif p_action = 'decide' then
    if p_request_id is distinct from s.request_id then raise exception 'DEMANDE_INCONNUE'; end if;
    if s.status = 'pending' then
      s.status := case when p_accept then 'accepted' else 'refused' end;
      s.revision := s.revision + 1; s.changed_at := clock_timestamp();
    end if;
  end if;
  update public.coupon_transport_spike set revision = s.revision, status = s.status,
    request_id = s.request_id, changed_at = s.changed_at, request_expires_at = s.request_expires_at
    where id = s.id;
  return jsonb_build_object('revision',s.revision,'status',s.status,'requestId',s.request_id,
    'changedAt',s.changed_at,'expiresAt',s.request_expires_at,'sessionExpiresAt',s.expires_at,
    'topic',s.topic,'role',actor,'serverNow',clock_timestamp());
end;
$function$
;
CREATE OR REPLACE FUNCTION public.creer_adhesion_benevole(p_organisation_id uuid, p_adherent jsonb, p_accepte_statuts boolean, p_consent_rgpd boolean, p_signature_data_url text, p_signe_sur_papier boolean, p_date_debut date, p_montant_cotisation numeric, p_mode_paiement smallint)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  c_bornes constant jsonb := '{"nom":100,"prenom":100,"date_naissance":10,"adresse":200,"code_postal":5,"ville":100,"pays":100,"telephone":30,"courriel":254}';
  c_signature_prefixe constant text := 'data:image/png;base64,';
  v_cle text;
  v_civilite smallint;
  v_nom text;
  v_prenom text;
  v_date_naissance date;
  v_adresse text;
  v_code_postal text;
  v_ville text;
  v_pays text;
  v_telephone text;
  v_courriel text;
  v_papier boolean := coalesce(p_signe_sur_papier, false);
  v_statuts_url text;
  v_doublon boolean;
  v_adherent_id uuid := gen_random_uuid();
  v_adhesion_id uuid := gen_random_uuid();
  v_id_externe text;
  v_date_fin date;
begin
  if not coalesce(public.peut_saisir_adhesion_benevole(p_organisation_id), false) then
    raise exception 'ACCES_REFUSE' using errcode = '42501';
  end if;

  -- Champs : texte ou absent, longueur bornée (mêmes bornes que validation.ts).
  if p_adherent is null or jsonb_typeof(p_adherent) <> 'object' then
    raise exception 'ADHESION_INVALIDE' using errcode = '22023';
  end if;
  for v_cle in select jsonb_object_keys(c_bornes) loop
    if jsonb_typeof(p_adherent -> v_cle) not in ('string', 'null')
       or length(public.nettoyer_texte_saisie(p_adherent ->> v_cle)) > (c_bornes ->> v_cle)::int then
      raise exception 'ADHESION_INVALIDE' using errcode = '22023';
    end if;
  end loop;

  v_nom         := nullif(public.nettoyer_texte_saisie(p_adherent ->> 'nom'), '');
  v_prenom      := nullif(public.nettoyer_texte_saisie(p_adherent ->> 'prenom'), '');
  v_adresse     := nullif(public.nettoyer_texte_saisie(p_adherent ->> 'adresse'), '');
  v_code_postal := nullif(public.nettoyer_texte_saisie(p_adherent ->> 'code_postal'), '');
  v_ville       := nullif(public.nettoyer_texte_saisie(p_adherent ->> 'ville'), '');
  v_pays        := nullif(public.nettoyer_texte_saisie(p_adherent ->> 'pays'), '');
  v_telephone   := nullif(public.nettoyer_texte_saisie(p_adherent ->> 'telephone'), '');
  v_courriel    := nullif(public.nettoyer_texte_saisie(p_adherent ->> 'courriel'), '');

  if jsonb_typeof(p_adherent -> 'civilite') is distinct from 'number'
     or (p_adherent ->> 'civilite') not in ('0', '1', '2') then
    raise exception 'ADHESION_INVALIDE' using errcode = '22023';
  end if;
  v_civilite := (p_adherent ->> 'civilite')::smallint;

  if v_nom is null or v_code_postal is null or v_code_postal !~ '^[0-9]{5}$' then
    raise exception 'ADHESION_INVALIDE' using errcode = '22023';
  end if;
  if v_telephone is not null and v_telephone !~ '^[0-9 +().-]+$' then
    raise exception 'ADHESION_INVALIDE' using errcode = '22023';
  end if;
  if v_courriel is not null and v_courriel !~ '^[^[:space:]@]+@[^[:space:]@]+\.[A-Za-z]{2,24}$' then
    raise exception 'ADHESION_INVALIDE' using errcode = '22023';
  end if;

  if nullif(public.nettoyer_texte_saisie(p_adherent ->> 'date_naissance'), '') is not null then
    if public.nettoyer_texte_saisie(p_adherent ->> 'date_naissance') !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' then
      raise exception 'ADHESION_INVALIDE' using errcode = '22023';
    end if;
    begin
      v_date_naissance := public.nettoyer_texte_saisie(p_adherent ->> 'date_naissance')::date;
    exception when others then
      raise exception 'ADHESION_INVALIDE' using errcode = '22023';
    end;
    if to_char(v_date_naissance, 'YYYY-MM-DD') <> public.nettoyer_texte_saisie(p_adherent ->> 'date_naissance')
       or extract(year from v_date_naissance) < 1900
       or extract(year from v_date_naissance) > extract(year from current_date) - 1 then
      raise exception 'ADHESION_INVALIDE' using errcode = '22023';
    end if;
  end if;

  -- Consentements (statuts exigés seulement si l'organisation en publie).
  select o.statuts_url into v_statuts_url from public.organisations o where o.id = p_organisation_id;
  if not coalesce(p_consent_rgpd, false) then
    raise exception 'CONSENTEMENT_REQUIS' using errcode = '22023';
  end if;
  if v_statuts_url is not null and not coalesce(p_accepte_statuts, false) then
    raise exception 'STATUTS_REQUIS' using errcode = '22023';
  end if;

  -- Signature : tactile XOR papier.
  if v_papier then
    if p_signature_data_url is not null then
      raise exception 'SIGNATURE_INVALIDE' using errcode = '22023';
    end if;
  elsif p_signature_data_url is null
     or left(p_signature_data_url, length(c_signature_prefixe)) <> c_signature_prefixe
     or length(p_signature_data_url) > 300000
     or substr(p_signature_data_url, length(c_signature_prefixe) + 1) !~ '^[A-Za-z0-9+/]+=*$' then
    raise exception 'SIGNATURE_INVALIDE' using errcode = '22023';
  end if;

  -- Adhésion.
  if p_date_debut is null then
    raise exception 'DATE_ADHESION_REQUISE' using errcode = '22023';
  end if;
  if p_date_debut < date '1900-01-01' or p_date_debut > (current_date + interval '1 year')::date then
    raise exception 'DATE_ADHESION_INVALIDE' using errcode = '22023';
  end if;
  -- NaN et Infinity (numeric) refusés explicitement ; borne haute raisonnable.
  if p_montant_cotisation is not null
     and (p_montant_cotisation = 'NaN'::numeric
          or p_montant_cotisation < 0
          or p_montant_cotisation > 100000) then
    raise exception 'MONTANT_INVALIDE' using errcode = '22023';
  end if;
  if p_mode_paiement is not null and p_mode_paiement not in (1, 2, 3, 4) then
    raise exception 'MODE_PAIEMENT_INVALIDE' using errcode = '22023';
  end if;

  v_doublon := public.adherent_doublon_existe(p_organisation_id, v_nom, v_prenom, v_courriel);
  v_id_externe := public.attribuer_numero_adherent(p_organisation_id);

  insert into public.adherents (
    id, organisation_id, id_externe, civilite, nom, prenom, date_naissance, adresse, code_postal,
    ville, pays, telephone, courriel, statuts_acceptes, consent_rgpd
  ) values (
    v_adherent_id, p_organisation_id, v_id_externe, v_civilite, v_nom, v_prenom, v_date_naissance,
    v_adresse, v_code_postal, v_ville, v_pays, v_telephone, v_courriel, true, true
  );

  -- date_fin posée par trg_adhesions_poser_date_fin selon la règle de l'organisation.
  insert into public.adhesions (
    id, adherent_id, date_debut, montant_cotisation, mode_paiement, renouvellement, bulletin_signe
  ) values (
    v_adhesion_id, v_adherent_id, p_date_debut, p_montant_cotisation, p_mode_paiement, false, true
  )
  returning date_fin into v_date_fin;

  if not v_papier then
    insert into public.signatures_adhesion (adhesion_id, organisation_id, signature_data_url)
    values (v_adhesion_id, p_organisation_id, p_signature_data_url);
  end if;

  insert into public.journal_modifications (organisation_id, table_cible, ligne_id, action, details, auteur_id)
  values (
    p_organisation_id, 'adherents', v_adherent_id, 'creation',
    jsonb_build_object(
      'nom', v_nom, 'prenom', v_prenom, 'origine', 'benevole', 'adhesion_id', v_adhesion_id,
      'signature', case when v_papier then 'papier' else 'tactile' end
    ),
    auth.uid()
  );

  return jsonb_build_object(
    'adherent_id', v_adherent_id,
    'adhesion_id', v_adhesion_id,
    'id_externe', v_id_externe,
    'date_fin', v_date_fin,
    'doublon', v_doublon
  );
end;
$function$
;
CREATE OR REPLACE FUNCTION public.creer_commande_en_attente(p_evenement_id uuid, p_email text, p_montant_centimes integer, p_cle_idempotence text, p_portefeuille_id uuid DEFAULT NULL::uuid)
 RETURNS commandes
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
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
$function$
;
CREATE OR REPLACE FUNCTION public.creer_credit_manuel(p_evenement_id uuid, p_email text, p_montant_centimes integer, p_portefeuille_id uuid DEFAULT NULL::uuid)
 RETURNS TABLE(ok boolean, raison text, portefeuille_id uuid, code_public text, secret text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
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

  -- Crédit sans encaissement : activable uniquement par le super-admin, pour tout le
  -- monde (super-admin compris, il active d'abord la fonctionnalité).
  if not coalesce((
    select (o.fonctionnalites_activees ->> 'credit_manuel')::boolean
    from public.organisations o
    where o.id = v_event.organisation_id
  ), false) then
    return query select false, 'CREDIT_MANUEL_DESACTIVE', null::uuid, null::text, null::text;
    return;
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
$function$
;
CREATE OR REPLACE FUNCTION public.creer_demande_paiement(p_evenement_id uuid, p_code_public text, p_montant_centimes integer)
 RETURNS TABLE(ok boolean, raison text, demande_id uuid)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
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
$function$
;
CREATE OR REPLACE FUNCTION public.creer_organisation(p_nom text, p_slug text, p_templates_recu jsonb, p_template_carte jsonb, p_fonctionnalites_activees jsonb DEFAULT NULL::jsonb, p_modele_recu_pdf jsonb DEFAULT NULL::jsonb, p_ville text DEFAULT NULL::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_id uuid;
begin
  if coalesce(btrim(p_nom), '') = '' then
    raise exception 'NOM_INVALIDE' using errcode = '22023';
  end if;
  if coalesce(p_slug, '') !~ '^[a-z0-9]+(-[a-z0-9]+)*$' then
    raise exception 'SLUG_INVALIDE' using errcode = '22023';
  end if;
  if jsonb_typeof(p_templates_recu) is distinct from 'array' or jsonb_array_length(p_templates_recu) = 0 then
    raise exception 'TEMPLATES_RECU_INVALIDES' using errcode = '22023';
  end if;
  if jsonb_typeof(p_template_carte) is distinct from 'object' then
    raise exception 'TEMPLATE_CARTE_INVALIDE' using errcode = '22023';
  end if;
  if p_fonctionnalites_activees is not null and jsonb_typeof(p_fonctionnalites_activees) <> 'object' then
    raise exception 'FONCTIONNALITES_INVALIDES' using errcode = '22023';
  end if;
  if p_modele_recu_pdf is not null and jsonb_typeof(p_modele_recu_pdf) <> 'object' then
    raise exception 'MODELE_RECU_PDF_INVALIDE' using errcode = '22023';
  end if;

  insert into public.organisations (nom, slug, ville)
  values (p_nom, p_slug, nullif(btrim(coalesce(p_ville, '')), ''))
  returning id into v_id;

  -- Mises à jour dans la même transaction (le trigger des fonctionnalités ne bloque pas :
  -- aucune session, auth.uid() vaut NULL sous service_role).
  -- Seuls dons et adherents sont activables à la création (jamais evenements ni credit_manuel,
  -- laissés au super-admin après coup) : les autres clés sont ignorées.
  if p_fonctionnalites_activees is not null then
    update public.organisations
      set fonctionnalites_activees = fonctionnalites_activees || coalesce((
        select jsonb_object_agg(f.key, f.value)
        from jsonb_each(p_fonctionnalites_activees) as f(key, value)
        where f.key in ('dons', 'adherents') and jsonb_typeof(f.value) = 'boolean'
      ), '{}'::jsonb)
      where id = v_id;
  end if;
  if p_modele_recu_pdf is not null then
    update public.organisations
      set modele_recu_pdf = coalesce(modele_recu_pdf, '{}'::jsonb) || p_modele_recu_pdf
      where id = v_id;
  end if;

  insert into public.templates_recu (organisation_id, nom, type_cerfa, html_template, css, is_active)
  select v_id, t.nom, t.type_cerfa, t.html_template, t.css, true
  from jsonb_to_recordset(p_templates_recu) as t(nom text, type_cerfa text, html_template text, css text);

  insert into public.templates_carte_adherent (organisation_id, nom, html_template, css, is_active)
  values (
    v_id,
    p_template_carte ->> 'nom',
    p_template_carte ->> 'html_template',
    p_template_carte ->> 'css',
    true
  );

  return v_id;
end;
$function$
;
CREATE OR REPLACE FUNCTION public.creer_secrets_organisation()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
begin
  insert into public.organisation_secrets (organisation_id, code_pin_benevole)
  values (new.id, public.generer_pin_unique('code_pin_benevole'))
  on conflict (organisation_id) do nothing;
  return new;
end;
$function$
;
CREATE OR REPLACE FUNCTION public.current_benevole_organisation_id()
 RETURNS uuid
 LANGUAGE sql
 STABLE
AS $function$
  select ((select auth.jwt()) -> 'app_metadata' ->> 'organisation_id')::uuid
  where ((select auth.jwt()) -> 'app_metadata' ->> 'role') = 'benevole';
$function$
;
CREATE OR REPLACE FUNCTION public.current_effective_organisation_id()
 RETURNS uuid
 LANGUAGE sql
 STABLE
AS $function$
  select coalesce(
    current_user_organisation_id(),
    current_benevole_organisation_id()
  );
$function$
;
CREATE OR REPLACE FUNCTION public.current_user_organisation_id()
 RETURNS uuid
 LANGUAGE sql
 STABLE SECURITY DEFINER
AS $function$
  select organisation_id
  from profils_organisation
  where utilisateur_id = (select auth.uid())
  limit 1;
$function$
;
CREATE OR REPLACE FUNCTION public.current_user_role()
 RETURNS text
 LANGUAGE sql
 STABLE SECURITY DEFINER
AS $function$
  select role from profils_organisation
  where utilisateur_id = auth.uid()
  limit 1;
$function$
;
CREATE OR REPLACE FUNCTION public.current_vendeur_organisation_id()
 RETURNS uuid
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  select ((select auth.jwt()) -> 'app_metadata' ->> 'organisation_id')::uuid
  where ((select auth.jwt()) -> 'app_metadata' ->> 'role') = 'vendeur';
$function$
;
CREATE OR REPLACE FUNCTION public.decider_demande_paiement(p_portefeuille_id uuid, p_demande_id uuid, p_valider boolean)
 RETURNS TABLE(ok boolean, raison text, statut text, solde_apres_centimes integer)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
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
$function$
;
CREATE OR REPLACE FUNCTION public.definir_config_brevo(p_organisation_id uuid, p_cle text, p_expediteur_nom text, p_expediteur_email text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
begin
  if not public.peut_gerer_secrets(p_organisation_id, true) then
    raise exception 'ACCES_REFUSE' using errcode = '42501';
  end if;
  update public.organisations
  set brevo_expediteur_nom = nullif(trim(p_expediteur_nom), ''),
      brevo_expediteur_email = nullif(trim(p_expediteur_email), '')
  where id = p_organisation_id;
  if nullif(trim(coalesce(p_cle, '')), '') is not null then
    insert into public.organisation_secrets (organisation_id, brevo_api_key)
    values (p_organisation_id, trim(p_cle))
    on conflict (organisation_id) do update set brevo_api_key = excluded.brevo_api_key, updated_at = now();
  end if;
end;
$function$
;
CREATE OR REPLACE FUNCTION public.definir_notification_demandes(p_utilisateur_id uuid, p_organisation_id uuid, p_actif boolean)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
begin
  if p_actif is null then
    raise exception 'VALEUR_INVALIDE' using errcode = '22023';
  end if;
  -- coalesce : garde strictement booléenne (NULL pour une session sans profil d'organisation).
  if not coalesce(
    public.is_current_user_super_admin()
    or (auth.uid() = p_utilisateur_id and public.current_user_organisation_id() = p_organisation_id)
    or (public.current_user_role() = 'admin' and public.current_user_organisation_id() = p_organisation_id),
    false
  ) then
    raise exception 'ACCES_REFUSE' using errcode = '42501';
  end if;

  update public.profils_organisation
  set notif_demandes_adhesion = p_actif,
      notif_demandes_adhesion_updated_at = now()
  where utilisateur_id = p_utilisateur_id
    and organisation_id = p_organisation_id
    and role in ('admin', 'contributeur');
  if not found then
    raise exception 'COMPTE_INTROUVABLE' using errcode = 'P0002';
  end if;
end;
$function$
;
CREATE OR REPLACE FUNCTION public.demandes_adhesion_verifier_adherent_vise()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if new.adherent_vise_id is not null and not coalesce(exists (
    select 1 from public.adherents a where a.id = new.adherent_vise_id and a.organisation_id = new.organisation_id
  ), false) then
    raise exception 'Adhérent hors organisation' using errcode = 'check_violation';
  end if;
  return new;
end;
$function$
;
CREATE OR REPLACE FUNCTION public.enregistrer_version_recu(p_profil_participant_id uuid, p_organisation_id uuid, p_annee integer, p_version integer, p_montant_total numeric, p_fichier_url text, p_numero_ordre text, p_type_cerfa text, p_template_id uuid, p_snapshot_donateur jsonb, p_snapshot_organisation jsonb, p_genere_par uuid)
 RETURNS TABLE(recu_id uuid, version integer)
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare
  v_ancien public.recus_fiscaux%rowtype;
  v_recu_id uuid;
  v_attendue integer;
  v_maintenant timestamptz := now();
begin
  -- Verrou de la fiche existante : deux régénérations simultanées s'ordonnent ici.
  select * into v_ancien
    from public.recus_fiscaux rf
   where rf.profil_participant_id = p_profil_participant_id and rf.annee = p_annee
   for update;

  -- Reçu antérieur aux versions (créé avant cette migration ou entre la migration et le déploiement
  -- de generate-recu) : son fichier actuel devient la version 1 avant d'être supplanté.
  if found and v_ancien.fichier_url is not null and not exists (
    select 1 from public.recus_fiscaux_versions v where v.recu_id = v_ancien.id
  ) then
    insert into public.recus_fiscaux_versions (recu_id, organisation_id, version, fichier_url, numero_ordre,
        montant_total, type_cerfa, template_id, snapshot_donateur, snapshot_organisation, genere_le, email_envoye_le)
      values (v_ancien.id, v_ancien.organisation_id, 1, v_ancien.fichier_url, v_ancien.numero_ordre,
        v_ancien.montant_total, v_ancien.type_cerfa, v_ancien.template_id, v_ancien.snapshot_donateur,
        v_ancien.snapshot_organisation, coalesce(v_ancien.date_generation, v_maintenant),
        case when v_ancien.email_envoye_at >= v_ancien.date_generation then v_ancien.email_envoye_at end);
  end if;

  select coalesce(max(v.version), 0) + 1 into v_attendue
    from public.recus_fiscaux_versions v
   where v.recu_id = v_ancien.id;

  if p_version is distinct from v_attendue then
    raise exception 'Reçu fiscal : version % proposée, version % attendue (génération simultanée)', p_version, v_attendue
      using errcode = 'unique_violation';
  end if;

  insert into public.recus_fiscaux as rf (profil_participant_id, organisation_id, annee, montant_total, fichier_url,
      date_generation, numero_ordre, type_cerfa, template_id, snapshot_donateur, snapshot_organisation)
    values (p_profil_participant_id, p_organisation_id, p_annee, p_montant_total, p_fichier_url,
      v_maintenant, p_numero_ordre, p_type_cerfa, p_template_id, p_snapshot_donateur, p_snapshot_organisation)
    on conflict (profil_participant_id, annee) do update set
      organisation_id = excluded.organisation_id,
      montant_total = excluded.montant_total,
      fichier_url = excluded.fichier_url,
      date_generation = excluded.date_generation,
      numero_ordre = excluded.numero_ordre,
      type_cerfa = excluded.type_cerfa,
      template_id = excluded.template_id,
      snapshot_donateur = excluded.snapshot_donateur,
      snapshot_organisation = excluded.snapshot_organisation
    returning rf.id into v_recu_id;

  insert into public.recus_fiscaux_versions (recu_id, organisation_id, version, fichier_url, numero_ordre,
      montant_total, type_cerfa, template_id, snapshot_donateur, snapshot_organisation, genere_le, genere_par)
    values (v_recu_id, p_organisation_id, p_version, p_fichier_url, p_numero_ordre, p_montant_total,
      p_type_cerfa, p_template_id, p_snapshot_donateur, p_snapshot_organisation, v_maintenant, p_genere_par);

  return query select v_recu_id, p_version;
end;
$function$
;
CREATE OR REPLACE FUNCTION public.envois_recus_depuis(p_organisation_id uuid, p_depuis timestamp with time zone)
 RETURNS integer
 LANGUAGE sql
 STABLE
 SET search_path TO ''
AS $function$
  select (
    (select count(*) from public.recus_fiscaux_versions v
      where v.organisation_id = p_organisation_id and v.email_envoye_le > p_depuis)
    + (select count(*) from public.recus_lot_lignes g
      where g.organisation_id = p_organisation_id and g.statut = 'a_verifier' and g.modifie_le > p_depuis)
  )::integer
$function$
;
CREATE OR REPLACE FUNCTION public.est_dernier_admin_actif(p_utilisateur_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'auth'
AS $function$
  select exists (
    select 1
    from profils_organisation cible
    join auth.users cu on cu.id = cible.utilisateur_id
    where cible.utilisateur_id = p_utilisateur_id
      and cible.role = 'admin'
      and (cu.banned_until is null or cu.banned_until <= now())
      and not exists (
        select 1
        from profils_organisation autre
        join auth.users au on au.id = autre.utilisateur_id
        where autre.organisation_id = cible.organisation_id
          and autre.role = 'admin'
          and autre.utilisateur_id <> cible.utilisateur_id
          and (au.banned_until is null or au.banned_until <= now())
      )
  );
$function$
;
CREATE OR REPLACE FUNCTION public.etat_config_brevo(p_organisation_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
begin
  if not public.peut_gerer_secrets(p_organisation_id, false) then
    raise exception 'ACCES_REFUSE' using errcode = '42501';
  end if;
  return (
    select jsonb_build_object(
      'cle_configuree', coalesce(nullif(trim(s.brevo_api_key), ''), null) is not null,
      'expediteur_nom', o.brevo_expediteur_nom,
      'expediteur_email', o.brevo_expediteur_email
    )
    from public.organisations o
    left join public.organisation_secrets s on s.organisation_id = o.id
    where o.id = p_organisation_id
  );
end;
$function$
;
CREATE OR REPLACE FUNCTION public.evenements_organisation_immuable()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
begin
  if new.organisation_id is distinct from old.organisation_id then
    raise exception 'ORGANISATION_IMMUABLE';
  end if;
  return new;
end;
$function$
;
CREATE OR REPLACE FUNCTION public.geler_portefeuille(p_portefeuille_id uuid, p_gele boolean)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
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
$function$
;
CREATE OR REPLACE FUNCTION public.generer_pin_unique(p_colonne text)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions', 'pg_temp'
AS $function$
declare
  v_pin text;
  v_existe boolean;
begin
  if p_colonne not in ('code_pin_benevole', 'code_pin_vendeur_evenement') then
    raise exception 'COLONNE_INVALIDE' using errcode = '22023';
  end if;
  loop
    v_pin := (100000 + (('x' || encode(gen_random_bytes(4), 'hex'))::bit(32)::bigint % 900000))::text;
    execute format('select exists (select 1 from public.organisation_secrets where %I = $1)', p_colonne)
      into v_existe using v_pin;
    exit when not v_existe;
  end loop;
  return v_pin;
end;
$function$
;
CREATE OR REPLACE FUNCTION public.get_evenement_public(p_org_slug text, p_slug text)
 RETURNS TABLE(id uuid, nom text, date_evenement date, date_fin date, montants_credit_centimes integer[], nom_organisation text, conservation_evenements_mois integer, url_politique_confidentialite text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  select e.id, e.nom, e.date_evenement, e.date_fin, e.montants_credit_centimes, o.nom,
    o.conservation_evenements_mois, o.url_politique_confidentialite
  from public.evenements e join public.organisations o on o.id = e.organisation_id
  where o.slug = p_org_slug and e.slug = p_slug and e.statut = 'ouvert'
    and o.fonctionnalites_activees -> 'evenements' = 'true'::jsonb;
$function$
;
CREATE OR REPLACE FUNCTION public.get_org_admins(org_id uuid)
 RETURNS TABLE(utilisateur_id uuid, nom_affiche text, email text, role text, created_at timestamp with time zone, is_banned boolean, notif_demandes_adhesion boolean)
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
begin
  -- coalesce (audit 2026-10-24) : sans profil d'organisation (session bénévole/vendeur), les
  -- helpers renvoient NULL et « if not NULL » laissait passer — fuite des comptes de toute org.
  if not coalesce(
    (auth.jwt() -> 'app_metadata' ->> 'is_super_admin')::boolean = true
    or (current_user_role() = 'admin' and current_user_organisation_id() = org_id),
    false
  ) then
    raise exception 'Unauthorized';
  end if;
  return query
    select
      po.utilisateur_id,
      po.nom_affiche,
      au.email::text,
      po.role,
      po.created_at,
      (au.banned_until is not null and au.banned_until > now()) as is_banned,
      po.notif_demandes_adhesion
    from profils_organisation po
    join auth.users au on au.id = po.utilisateur_id
    where po.organisation_id = org_id
      and po.role in ('admin', 'contributeur')
    order by po.created_at asc;
end;
$function$
;
CREATE OR REPLACE FUNCTION public.get_organisation_logo_url(p_organisation_id uuid)
 RETURNS text
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_url text;
begin
  if not coalesce(
    ((select auth.jwt()) -> 'app_metadata' ->> 'is_super_admin')::boolean = true
      or p_organisation_id = (select current_effective_organisation_id()),
    false
  ) then
    raise exception 'Accès refusé' using errcode = 'insufficient_privilege';
  end if;

  select a.url into v_url
  from public.organisations o
  join public.organisation_assets a on a.id = o.logo_asset_id
  where o.id = p_organisation_id;

  return v_url;
end;
$function$
;
CREATE OR REPLACE FUNCTION public.get_organisation_public(p_slug text)
 RETURNS TABLE(nom text, statuts_url text, formulaire_adhesion_header_html text, formulaire_adhesion_footer_html text, formulaire_adhesion_css text, formulaire_adhesion_message_succes text, assets jsonb)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select
    o.nom,
    o.statuts_url,
    o.formulaire_adhesion_header_html,
    o.formulaire_adhesion_footer_html,
    o.formulaire_adhesion_css,
    o.formulaire_adhesion_message_succes,
    coalesce(
      (
        select jsonb_agg(jsonb_build_object('identifiant', a.identifiant, 'url', a.url))
        from organisation_assets a
        where a.organisation_id = o.id
      ),
      '[]'::jsonb
    ) as assets
  from organisations o
  where o.slug = p_slug;
$function$
;
CREATE OR REPLACE FUNCTION public.import_upsert_activites(payload jsonb, p_organisation_id uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_org uuid := coalesce(current_user_organisation_id(), case when is_current_user_super_admin() then p_organisation_id end);
  v_total int;
  v_existing_ids uuid[];
  v_created int;
  v_updated int;
begin
  if v_org is null then
    raise exception 'Unauthorized: no organisation context';
  end if;

  create temporary table _import_activites on commit drop as
  select * from jsonb_to_recordset(payload) as r(
    id          uuid,
    id_externe  text,
    nom         text,
    date_debut  date,
    date_fin    date
  );

  v_total := (select count(*) from _import_activites where id is not null);

  select array_agg(a.id) into v_existing_ids
  from activites a
  join _import_activites t on t.id = a.id
  where a.organisation_id = v_org;

  insert into activites (id, organisation_id, nom, id_externe, date_debut, date_fin)
  select id, v_org, nom, id_externe, date_debut, date_fin
  from _import_activites
  where id is not null
  on conflict (id) do update set
    nom = excluded.nom,
    id_externe = excluded.id_externe,
    date_debut = excluded.date_debut,
    date_fin = excluded.date_fin
  where activites.organisation_id = v_org;

  v_updated := coalesce(array_length(v_existing_ids, 1), 0);
  v_created := v_total - v_updated;

  return jsonb_build_object('created', v_created, 'updated', v_updated, 'total', v_total);
end;
$function$
;
CREATE OR REPLACE FUNCTION public.import_upsert_adherents(payload jsonb, p_organisation_id uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_org uuid := coalesce(current_user_organisation_id(), case when is_current_user_super_admin() then p_organisation_id end);
  v_total int;
  v_existing_ids uuid[];
  v_created int;
  v_updated int;
  v_adhesions_created int;
begin
  if v_org is null then
    raise exception 'Unauthorized: no organisation context';
  end if;

  create temporary table _import_adherents on commit drop as
  select * from jsonb_to_recordset(payload) as r(
    adherent_id              uuid,
    id_externe               text,
    civilite                 smallint,
    nom                      text,
    prenom                   text,
    date_naissance           date,
    adresse                  text,
    code_postal              text,
    ville                    text,
    telephone                text,
    courriel                 text,
    adhesion_id              uuid,
    date_debut               date,
    montant_cotisation       numeric,
    date_paiement_cotisation date,
    mode_paiement            smallint,
    droit_vote_ag            boolean,
    bulletin_signe           boolean,
    renouvellement           boolean
  );

  v_total := (select count(*) from _import_adherents where adherent_id is not null);

  select array_agg(a.id) into v_existing_ids
  from adherents a
  join _import_adherents t on t.adherent_id = a.id
  where a.organisation_id = v_org;

  insert into adherents (id, organisation_id, id_externe, civilite, nom, prenom, date_naissance, adresse, code_postal, ville, telephone, courriel)
  select adherent_id, v_org, id_externe, coalesce(civilite, 0), nom, prenom, date_naissance, adresse, code_postal, ville, telephone, courriel
  from _import_adherents
  where adherent_id is not null
  on conflict (id) do update set
    id_externe = excluded.id_externe,
    civilite = excluded.civilite,
    nom = excluded.nom,
    prenom = excluded.prenom,
    date_naissance = excluded.date_naissance,
    adresse = excluded.adresse,
    code_postal = excluded.code_postal,
    ville = excluded.ville,
    telephone = excluded.telephone,
    courriel = excluded.courriel
  where adherents.organisation_id = v_org;

  insert into adhesions (id, adherent_id, date_debut, date_fin, montant_cotisation, date_paiement_cotisation, mode_paiement, renouvellement, droit_vote_ag, bulletin_signe)
  select adhesion_id, adherent_id, date_debut, public.calculer_date_fin_adhesion(v_org, date_debut), montant_cotisation, date_paiement_cotisation, mode_paiement,
         coalesce(renouvellement, false), coalesce(droit_vote_ag, true), coalesce(bulletin_signe, true)
  from _import_adherents
  where adhesion_id is not null and adherent_id is not null;

  v_updated := coalesce(array_length(v_existing_ids, 1), 0);
  v_created := v_total - v_updated;
  v_adhesions_created := (select count(*) from _import_adherents where adhesion_id is not null);

  return jsonb_build_object('created', v_created, 'updated', v_updated, 'total', v_total, 'adhesions_created', v_adhesions_created);
end;
$function$
;
CREATE OR REPLACE FUNCTION public.import_upsert_dons(payload jsonb, p_organisation_id uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_org uuid := coalesce(current_user_organisation_id(), case when is_current_user_super_admin() then p_organisation_id end);
  v_total int;
  v_valid int;
  v_existing_ids uuid[];
  v_created int;
  v_updated int;
  v_skipped int;
begin
  if v_org is null then
    raise exception 'Unauthorized: no organisation context';
  end if;

  create temporary table _import_dons on commit drop as
  select * from jsonb_to_recordset(payload) as r(
    id                     uuid,
    id_externe             text,
    profil_participant_id  uuid,
    activite_id            uuid,
    montant                numeric(10,2),
    date                   date,
    mode_paiement          smallint
  );

  v_total := (select count(*) from _import_dons where id is not null);

  create temporary table _import_dons_valid on commit drop as
  select t.*
  from _import_dons t
  join profils_participant pp on pp.id = t.profil_participant_id and pp.organisation_id = v_org
  left join activites a on a.id = t.activite_id and a.organisation_id = v_org
  where t.id is not null
    and (t.activite_id is null or a.id is not null);

  v_valid := (select count(*) from _import_dons_valid);
  v_skipped := v_total - v_valid;

  select array_agg(d.id) into v_existing_ids
  from dons d
  join _import_dons_valid t on t.id = d.id
  where d.organisation_id = v_org;

  insert into dons (id, organisation_id, profil_participant_id, activite_id, montant, date, mode_paiement, id_externe, created_by_role)
  select id, v_org, profil_participant_id, activite_id, montant, date, mode_paiement, id_externe, 'admin'
  from _import_dons_valid
  on conflict (id) do update set
    profil_participant_id = excluded.profil_participant_id,
    activite_id = excluded.activite_id,
    montant = excluded.montant,
    date = excluded.date,
    mode_paiement = excluded.mode_paiement,
    id_externe = excluded.id_externe
  where dons.organisation_id = v_org;

  v_updated := coalesce(array_length(v_existing_ids, 1), 0);
  v_created := v_valid - v_updated;

  return jsonb_build_object('created', v_created, 'updated', v_updated, 'skipped', v_skipped, 'total', v_total);
end;
$function$
;
CREATE OR REPLACE FUNCTION public.import_upsert_participants(payload jsonb, p_organisation_id uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_org uuid := coalesce(current_user_organisation_id(), case when is_current_user_super_admin() then p_organisation_id end);
  v_total int;
  v_existing_profil_ids uuid[];
  v_created int;
  v_updated int;
begin
  if v_org is null then
    raise exception 'Unauthorized: no organisation context';
  end if;

  create temporary table _import_participants on commit drop as
  select * from jsonb_to_recordset(payload) as r(
    personne_id  uuid,
    profil_id    uuid,
    id_externe   text,
    nom          text,
    prenom       text,
    civilite     smallint,
    email        text,
    telephone    text,
    adresse      text,
    code_postal  text,
    ville        text,
    pays         text,
    nom2         text,
    prenom2      text,
    notes        text
  );

  v_total := (select count(*) from _import_participants where personne_id is not null and profil_id is not null);

  select array_agg(pp.id) into v_existing_profil_ids
  from profils_participant pp
  join _import_participants t on t.profil_id = pp.id
  where pp.organisation_id = v_org;

  insert into personnes (id, nom, prenom, civilite, email, telephone, adresse, code_postal, ville, pays, nom2, prenom2)
  select personne_id, nom, prenom, civilite, email, telephone, adresse, code_postal, ville, pays, nom2, prenom2
  from _import_participants
  where personne_id is not null and profil_id is not null
  on conflict (id) do update set
    nom = excluded.nom,
    prenom = excluded.prenom,
    civilite = excluded.civilite,
    email = excluded.email,
    telephone = excluded.telephone,
    adresse = excluded.adresse,
    code_postal = excluded.code_postal,
    ville = excluded.ville,
    pays = excluded.pays,
    nom2 = excluded.nom2,
    prenom2 = excluded.prenom2
  where exists (
    select 1 from profils_participant pp
    where pp.personne_id = personnes.id and pp.organisation_id = v_org
  );

  insert into profils_participant (id, personne_id, organisation_id, notes, id_externe)
  select profil_id, personne_id, v_org, notes, id_externe
  from _import_participants
  where personne_id is not null and profil_id is not null
  order by (nullif(btrim(id_externe), '') is null)
  on conflict (id) do update set
    notes = excluded.notes,
    id_externe = excluded.id_externe
  where profils_participant.organisation_id = v_org;

  v_updated := coalesce(array_length(v_existing_profil_ids, 1), 0);
  v_created := v_total - v_updated;

  return jsonb_build_object('created', v_created, 'updated', v_updated, 'total', v_total);
end;
$function$
;
CREATE OR REPLACE FUNCTION public.is_current_user_super_admin()
 RETURNS boolean
 LANGUAGE sql
 STABLE
AS $function$
  select coalesce(((select auth.jwt()) -> 'app_metadata' ->> 'is_super_admin')::boolean, false);
$function$
;
CREATE OR REPLACE FUNCTION public.is_organisation_row_accessible(row_organisation_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE
AS $function$
  select is_current_user_super_admin() or row_organisation_id = (select current_effective_organisation_id());
$function$
;
CREATE OR REPLACE FUNCTION public.lancer_lot_envoi_recus(p_organisation_id uuid, p_annee integer)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_lot_id uuid;
  v_total integer;
  v_ligne record;
begin
  if not coalesce(
    public.is_current_user_super_admin()
    or (p_organisation_id = public.current_user_organisation_id()
        and public.current_user_role() in ('admin', 'contributeur')),
    false
  ) then
    raise exception 'ACCES_REFUSE' using errcode = '42501';
  end if;

  if p_annee is null or p_annee < 2000 or p_annee > 2100 then
    raise exception 'ANNEE_INVALIDE';
  end if;

  -- Envoi en lot réservé à Brevo (voir brevo_configure_organisation).
  if not coalesce(public.brevo_configure_organisation(p_organisation_id), false) then
    raise exception 'BREVO_REQUIS';
  end if;

  if exists (
    select 1 from public.recus_lots l
     where l.organisation_id = p_organisation_id and l.annee = p_annee
       and l.type = 'envoi' and l.statut = 'en_cours'
  ) then
    raise exception 'LOT_DEJA_EN_COURS';
  end if;

  -- Lot d'envoi arrêté dont une exécution tient encore le bail : l'email en cours d'envoi n'est pas
  -- encore marqué, la relance attend sa fin.
  if exists (
    select 1 from public.recus_lots l
     where l.organisation_id = p_organisation_id and l.annee = p_annee
       and l.type = 'envoi' and l.statut <> 'en_cours'
       and l.traitement_jusqu_a is not null and l.traitement_jusqu_a > now()
  ) then
    raise exception 'ENVOI_EN_COURS';
  end if;

  -- Lignes restées « en_cours » dans un lot d'envoi arrêté (exécution interrompue pendant l'envoi) :
  -- classées comme ligne_suivante_lot_recus le fait pour un lot en cours, avant de choisir les reçus.
  for v_ligne in
    select g.id, g.lot_id
      from public.recus_lot_lignes g
      join public.recus_lots l on l.id = g.lot_id
     where l.organisation_id = p_organisation_id and l.annee = p_annee
       and l.type = 'envoi' and l.statut <> 'en_cours' and g.statut = 'en_cours'
  loop
    perform public.classer_ligne_envoi_interrompue(v_ligne.id);
    perform public.recompter_lot_recus(v_ligne.lot_id);
  end loop;

  -- Génération en lot de la même année en cours (ou arrêtée avec un reçu encore en génération) :
  -- l'envoi attend sa fin.
  if exists (
    select 1 from public.recus_lots l
     where l.organisation_id = p_organisation_id and l.annee = p_annee and l.type = 'generation'
       and (l.statut = 'en_cours' or (l.traitement_jusqu_a is not null and l.traitement_jusqu_a > now()))
  ) then
    raise exception 'GENERATION_EN_COURS';
  end if;

  insert into public.recus_lots (organisation_id, annee, type, cree_par)
    values (p_organisation_id, p_annee, 'envoi', auth.uid())
    returning id into v_lot_id;

  insert into public.recus_lot_lignes (lot_id, organisation_id, profil_participant_id, rang, recu_id, version_id)
    select v_lot_id, p_organisation_id, e.profil_participant_id,
           (row_number() over (order by e.rang))::integer, e.recu_id, e.version_id
      from public.recus_envoi_lot(p_organisation_id, p_annee) e
     where e.raison is null;
  get diagnostics v_total = row_count;

  if v_total = 0 then
    raise exception 'AUCUN_RECU_A_ENVOYER';
  end if;

  update public.recus_lots set nb_total = v_total where id = v_lot_id;
  return v_lot_id;
exception
  when unique_violation then
    raise exception 'LOT_DEJA_EN_COURS';
end;
$function$
;
CREATE OR REPLACE FUNCTION public.lancer_lot_recus(p_organisation_id uuid, p_annee integer)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_lot_id uuid;
  v_total integer;
begin
  if not coalesce(
    public.is_current_user_super_admin()
    or (p_organisation_id = public.current_user_organisation_id()
        and public.current_user_role() in ('admin', 'contributeur')),
    false
  ) then
    raise exception 'ACCES_REFUSE' using errcode = '42501';
  end if;

  if p_annee is null or p_annee < 2000 or p_annee > 2100 then
    raise exception 'ANNEE_INVALIDE';
  end if;

  if exists (
    select 1 from public.recus_lots l
     where l.organisation_id = p_organisation_id and l.annee = p_annee
       and l.type = 'generation' and l.statut = 'en_cours'
  ) then
    raise exception 'LOT_DEJA_EN_COURS';
  end if;

  insert into public.recus_lots (organisation_id, annee, type, cree_par)
    values (p_organisation_id, p_annee, 'generation', auth.uid())
    returning id into v_lot_id;

  insert into public.recus_lot_lignes (lot_id, organisation_id, profil_participant_id, rang)
    select v_lot_id, p_organisation_id, m.profil_participant_id, m.rang
      from public.recus_manquants_lot(p_organisation_id, p_annee) m;
  get diagnostics v_total = row_count;

  if v_total = 0 then
    raise exception 'AUCUN_RECU_MANQUANT';
  end if;

  update public.recus_lots set nb_total = v_total where id = v_lot_id;
  return v_lot_id;
exception
  -- Deux lancements simultanés : l'index unique partiel tranche.
  when unique_violation then
    raise exception 'LOT_DEJA_EN_COURS';
end;
$function$
;
CREATE OR REPLACE FUNCTION public.liberer_lot_recus(p_lot_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare
  v_fini boolean;
begin
  select l.statut = 'en_cours' and not exists (
           select 1 from public.recus_lot_lignes g where g.lot_id = l.id and g.statut in ('a_faire', 'en_cours'))
    into v_fini
    from public.recus_lots l where l.id = p_lot_id;

  update public.recus_lots l
     set traitement_jusqu_a = null,
         statut = case when v_fini then 'termine' else l.statut end,
         termine_le = case when v_fini then now() else l.termine_le end,
         en_attente_jusqu_a = case when v_fini then null else l.en_attente_jusqu_a end
   where l.id = p_lot_id;
end;
$function$
;
CREATE OR REPLACE FUNCTION public.liens_renouvellement_verifier_organisation()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if not coalesce(exists (
    select 1 from public.adherents a where a.id = new.adherent_id and a.organisation_id = new.organisation_id
  ), false) then
    raise exception 'Adhérent hors organisation' using errcode = 'check_violation';
  end if;
  return new;
end;
$function$
;
CREATE OR REPLACE FUNCTION public.ligne_suivante_lot_recus(p_lot_id uuid, p_bail_secondes integer)
 RETURNS TABLE(ligne_id uuid, profil_participant_id uuid, tentatives integer)
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare
  v_lot public.recus_lots%rowtype;
  v_ligne public.recus_lot_lignes%rowtype;
begin
  select * into v_lot from public.recus_lots l where l.id = p_lot_id for update;
  if v_lot.statut is distinct from 'en_cours' then
    return;
  end if;

  loop
    select * into v_ligne
      from public.recus_lot_lignes g
     where g.lot_id = p_lot_id and g.statut in ('a_faire', 'en_cours')
     order by g.rang
     limit 1
     for update;

    if not found then
      perform public.recompter_lot_recus(p_lot_id);
      update public.recus_lots
         set statut = 'termine', termine_le = now(), traitement_jusqu_a = null, en_attente_jusqu_a = null
       where id = p_lot_id;
      return;
    end if;

    if v_lot.type = 'envoi' and v_ligne.statut = 'en_cours' then
      perform public.classer_ligne_envoi_interrompue(v_ligne.id);
      perform public.recompter_lot_recus(p_lot_id);
      continue;
    end if;

    exit when v_ligne.tentatives < 3;

    update public.recus_lot_lignes
       set statut = 'echec', modifie_le = now(),
           erreur = coalesce(v_ligne.erreur, 'Traitement interrompu à plusieurs reprises')
     where id = v_ligne.id;
    perform public.recompter_lot_recus(p_lot_id);
  end loop;

  update public.recus_lot_lignes
     set statut = 'en_cours', tentatives = v_ligne.tentatives + 1, modifie_le = now()
   where id = v_ligne.id;
  update public.recus_lots
     set traitement_jusqu_a = now() + make_interval(secs => p_bail_secondes)
   where id = p_lot_id;

  return query select v_ligne.id, v_ligne.profil_participant_id, v_ligne.tentatives + 1;
end;
$function$
;
CREATE OR REPLACE FUNCTION public.limite_renouvellement_depassee(p_ip_hash text, p_secret_hash text, p_scope_ip text, p_scope_lien text, p_max_ip integer, p_max_lien integer, p_fenetre interval)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_nb_ip integer;
  v_nb_lien integer;
begin
  -- Même ordre de verrous pour tous les appels (IP puis lien).
  perform pg_advisory_xact_lock(hashtextextended(p_scope_ip || ':' || p_ip_hash, 0));
  perform pg_advisory_xact_lock(hashtextextended(p_scope_lien || ':' || p_secret_hash, 0));

  delete from public.acces_portefeuille_rate_limits
  where scope in (p_scope_ip, p_scope_lien)
    and ip_hash in (p_ip_hash, p_secret_hash)
    and created_at < clock_timestamp() - interval '1 day';

  insert into public.acces_portefeuille_rate_limits(ip_hash, portefeuille_id, scope)
  values (p_ip_hash, null, p_scope_ip), (p_secret_hash, null, p_scope_lien);

  select count(*) into v_nb_ip from public.acces_portefeuille_rate_limits
  where scope = p_scope_ip and ip_hash = p_ip_hash and created_at > clock_timestamp() - p_fenetre;
  select count(*) into v_nb_lien from public.acces_portefeuille_rate_limits
  where scope = p_scope_lien and ip_hash = p_secret_hash and created_at > clock_timestamp() - p_fenetre;

  return v_nb_ip > p_max_ip or v_nb_lien > p_max_lien;
end;
$function$
;
CREATE OR REPLACE FUNCTION public.lire_lien_renouvellement(p_secret_hash text, p_ip_hash text, p_slug text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_etat jsonb;
  v_organisation jsonb;
  v_adherent jsonb;
begin
  if p_secret_hash is null or p_secret_hash !~ '^[0-9a-f]{64}$'
     or p_ip_hash is null or p_ip_hash !~ '^[0-9a-f]{64}$'
     or p_slug is null or length(p_slug) > 100 then
    return jsonb_build_object('ok', false, 'reason', 'ACCES_INVALIDE');
  end if;

  if public.limite_renouvellement_depassee(p_ip_hash, p_secret_hash,
       'renouvellement_lecture_ip', 'renouvellement_lecture_lien', 30, 20, interval '10 minutes') then
    return jsonb_build_object('ok', false, 'reason', 'RATE_LIMIT');
  end if;

  select jsonb_build_object(
    'nom', o.nom,
    'statuts_url', o.statuts_url,
    'formulaire_adhesion_header_html', o.formulaire_adhesion_header_html,
    'formulaire_adhesion_footer_html', o.formulaire_adhesion_footer_html,
    'formulaire_adhesion_css', o.formulaire_adhesion_css,
    'assets', coalesce((
      select jsonb_agg(jsonb_build_object('identifiant', a.identifiant, 'url', a.url))
      from public.organisation_assets a where a.organisation_id = o.id
    ), '[]'::jsonb)
  ) into v_organisation
  from public.organisations o
  where o.slug = p_slug and o.archived_at is null;

  v_etat := public.resoudre_lien_renouvellement(p_secret_hash, p_slug);

  if v_etat ->> 'etat' <> 'valide' then
    return jsonb_build_object('ok', true, 'organisation', v_organisation) || (v_etat - 'lien_id' - 'adherent_id' - 'organisation_id');
  end if;

  select jsonb_build_object(
    'civilite', a.civilite,
    'nom', a.nom,
    'prenom', a.prenom,
    'adresse', a.adresse,
    'code_postal', a.code_postal,
    'ville', a.ville,
    'pays', a.pays,
    'telephone', a.telephone,
    'courriel', a.courriel
  ) into v_adherent
  from public.adherents a
  where a.id = (v_etat ->> 'adherent_id')::uuid;

  return jsonb_build_object('ok', true, 'etat', 'valide', 'organisation', v_organisation, 'adherent', v_adherent);
end;
$function$
;
CREATE OR REPLACE FUNCTION public.lire_portefeuille_par_secret_hash(p_secret_hash text, p_ip_hash text, p_scope text DEFAULT 'etat'::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_wallet_id uuid;
  v_event_id uuid;
  v_organisation_id uuid;
  v_wallet public.portefeuilles;
  v_event public.evenements;
  v_org_name text;
  v_conservation integer;
  v_url_politique text;
  v_ip_limit integer;
  v_wallet_limit integer;
  v_window interval;
  v_ip_count integer;
  v_wallet_count integer := 0;
  v_movements jsonb;
  v_pending jsonb;
  v_revision bigint;
begin
  if p_secret_hash is null or p_secret_hash !~ '^[0-9a-f]{64}$'
    or p_ip_hash is null or p_ip_hash !~ '^[0-9a-f]{64}$'
    or p_scope not in ('etat', 'pdf') then
    return jsonb_build_object('ok', false, 'reason', 'ACCES_INVALIDE');
  end if;

  if p_scope = 'pdf' then
    v_ip_limit := 6;
    v_wallet_limit := 10;
    v_window := interval '5 minutes';
  else
    v_ip_limit := 60;
    v_wallet_limit := 120;
    v_window := interval '1 minute';
  end if;

  select portefeuille_id, evenement_id, organisation_id
  into v_wallet_id, v_event_id, v_organisation_id
  from public.resoudre_hash_secret_portefeuille(p_secret_hash);

  perform pg_advisory_xact_lock(hashtextextended(
    'portefeuille:ip:' || p_scope || ':' || p_ip_hash, 0
  ));
  if v_wallet_id is not null then
    perform pg_advisory_xact_lock(hashtextextended(
      'portefeuille:wallet:' || p_scope || ':' || v_wallet_id::text, 0
    ));
  end if;

  delete from public.acces_portefeuille_rate_limits
  where created_at < clock_timestamp() - interval '1 day'
    and (ip_hash = p_ip_hash
      or portefeuille_id is not distinct from v_wallet_id);

  insert into public.acces_portefeuille_rate_limits(ip_hash, portefeuille_id, scope)
  values (p_ip_hash, v_wallet_id, p_scope);

  select count(*) into v_ip_count
  from public.acces_portefeuille_rate_limits
  where scope = p_scope and ip_hash = p_ip_hash
    and created_at > clock_timestamp() - v_window;

  if v_wallet_id is not null then
    select count(*) into v_wallet_count
    from public.acces_portefeuille_rate_limits
    where scope = p_scope and portefeuille_id = v_wallet_id
      and created_at > clock_timestamp() - v_window;
  end if;

  if v_ip_count > v_ip_limit or v_wallet_count > v_wallet_limit then
    return jsonb_build_object('ok', false, 'reason', 'RATE_LIMIT');
  end if;

  if v_wallet_id is null then
    return jsonb_build_object('ok', false, 'reason', 'ACCES_INVALIDE');
  end if;

  select * into v_wallet
  from public.portefeuilles
  where id = v_wallet_id;

  select e.* into v_event
  from public.evenements e
  join public.organisations o on o.id = e.organisation_id
  where e.id = v_event_id
    and e.organisation_id = v_organisation_id
    and o.fonctionnalites_activees -> 'evenements' = 'true'::jsonb;

  if not found then
    return jsonb_build_object('ok', false, 'reason', 'ACCES_INVALIDE');
  end if;

  select nom, conservation_evenements_mois, url_politique_confidentialite
  into v_org_name, v_conservation, v_url_politique
  from public.organisations
  where id = v_organisation_id;

  select coalesce(jsonb_agg(jsonb_build_object(
    'type', m.type,
    'montantCentimes', m.montant_centimes,
    'soldeApresCentimes', m.solde_apres_centimes,
    'createdAt', m.created_at
  ) order by m.created_at desc), '[]'::jsonb)
  into v_movements
  from public.mouvements_portefeuille m
  where m.portefeuille_id = v_wallet.id;

  select jsonb_build_object(
    'id', d.id,
    'montantCentimes', d.montant_centimes,
    'expireLe', d.expire_le,
    'createdAt', d.created_at
  ) into v_pending
  from public.demandes_paiement d
  where d.portefeuille_id = v_wallet.id
    and d.statut = 'en_attente'
    and d.expire_le > clock_timestamp()
  order by d.created_at desc
  limit 1;

  select (extract(epoch from greatest(
    v_wallet.updated_at,
    v_event.updated_at,
    coalesce((select max(m.created_at) from public.mouvements_portefeuille m
      where m.portefeuille_id = v_wallet.id), '-infinity'::timestamptz),
    coalesce((select max(case
      when d.statut = 'en_attente' and d.expire_le <= clock_timestamp() then d.expire_le
      else d.updated_at
    end) from public.demandes_paiement d
      where d.portefeuille_id = v_wallet.id), '-infinity'::timestamptz)
  )) * 1000000)::bigint
  into v_revision;

  return jsonb_build_object(
    'ok', true,
    'revision', v_revision,
    'portefeuille', jsonb_build_object(
      'codePublic', v_wallet.code_public,
      'soldeCentimes', v_wallet.solde_centimes,
      'gele', v_wallet.gele
    ),
    'evenement', jsonb_build_object(
      'nom', v_event.nom,
      'dateDebut', v_event.date_evenement,
      'dateFin', v_event.date_fin,
      'statut', v_event.statut,
      'organisationNom', v_org_name,
      'conservationMois', v_conservation,
      'urlPolitiqueConfidentialite', v_url_politique
    ),
    'mouvements', v_movements,
    'demandeEnAttente', v_pending
  );
end;
$function$
;
CREATE OR REPLACE FUNCTION public.list_journal_modifications(p_organisation_id uuid, p_limit integer DEFAULT 10, p_offset integer DEFAULT 0, p_table_cible text DEFAULT NULL::text, p_ligne_id uuid DEFAULT NULL::uuid, p_recherche text DEFAULT NULL::text)
 RETURNS TABLE(id uuid, table_cible text, ligne_id uuid, action text, details jsonb, auteur_id uuid, auteur_nom text, created_at timestamp with time zone, total_count bigint)
 LANGUAGE sql
 STABLE
 SET search_path TO 'public', 'extensions'
AS $function$
  SELECT
    jm.id, jm.table_cible, jm.ligne_id, jm.action, jm.details,
    jm.auteur_id, po.nom_affiche AS auteur_nom, jm.created_at,
    count(*) OVER() AS total_count
  FROM journal_modifications jm
  LEFT JOIN profils_organisation po
    ON po.utilisateur_id = jm.auteur_id AND po.organisation_id = jm.organisation_id
  WHERE jm.organisation_id = p_organisation_id
    AND (p_table_cible IS NULL OR jm.table_cible = p_table_cible)
    AND (p_ligne_id IS NULL OR jm.ligne_id = p_ligne_id)
    AND (
      p_recherche IS NULL
      OR length(trim(p_recherche)) < 2
      OR unaccent(lower(concat_ws(' ', jm.details->>'prenom', jm.details->>'nom', po.nom_affiche)))
         LIKE '%' || replace(replace(replace(unaccent(lower(trim(p_recherche))), '\', '\\'), '%', '\%'), '_', '\_') || '%'
    )
  ORDER BY jm.created_at DESC
  LIMIT p_limit OFFSET p_offset;
$function$
;
CREATE OR REPLACE FUNCTION public.list_listes_diffusion_avec_compte(p_organisation_id uuid)
 RETURNS TABLE(nom text, nombre_adherents bigint)
 LANGUAGE sql
 STABLE
AS $function$
  select ld.nom, count(a.id) as nombre_adherents
  from listes_diffusion ld
  left join adherents a
    on a.organisation_id = ld.organisation_id
    and ld.nom = any(a.tags)
  where ld.organisation_id = p_organisation_id
  group by ld.nom
  order by ld.nom;
$function$
;
CREATE OR REPLACE FUNCTION public.modifier_note_campagne_courrier(p_campagne_id uuid, p_notes text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_organisation_id uuid;
  v_notes text := nullif(btrim(coalesce(p_notes, '')), '');
begin
  select organisation_id into v_organisation_id
    from public.campagnes_courrier
   where id = p_campagne_id;

  if not coalesce(
    public.is_current_user_super_admin()
    or (v_organisation_id is not null
        and v_organisation_id = public.current_user_organisation_id()
        and public.current_user_role() in ('admin', 'contributeur')),
    false
  ) then
    raise exception 'ACCES_REFUSE' using errcode = '42501';
  end if;

  if v_organisation_id is null then
    raise exception 'CAMPAGNE_INTROUVABLE';
  end if;

  if char_length(v_notes) > 5000 then
    raise exception 'NOTES_TROP_LONGUES';
  end if;

  update public.campagnes_courrier set notes = v_notes where id = p_campagne_id;
end;
$function$
;
CREATE OR REPLACE FUNCTION public.modifier_note_campagne_mailing(p_campagne_id uuid, p_notes text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_organisation_id uuid;
  v_notes text := nullif(btrim(coalesce(p_notes, '')), '');
begin
  select organisation_id into v_organisation_id
    from public.campagnes_mailing
   where id = p_campagne_id;

  if not coalesce(
    public.is_current_user_super_admin()
    or (v_organisation_id is not null
        and v_organisation_id = public.current_user_organisation_id()
        and public.current_user_role() in ('admin', 'contributeur')),
    false
  ) then
    raise exception 'ACCES_REFUSE' using errcode = '42501';
  end if;

  if v_organisation_id is null then
    raise exception 'CAMPAGNE_INTROUVABLE';
  end if;

  if char_length(v_notes) > 5000 then
    raise exception 'NOTES_TROP_LONGUES';
  end if;

  update public.campagnes_mailing set notes = v_notes where id = p_campagne_id;
end;
$function$
;
CREATE OR REPLACE FUNCTION public.mouvements_portefeuille_immuables()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
begin
  raise exception 'JOURNAL_IMMUABLE';
end;
$function$
;
CREATE OR REPLACE FUNCTION public.nettoyer_texte_saisie(p_texte text)
 RETURNS text
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO 'public', 'pg_temp'
AS $function$
  select regexp_replace(
    p_texte,
    '^[\s\u00a0\ufeff\u1680\u2000-\u200a\u2028\u2029\u202f\u205f\u3000]+|[\s\u00a0\ufeff\u1680\u2000-\u200a\u2028\u2029\u202f\u205f\u3000]+$',
    '',
    'g'
  );
$function$
;
CREATE OR REPLACE FUNCTION public.next_adherent_id_externe(p_organisation_id uuid)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  seq_name text;
  next_val bigint;
  current_max bigint;
begin
  if auth.uid() is null or not coalesce(
    public.is_current_user_super_admin()
    or p_organisation_id = public.current_user_organisation_id(),
    false
  ) then
    raise exception 'ACCES_INTERDIT' using errcode = '42501';
  end if;

  seq_name := 'adherent_id_externe_seq_' || replace(p_organisation_id::text, '-', '_');
  perform pg_advisory_xact_lock(hashtext(seq_name));

  select coalesce(max(id_externe::bigint), 0)
  into current_max
  from adherents
  where organisation_id = p_organisation_id
    and id_externe ~ '^[0-9]{1,18}$';

  if not exists (select 1 from pg_sequences where schemaname = 'public' and sequencename = seq_name) then
    -- Création sérialisée par le verrou consultatif ci-dessus.
    execute format('create sequence public.%I start %s', seq_name, current_max + 1);
  else
    execute format(
      'select setval(%L, GREATEST(last_value, %s)) from public.%I',
      'public.' || seq_name, current_max, seq_name
    );
  end if;

  execute format('select nextval(%L)', 'public.' || seq_name) into next_val;
  return next_val::text;
end;
$function$
;
CREATE OR REPLACE FUNCTION public.next_numero_recu(org_id uuid, annee integer)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  seq_name text;
  next_val bigint;
  depart integer;
begin
  seq_name := 'recu_seq_' || replace(org_id::text, '-', '_') || '_' || annee;

  -- Créer la séquence si elle n'existe pas encore pour cette année
  if not exists (select 1 from pg_sequences where schemaname = 'public' and sequencename = seq_name) then
    -- Récupérer le numéro de départ configuré dans l'organisation
    select coalesce((modele_recu_pdf->>'numero_recu_depart')::integer, 1)
    into depart
    from organisations where id = org_id;

    execute format('create sequence public.%I start %s', seq_name, depart);
  end if;

  execute format('select nextval(%L)', 'public.' || seq_name) into next_val;
  -- Au moins 3 chiffres, jamais de troncature au-delà de 999.
  return annee || '-' || lpad(next_val::text, greatest(3, length(next_val::text)), '0');
end;
$function$
;
CREATE OR REPLACE FUNCTION public.next_participant_id_externe(p_organisation_id uuid)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  seq_name text;
  next_val bigint;
  current_max bigint;
begin
  if auth.uid() is null or not coalesce(
    public.is_current_user_super_admin()
    or p_organisation_id = public.current_user_organisation_id(),
    false
  ) then
    raise exception 'ACCES_INTERDIT' using errcode = '42501';
  end if;

  seq_name := 'participant_id_externe_seq_' || replace(p_organisation_id::text, '-', '_');
  perform pg_advisory_xact_lock(hashtext(seq_name));

  select coalesce(max(id_externe::bigint), 0)
  into current_max
  from profils_participant
  where organisation_id = p_organisation_id
    and id_externe ~ '^[0-9]{1,18}$';

  if not exists (select 1 from pg_sequences where schemaname = 'public' and sequencename = seq_name) then
    execute format('create sequence public.%I start %s', seq_name, current_max + 1);
  else
    execute format(
      'select setval(%L, GREATEST(last_value, %s)) from public.%I',
      'public.' || seq_name, current_max, seq_name
    );
  end if;

  execute format('select nextval(%L)', 'public.' || seq_name) into next_val;
  return next_val::text;
end;
$function$
;
CREATE OR REPLACE FUNCTION public.organisations_fonctionnalites_super_admin()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
begin
  if new.fonctionnalites_activees is distinct from old.fonctionnalites_activees
    and auth.uid() is not null
    and not public.is_current_user_super_admin() then
    raise exception 'FONCTIONNALITES_RESERVEES_SUPER_ADMIN' using errcode = '42501';
  end if;
  return new;
end;
$function$
;
CREATE OR REPLACE FUNCTION public.organisations_verifier_logo()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if new.logo_asset_id is not null
     and (tg_op = 'INSERT' or new.logo_asset_id is distinct from old.logo_asset_id) then
    if not exists (
      select 1 from public.organisation_assets a
      where a.id = new.logo_asset_id
        and a.organisation_id = new.id
        and a.url ~* '\.(png|jpe?g)$'
    ) then
      raise exception 'Ce visuel ne peut pas servir de logo à cette organisation'
        using errcode = 'check_violation';
    end if;
  end if;
  return new;
end;
$function$
;
CREATE OR REPLACE FUNCTION public.peut_gerer_secrets(p_organisation_id uuid, p_admin_seulement boolean)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  -- coalesce : sans profil d'organisation (session bénévole/vendeur), les helpers renvoient
  -- NULL et « if not NULL » ne refuse rien — toujours un booléen strict.
  select coalesce(
    public.is_current_user_super_admin()
    or (
      p_organisation_id = public.current_user_organisation_id()
      and (not p_admin_seulement or public.current_user_role() = 'admin')
    ),
    false
  );
$function$
;
CREATE OR REPLACE FUNCTION public.peut_saisir_adhesion_benevole(p_organisation_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  select auth.uid() is not null and coalesce(
    (
      public.current_benevole_organisation_id() = p_organisation_id
      and exists (
        select 1 from public.organisations o
        where o.id = p_organisation_id and o.saisie_adhesion_benevole
      )
    )
    or public.is_current_user_super_admin()
    or p_organisation_id = public.current_user_organisation_id(),
    false
  );
$function$
;
CREATE OR REPLACE FUNCTION public.planifier_traitement_lots_recus()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_url text;
  v_secret text;
begin
  if not exists (
    select 1 from public.recus_lots l
     where l.statut = 'en_cours'
       and (l.traitement_jusqu_a is null or l.traitement_jusqu_a < now())
       and (l.en_attente_jusqu_a is null or l.en_attente_jusqu_a < now())
  ) then
    return;
  end if;

  select s.decrypted_secret into v_url from vault.decrypted_secrets s where s.name = 'traiter_lots_recus_url';
  select s.decrypted_secret into v_secret from vault.decrypted_secrets s where s.name = 'traiter_lots_recus_secret';
  if v_url is null or v_secret is null then
    raise warning 'planifier_traitement_lots_recus : secrets Vault traiter_lots_recus_url / traiter_lots_recus_secret absents, lot non traité';
    return;
  end if;

  perform net.http_post(
    url := v_url,
    body := '{}'::jsonb,
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-traitement-secret', v_secret),
    timeout_milliseconds := 10000
  );
end;
$function$
;
CREATE OR REPLACE FUNCTION public.portefeuille_non_anonymise()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
begin
  if exists (
    select 1 from public.portefeuilles
    where id = new.portefeuille_id and anonymise_le is not null
  ) then
    raise exception 'PORTEFEUILLE_ANONYMISE';
  end if;
  return new;
end;
$function$
;
CREATE OR REPLACE FUNCTION public.portefeuilles_anonymise_fige()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
begin
  if old.anonymise_le is not null
    and (new.email is distinct from old.email or new.anonymise_le is distinct from old.anonymise_le) then
    raise exception 'PORTEFEUILLE_ANONYMISE';
  end if;
  return new;
end;
$function$
;
CREATE OR REPLACE FUNCTION public.prendre_lot_recus(p_bail_secondes integer, p_exclure uuid[] DEFAULT '{}'::uuid[])
 RETURNS TABLE(lot_id uuid, organisation_id uuid, annee integer, cree_par uuid, type text)
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare
  v_lot public.recus_lots%rowtype;
begin
  select * into v_lot
    from public.recus_lots l
   where l.statut = 'en_cours'
     and (l.traitement_jusqu_a is null or l.traitement_jusqu_a < now())
     and (l.en_attente_jusqu_a is null or l.en_attente_jusqu_a < now())
     and not (l.id = any (coalesce(p_exclure, '{}')))
   order by l.cree_le
   limit 1
   for update skip locked;

  if not found then
    return;
  end if;

  update public.recus_lots
     set traitement_jusqu_a = now() + make_interval(secs => p_bail_secondes)
   where id = v_lot.id;

  return query select v_lot.id, v_lot.organisation_id, v_lot.annee, v_lot.cree_par, v_lot.type;
end;
$function$
;
CREATE OR REPLACE FUNCTION public.prevent_profils_organisation_tampering()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
begin
  if NEW.utilisateur_id <> OLD.utilisateur_id then
    raise exception 'utilisateur_id est immuable sur profils_organisation';
  end if;
  if NEW.organisation_id <> OLD.organisation_id then
    raise exception 'organisation_id est immuable (pas de transfert d''admin entre organisations)';
  end if;
  if NEW.role is distinct from OLD.role and OLD.utilisateur_id = auth.uid() then
    raise exception 'Un compte ne peut pas modifier son propre rôle';
  end if;
  return NEW;
end;
$function$
;
CREATE OR REPLACE FUNCTION public.profils_donateur_par_emails(p_organisation_id uuid, p_emails text[])
 RETURNS TABLE(profil_id uuid, email_normalise text)
 LANGUAGE sql
 STABLE
 SET search_path TO ''
AS $function$
  select pp.id, lower(btrim(pe.email, E' \t\r\n'))
  from public.profils_participant pp
  join public.personnes pe on pe.id = pp.personne_id
  where pp.organisation_id = p_organisation_id
    and pe.email is not null
    and lower(btrim(pe.email, E' \t\r\n')) in (select lower(btrim(e, E' \t\r\n')) from unnest(p_emails) as e);
$function$
;
CREATE OR REPLACE FUNCTION public.profils_participant_attribuer_id_externe()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_existant text;
begin
  if nullif(btrim(new.id_externe), '') is not null or new.organisation_id is null then
    return new;
  end if;

  -- Upsert (import : on conflict (id) do update set id_externe = excluded.id_externe)
  -- d'un donateur déjà numéroté sans numéro fourni : excluded porte la valeur
  -- posée ici, on reprend donc le numéro existant plutôt que d'en brûler un neuf.
  select pp.id_externe into v_existant
  from profils_participant pp
  where pp.id = new.id and pp.organisation_id = new.organisation_id;

  if nullif(btrim(v_existant), '') is not null then
    new.id_externe := v_existant;
  else
    new.id_externe := public.attribuer_participant_id_externe(new.organisation_id);
  end if;
  return new;
end;
$function$
;
CREATE OR REPLACE FUNCTION public.purger_demandes_inscription_refusees()
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_nb integer;
begin
  delete from public.demandes_inscription
  where (statut = 'refusee' and coalesce(traitee_le, created_at) < now() - interval '30 days')
     or (statut = 'a_confirmer' and confirmation_expire_le < now() - interval '7 days');
  get diagnostics v_nb = row_count;
  return v_nb;
end;
$function$
;
CREATE OR REPLACE FUNCTION public.purger_donnees_evenements()
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_wallet_id uuid;
  v_count integer := 0;
begin
  for v_wallet_id in
    select w.id
    from public.portefeuilles w
    join public.evenements e on e.id = w.evenement_id
    join public.organisations o on o.id = e.organisation_id
    where w.anonymise_le is null
      and (e.date_fin + make_interval(months => o.conservation_evenements_mois))::date < current_date
  loop
    if public.anonymiser_portefeuille_interne(v_wallet_id, null) then
      v_count := v_count + 1;
    end if;
  end loop;

  delete from public.acces_portefeuille_rate_limits
  where created_at < clock_timestamp() - interval '1 day';

  return v_count;
end;
$function$
;
CREATE OR REPLACE FUNCTION public.recalculer_dates_fin_adhesions(p_organisation_id uuid)
 RETURNS integer
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_modifiees integer;
  v_regle text;
  v_mois smallint;
begin
  if not coalesce(public.is_current_user_super_admin() or p_organisation_id = public.current_user_organisation_id(), false) then
    raise exception 'ACCES_REFUSE' using errcode = '42501';
  end if;

  select adhesion_regle_fin, adhesion_mois_bascule into v_regle, v_mois
  from public.organisations where id = p_organisation_id;
  if v_regle is null then
    raise exception 'ORGANISATION_INTROUVABLE' using errcode = '42501';
  end if;

  update public.adhesions h
  set date_fin = public.calculer_date_fin_adhesion(p_organisation_id, h.date_debut)
  from public.adherents a
  where a.id = h.adherent_id
    and a.organisation_id = p_organisation_id
    and h.date_fin is distinct from public.calculer_date_fin_adhesion(p_organisation_id, h.date_debut);
  get diagnostics v_modifiees = row_count;

  insert into public.journal_modifications (organisation_id, table_cible, ligne_id, action, details, auteur_id)
  values (
    p_organisation_id, 'organisations', p_organisation_id, 'recalage_adhesions',
    jsonb_build_object('adhesions_modifiees', v_modifiees, 'regle_fin', v_regle, 'mois_bascule', v_mois),
    auth.uid()
  );

  return v_modifiees;
end;
$function$
;
CREATE OR REPLACE FUNCTION public.recapitulatif_envoi_lot_recus(p_organisation_id uuid, p_annee integer)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_rythme record;
begin
  if not coalesce(
    public.is_current_user_super_admin()
    or (p_organisation_id = public.current_user_organisation_id()
        and public.current_user_role() in ('admin', 'contributeur')),
    false
  ) then
    raise exception 'ACCES_REFUSE' using errcode = '42501';
  end if;

  select * into v_rythme from public.rythme_envoi_recus(p_organisation_id);

  return jsonb_build_object(
    'a_envoyer', (select count(*) from public.recus_envoi_lot(p_organisation_id, p_annee) e where e.raison is null),
    'exclus', coalesce((
      select jsonb_agg(jsonb_build_object(
               'profil_participant_id', e.profil_participant_id, 'nom', e.nom, 'prenom', e.prenom, 'raison', e.raison)
             order by e.rang)
        from public.recus_envoi_lot(p_organisation_id, p_annee) e
       where e.raison is not null
    ), '[]'::jsonb),
    'par_jour', v_rythme.par_jour,
    'par_minute', v_rythme.par_minute,
    'envoyes_24h', public.envois_recus_depuis(p_organisation_id, now() - interval '24 hours'),
    'brevo_configure', public.brevo_configure_organisation(p_organisation_id)
  );
end;
$function$
;
CREATE OR REPLACE FUNCTION public.rechercher_destinataires_campagne(p_campagne_id uuid, p_statut text, p_recherche text DEFAULT NULL::text, p_limit integer DEFAULT 50, p_offset integer DEFAULT 0)
 RETURNS TABLE(id uuid, nom text, courriel text, raison_exclusion text, total_count bigint)
 LANGUAGE sql
 STABLE
 SET search_path TO 'public', 'extensions'
AS $function$
  select d.id, d.nom, d.courriel, d.raison_exclusion, count(*) over () as total_count
  from public.campagnes_mailing_destinataires d
  where d.campagne_id = p_campagne_id
    and d.statut = p_statut
    and (
      p_recherche is null
      or length(trim(p_recherche)) < 2
      or not exists (
        select 1
        from unnest(string_to_array(unaccent(lower(trim(p_recherche))), ' ')) as tok
        where tok <> ''
          and unaccent(lower(concat_ws(' ', d.nom, d.courriel)))
              not like '%' || replace(replace(replace(tok, '\', '\\'), '%', '\%'), '_', '\_') || '%'
      )
    )
  order by d.nom, d.id
  limit least(greatest(coalesce(p_limit, 50), 1), 200)
  offset greatest(coalesce(p_offset, 0), 0);
$function$
;
CREATE OR REPLACE FUNCTION public.rechercher_destinataires_campagne_courrier(p_campagne_id uuid, p_statut text, p_recherche text DEFAULT NULL::text, p_limit integer DEFAULT 50, p_offset integer DEFAULT 0)
 RETURNS TABLE(id uuid, nom text, adresse text, raison_exclusion text, total_count bigint)
 LANGUAGE sql
 STABLE
 SET search_path TO 'public', 'extensions'
AS $function$
  select d.id, d.nom, d.adresse, d.raison_exclusion, count(*) over () as total_count
  from public.campagnes_courrier_destinataires d
  where d.campagne_id = p_campagne_id
    and d.statut = p_statut
    and (
      p_recherche is null
      or length(trim(p_recherche)) < 2
      or not exists (
        select 1
        from unnest(string_to_array(unaccent(lower(trim(p_recherche))), ' ')) as tok
        where tok <> ''
          and unaccent(lower(concat_ws(' ', d.nom, d.adresse)))
              not like '%' || replace(replace(replace(tok, '\', '\\'), '%', '\%'), '_', '\_') || '%'
      )
    )
  order by d.nom, d.id
  limit least(greatest(coalesce(p_limit, 50), 1), 200)
  offset greatest(coalesce(p_offset, 0), 0);
$function$
;
CREATE OR REPLACE FUNCTION public.rechercher_global(p_terme text, p_organisation_id uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'extensions', 'pg_temp'
AS $function$
declare
  v_org uuid;
  v_flags jsonb;
  v_dons boolean;
  v_adherents boolean;
  v_evenements boolean;
  v_terme text := btrim(coalesce(p_terme, ''));
  v_pattern text;
  v_personnes jsonb;
  v_portefeuilles jsonb;
  v_activites jsonb;
  v_vide constant jsonb := jsonb_build_object('personnes', '[]'::jsonb, 'portefeuilles', '[]'::jsonb, 'activites', '[]'::jsonb);
begin
  if auth.uid() is null then
    return v_vide;
  end if;

  -- Organisation : celle du compte admin/contributeur ; un super-admin ne voit que
  -- l'organisation qu'il consulte (paramètre ignoré pour tout autre appelant). Comptes
  -- bénévole et vendeur : pas de profil d'organisation, donc aucun résultat.
  if public.is_current_user_super_admin() then
    v_org := p_organisation_id;
  else
    v_org := public.current_user_organisation_id();
  end if;

  if v_org is null or char_length(v_terme) < 2 then
    return v_vide;
  end if;

  select coalesce(fonctionnalites_activees, '{}'::jsonb) into v_flags
  from public.organisations
  where id = v_org;

  -- Mêmes défauts que DEFAULT_FONCTIONNALITES côté front.
  v_dons := coalesce((v_flags ->> 'dons')::boolean, true);
  v_adherents := coalesce((v_flags ->> 'adherents')::boolean, true);
  v_evenements := coalesce((v_flags ->> 'evenements')::boolean, false);

  -- Terme normalisé ; les jokers LIKE saisis par l'utilisateur sont échappés.
  v_pattern := '%' || replace(replace(replace(lower(unaccent(v_terme)), '\', '\\'), '%', '\%'), '_', '\_') || '%';

  -- Personnes : donateurs (module dons) et adhérents (module adhérents), fusionnés en une
  -- seule ligne quand ils désignent visiblement la même personne (affichage seul, rien n'est
  -- lié en base) :
  --   - même email non vide ;
  --   - ou même nom + prénom normalisés (accents, casse, espaces), même si les emails diffèrent
  --     (ex. hotmail.fr / hotmail.com), à condition que ce nom + prénom soit UNIQUE parmi les
  --     donateurs ET parmi les adhérents de l'organisation : de vrais homonymes restent séparés.
  with donateurs as (
    select
      pp.id as participant_id,
      p.nom,
      p.prenom,
      nullif(lower(btrim(p.email)), '') as email,
      regexp_replace(lower(unaccent(btrim(p.nom) || ' ' || coalesce(btrim(p.prenom), ''))), '\s+', ' ', 'g') as cle
    from public.profils_participant pp
    join public.personnes p on p.id = pp.personne_id
    where v_dons
      and pp.organisation_id = v_org
      and (
        lower(unaccent(p.nom || ' ' || coalesce(p.prenom, ''))) like v_pattern escape '\'
        or lower(unaccent(coalesce(p.prenom, '') || ' ' || p.nom)) like v_pattern escape '\'
        or lower(coalesce(p.email, '')) like v_pattern escape '\'
      )
    order by p.nom, p.prenom
    limit 25
  ),
  adh as (
    select
      a.id as adherent_id,
      a.nom,
      a.prenom,
      nullif(lower(btrim(a.courriel)), '') as email,
      a.statut,
      regexp_replace(lower(unaccent(btrim(a.nom) || ' ' || coalesce(btrim(a.prenom), ''))), '\s+', ' ', 'g') as cle
    from public.adherents a
    where v_adherents
      and a.organisation_id = v_org
      and (
        lower(unaccent(a.nom || ' ' || coalesce(a.prenom, ''))) like v_pattern escape '\'
        or lower(unaccent(coalesce(a.prenom, '') || ' ' || a.nom)) like v_pattern escape '\'
        or lower(coalesce(a.courriel, '')) like v_pattern escape '\'
      )
    order by a.nom, a.prenom
    limit 25
  ),
  -- Nombre de porteurs de chaque nom + prénom dans toute l'organisation (pas seulement parmi
  -- les résultats), pour la règle d'unicité.
  homonymes_donateurs as (
    select k.cle, count(*) as n
    from (
      select regexp_replace(lower(unaccent(btrim(p.nom) || ' ' || coalesce(btrim(p.prenom), ''))), '\s+', ' ', 'g') as cle
      from public.profils_participant pp
      join public.personnes p on p.id = pp.personne_id
      where pp.organisation_id = v_org
    ) k
    where k.cle in (select cle from donateurs)
    group by k.cle
  ),
  homonymes_adherents as (
    select k.cle, count(*) as n
    from (
      select regexp_replace(lower(unaccent(btrim(a.nom) || ' ' || coalesce(btrim(a.prenom), ''))), '\s+', ' ', 'g') as cle
      from public.adherents a
      where a.organisation_id = v_org
    ) k
    where k.cle in (select cle from adh)
    group by k.cle
  ),
  paires as (
    select d.participant_id, a.adherent_id
    from donateurs d
    join adh a
      on (d.email is not null and d.email = a.email)
      or (
        d.cle = a.cle
        and (select n from homonymes_donateurs h where h.cle = d.cle) = 1
        and (select n from homonymes_adherents h where h.cle = a.cle) = 1
      )
  ),
  -- Une association au plus par donateur et par adhérent.
  par_donateur as (
    select distinct on (participant_id) participant_id, adherent_id
    from paires
    order by participant_id, adherent_id
  ),
  appariements as (
    select distinct on (adherent_id) participant_id, adherent_id
    from par_donateur
    order by adherent_id, participant_id
  ),
  lignes as (
    select d.participant_id, ap.adherent_id, d.nom, d.prenom, coalesce(d.email, a.email) as email, a.statut as adherent_statut
    from donateurs d
    left join appariements ap on ap.participant_id = d.participant_id
    left join adh a on a.adherent_id = ap.adherent_id
    union all
    select null::uuid, a.adherent_id, a.nom, a.prenom, a.email, a.statut
    from adh a
    where not exists (select 1 from appariements ap where ap.adherent_id = a.adherent_id)
  )
  select coalesce(jsonb_agg(jsonb_build_object(
    'participant_id', l.participant_id,
    'adherent_id', l.adherent_id,
    'nom', l.nom,
    'prenom', l.prenom,
    'email', l.email,
    'adherent_statut', l.adherent_statut
  ) order by l.nom, l.prenom), '[]'::jsonb)
  into v_personnes
  from (select * from lignes order by nom, prenom limit 5) l;

  -- Portefeuilles (module evenements) : par code public ou par email ; un acheteur anonymisé
  -- n'est jamais retrouvé par son adresse de remplacement, qui n'est pas renvoyée.
  select coalesce(jsonb_agg(row_data order by created_at desc), '[]'::jsonb)
  into v_portefeuilles
  from (
    select
      w.created_at,
      jsonb_build_object(
        'id', w.id,
        'evenement_id', w.evenement_id,
        'evenement_nom', e.nom,
        'email', case when w.anonymise_le is null then w.email end,
        'code_public', w.code_public,
        'solde_centimes', w.solde_centimes,
        'anonymise', w.anonymise_le is not null
      ) as row_data
    from public.portefeuilles w
    join public.evenements e on e.id = w.evenement_id
    where v_evenements
      and w.organisation_id = v_org
      and (
        lower(w.code_public) like v_pattern escape '\'
        or (w.anonymise_le is null and lower(w.email) like v_pattern escape '\')
      )
    order by w.created_at desc
    limit 5
  ) t;

  -- Activités (modules dons ou adhérents, comme leur page).
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', t.id,
    'nom', t.nom,
    'date_debut', t.date_debut
  ) order by t.date_debut desc nulls last, t.nom), '[]'::jsonb)
  into v_activites
  from (
    select ac.id, ac.nom, ac.date_debut
    from public.activites ac
    where (v_dons or v_adherents)
      and ac.organisation_id = v_org
      and lower(unaccent(ac.nom)) like v_pattern escape '\'
    order by ac.date_debut desc nulls last, ac.nom
    limit 5
  ) t;

  return jsonb_build_object('personnes', v_personnes, 'portefeuilles', v_portefeuilles, 'activites', v_activites);
end;
$function$
;
CREATE OR REPLACE FUNCTION public.recompter_lot_recus(p_lot_id uuid)
 RETURNS void
 LANGUAGE sql
 SET search_path TO ''
AS $function$
  update public.recus_lots l
     set nb_faits = (select count(*) from public.recus_lot_lignes g where g.lot_id = l.id and g.statut = 'fait'),
         nb_echecs = (select count(*) from public.recus_lot_lignes g where g.lot_id = l.id and g.statut = 'echec'),
         nb_a_verifier = (select count(*) from public.recus_lot_lignes g where g.lot_id = l.id and g.statut = 'a_verifier')
   where l.id = p_lot_id;
$function$
;
CREATE OR REPLACE FUNCTION public.recus_envoi_lot(p_organisation_id uuid, p_annee integer)
 RETURNS TABLE(profil_participant_id uuid, recu_id uuid, version_id uuid, rang integer, nom text, prenom text, raison text)
 LANGUAGE sql
 STABLE
 SET search_path TO ''
AS $function$
  with candidats as (
    select rf.profil_participant_id, rf.id as recu_id, v.id as version_id,
           pe.nom, pe.prenom, btrim(coalesce(pe.email, ''), E' \t\r\n') as email,
           pp.email_invalide_at
      from public.recus_fiscaux rf
      join public.profils_participant pp on pp.id = rf.profil_participant_id
      join public.personnes pe on pe.id = pp.personne_id
      left join lateral (
        select v.id, v.email_envoye_le
          from public.recus_fiscaux_versions v
         where v.recu_id = rf.id
         order by v.version desc
         limit 1
      ) v on true
     where rf.organisation_id = p_organisation_id
       and rf.annee = p_annee
       and rf.fichier_url is not null
       and case when v.id is not null then v.email_envoye_le is null else rf.email_envoye_at is null end
       -- Version déjà envoyée par un lot dont le marquage de la version a échoué : pas de second envoi.
       and not exists (
         select 1 from public.recus_lot_lignes g
          where g.organisation_id = p_organisation_id and g.recu_id = rf.id and g.statut = 'fait'
            and not g.deja_envoye and g.version_id is not distinct from v.id
            and exists (select 1 from public.recus_lots l where l.id = g.lot_id and l.type = 'envoi')
       )
  )
  select c.profil_participant_id, c.recu_id, c.version_id,
         (row_number() over (
           order by c.nom collate "C", coalesce(c.prenom, '') collate "C", c.profil_participant_id
         ))::integer,
         c.nom, c.prenom,
         case
           when c.email = '' then 'Aucune adresse email'
           when c.email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then 'Adresse email au format invalide'
           when c.email_invalide_at is not null then
             'Email invalide : un envoi précédent n''a pas pu être délivré (le '
             || to_char(c.email_invalide_at at time zone 'Europe/Paris', 'DD/MM/YYYY') || ')'
           -- Ligne « a_verifier », ou restée « en_cours » (exécution interrompue pendant l'envoi, lot
           -- arrêté avant le classement) dans un lot d'envoi précédent : l'email a pu partir.
           when exists (
             select 1 from public.recus_lot_lignes g
               join public.recus_lots l on l.id = g.lot_id and l.type = 'envoi'
              where g.organisation_id = p_organisation_id
                and g.recu_id = c.recu_id
                and g.statut in ('a_verifier', 'en_cours')
                and g.version_id is not distinct from c.version_id
           ) then 'Envoi incertain lors d''un lot précédent : vérifiez (journal des emails de Brevo, ou auprès du donateur), puis envoyez-le depuis son détail si besoin'
         end
    from candidats c
$function$
;
CREATE OR REPLACE FUNCTION public.recus_fiscaux_verrou_identite()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
begin
  if old.numero_ordre is not null and new.numero_ordre is distinct from old.numero_ordre then
    raise exception 'Reçu fiscal % : le numéro d''ordre % est définitif et ne peut pas être modifié (valeur proposée : %)',
      old.id, old.numero_ordre, coalesce(new.numero_ordre, 'NULL')
      using errcode = 'check_violation';
  end if;

  if new.organisation_id is distinct from old.organisation_id
     or new.profil_participant_id is distinct from old.profil_participant_id
     or new.annee is distinct from old.annee then
    raise exception 'Reçu fiscal % : l''organisation, le donateur et l''année d''un reçu émis ne peuvent pas être modifiés',
      old.id
      using errcode = 'check_violation';
  end if;

  return new;
end;
$function$
;
CREATE OR REPLACE FUNCTION public.recus_fiscaux_versions_immuables()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
begin
  if tg_op = 'UPDATE' then
    if (to_jsonb(new) - 'email_envoye_le') is distinct from (to_jsonb(old) - 'email_envoye_le') then
      raise exception 'Version % du reçu fiscal % : une version émise ne peut pas être modifiée (seule la date d''envoi par email peut l''être)',
        old.version, old.recu_id
        using errcode = 'check_violation';
    end if;
    return new;
  end if;

  if tg_op = 'DELETE' then
    raise exception 'Version % du reçu fiscal % : les versions d''un reçu émis sont conservées (obligation de conservation de 6 ans) et ne peuvent pas être supprimées',
      old.version, old.recu_id
      using errcode = 'check_violation';
  end if;

  -- TRUNCATE (trigger de niveau instruction)
  raise exception 'Les versions des reçus fiscaux ne peuvent pas être supprimées (obligation de conservation de 6 ans)'
    using errcode = 'check_violation';
end;
$function$
;
CREATE OR REPLACE FUNCTION public.recus_manquants_lot(p_organisation_id uuid, p_annee integer)
 RETURNS TABLE(profil_participant_id uuid, rang integer)
 LANGUAGE sql
 STABLE
 SET search_path TO ''
AS $function$
  with org as (
    -- validateOrganisationCerfa : adresse, code postal, ville, RNA ou SIREN, objet social, mention légale
    select 1
      from public.organisations o
     where o.id = p_organisation_id
       and coalesce(o.adresse, '') <> ''
       and coalesce(o.code_postal, '') <> ''
       and coalesce(o.ville, '') <> ''
       and (coalesce(o.modele_recu_pdf ->> 'rna', '') <> '' or coalesce(o.modele_recu_pdf ->> 'siren', '') <> '')
       and coalesce(o.modele_recu_pdf ->> 'objet_social', '') <> ''
       and coalesce(o.modele_recu_pdf ->> 'mention_legale', '') <> ''
  ),
  donateurs as (
    select distinct d.profil_participant_id
      from public.dons d
     where d.organisation_id = p_organisation_id
       and d.date >= make_date(p_annee, 1, 1)
       and d.date <= make_date(p_annee, 12, 31)
  )
  select pp.id,
         (row_number() over (
           order by pe.nom collate "C", coalesce(pe.prenom, '') collate "C", pp.id
         ))::integer
    from donateurs dn
    join public.profils_participant pp on pp.id = dn.profil_participant_id
    join public.personnes pe on pe.id = pp.personne_id
   where exists (select 1 from org)
     and not exists (
       select 1 from public.recus_fiscaux rf
        where rf.organisation_id = p_organisation_id
          and rf.profil_participant_id = pp.id
          and rf.annee = p_annee
     )
     -- validateParticipantCerfa : civilité renseignée (ni 0 ni famille), nom, adresse, code postal,
     -- ville, prénom pour les particuliers (1 à 4)
     and coalesce(pe.civilite, 0) not in (0, 7)
     and coalesce(pe.nom, '') <> ''
     and coalesce(pe.adresse, '') <> ''
     and coalesce(pe.code_postal, '') <> ''
     and coalesce(pe.ville, '') <> ''
     and (pe.civilite not in (1, 2, 3, 4) or coalesce(pe.prenom, '') <> '')
$function$
;
CREATE OR REPLACE FUNCTION public.reevaluer_attente_lots_envoi_recus()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_rythme record;
begin
  if (new.modele_recu_pdf ->> 'envoi_lot_par_jour') is not distinct from (old.modele_recu_pdf ->> 'envoi_lot_par_jour') then
    return null;
  end if;
  if not exists (
    select 1 from public.recus_lots l
     where l.organisation_id = new.id and l.type = 'envoi' and l.statut = 'en_cours' and l.en_attente_jusqu_a > now()
  ) then
    return null;
  end if;

  select * into v_rythme from public.rythme_envoi_recus(new.id);
  if v_rythme.par_jour - public.envois_recus_depuis(new.id, now() - interval '24 hours') > 0 then
    update public.recus_lots l
       set en_attente_jusqu_a = null
     where l.organisation_id = new.id and l.type = 'envoi' and l.statut = 'en_cours' and l.en_attente_jusqu_a is not null;
  end if;
  return null;
end;
$function$
;
CREATE OR REPLACE FUNCTION public.remove_adherents_tag(p_organisation_id uuid, p_adherent_ids uuid[], p_tag text)
 RETURNS void
 LANGUAGE sql
AS $function$
  update adherents
  set tags = array_remove(tags, p_tag)
  where organisation_id = p_organisation_id
    and id = any(p_adherent_ids);
$function$
;
CREATE OR REPLACE FUNCTION public.remplacer_liens_renouvellement(p_nouveaux uuid[])
 RETURNS integer
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  with revoques as (
    update public.liens_renouvellement l
       set revoque_le = now()
     where l.revoque_le is null
       and l.utilise_le is null
       and l.id <> all (p_nouveaux)
       and exists (
         select 1 from public.liens_renouvellement n
          where n.id = any (p_nouveaux)
            and n.adherent_id = l.adherent_id
            and n.organisation_id = l.organisation_id
            and n.cree_le > l.cree_le
       )
    returning 1
  )
  select count(*)::integer from revoques;
$function$
;
CREATE OR REPLACE FUNCTION public.renommer_liste_diffusion(p_organisation_id uuid, p_ancien_nom text, p_nouveau_nom text)
 RETURNS void
 LANGUAGE plpgsql
AS $function$
BEGIN
  UPDATE listes_diffusion
  SET nom = p_nouveau_nom
  WHERE organisation_id = p_organisation_id
    AND nom = p_ancien_nom;

  UPDATE adherents
  SET tags = array_replace(tags, p_ancien_nom, p_nouveau_nom)
  WHERE organisation_id = p_organisation_id
    AND p_ancien_nom = any(tags);
END;
$function$
;
CREATE OR REPLACE FUNCTION public.renvoyer_acces_portefeuille(p_portefeuille_id uuid, p_nouvel_email text DEFAULT NULL::text, p_revoquer_anciens boolean DEFAULT false)
 RETURNS TABLE(secret text, secret_id uuid, email text, evenement_nom text, organisation_nom text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_wallet public.portefeuilles;
  v_email text;
  v_secret text;
  v_secret_id uuid;
  v_event_name text;
  v_org_name text;
begin
  if p_portefeuille_id is null or p_revoquer_anciens is null then
    raise exception 'REQUETE_INVALIDE';
  end if;

  select w.* into v_wallet
  from public.portefeuilles w
  where w.id = p_portefeuille_id
  for update;

  if not found then
    raise exception 'PORTEFEUILLE_INTROUVABLE';
  end if;

  if auth.uid() is null or not coalesce(
    public.is_current_user_super_admin()
      or v_wallet.organisation_id = public.current_user_organisation_id(),
    false
  ) then
    raise exception 'ACCES_INTERDIT' using errcode = '42501';
  end if;

  v_email := case
    when p_nouvel_email is null then v_wallet.email
    else lower(btrim(p_nouvel_email))
  end;

  if v_email !~ '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$'
    or length(v_email) > 254 then
    raise exception 'EMAIL_INVALIDE';
  end if;

  if v_email is distinct from v_wallet.email then
    if exists (
      select 1
      from public.portefeuilles w
      where w.evenement_id = v_wallet.evenement_id
        and lower(w.email) = v_email
        and w.id <> v_wallet.id
    ) then
      raise exception 'EMAIL_DEJA_UTILISE' using errcode = '23505';
    end if;

    update public.portefeuilles
    set email = v_email,
      email_modifie_le = clock_timestamp(),
      email_modifie_par = auth.uid()
    where id = v_wallet.id;
  end if;

  if p_revoquer_anciens then
    update public.secrets_portefeuille
    set revoque_le = clock_timestamp()
    where portefeuille_id = v_wallet.id
      and revoque_le is null;
  end if;

  v_secret := public.ajouter_secret_portefeuille(v_wallet.id);

  update public.secrets_portefeuille
  set cree_par = auth.uid()
  where portefeuille_id = v_wallet.id
    and secret_hash = encode(sha256(convert_to(v_secret, 'UTF8')), 'hex')
  returning id into v_secret_id;

  if v_secret_id is null then
    raise exception 'SECRET_INTROUVABLE';
  end if;

  select e.nom, o.nom into v_event_name, v_org_name
  from public.evenements e
  join public.organisations o on o.id = e.organisation_id
  where e.id = v_wallet.evenement_id;

  return query select v_secret, v_secret_id, v_email, v_event_name, v_org_name;
end;
$function$
;
CREATE OR REPLACE FUNCTION public.reset_adherent_email_invalide()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  IF NEW.courriel IS DISTINCT FROM OLD.courriel THEN
    NEW.email_invalide_at := NULL;
    NEW.email_invalide_evenement := NULL;
    NEW.email_invalide_raison := NULL;
  END IF;
  RETURN NEW;
END;
$function$
;
CREATE OR REPLACE FUNCTION public.reset_profil_email_invalide()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  if new.email is distinct from old.email then
    update public.profils_participant
      set email_invalide_at = null, email_invalide_evenement = null, email_invalide_raison = null
      where personne_id = new.id and email_invalide_at is not null;
  end if;
  return new;
end;
$function$
;
CREATE OR REPLACE FUNCTION public.resoudre_hash_secret_portefeuille(p_secret_hash text)
 RETURNS TABLE(portefeuille_id uuid, evenement_id uuid, organisation_id uuid)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  select w.id, w.evenement_id, w.organisation_id
  from public.secrets_portefeuille s
  join public.portefeuilles w on w.id = s.portefeuille_id
  where p_secret_hash ~ '^[0-9a-f]{64}$'
    and s.secret_hash = p_secret_hash
    and s.revoque_le is null;
$function$
;
CREATE OR REPLACE FUNCTION public.resoudre_lien_renouvellement(p_secret_hash text, p_slug text)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_lien public.liens_renouvellement;
  v_renouvele boolean;
  v_date_fin date;
begin
  select l.* into v_lien
  from public.liens_renouvellement l
  join public.organisations o on o.id = l.organisation_id
  where p_secret_hash ~ '^[0-9a-f]{64}$'
    and l.secret_hash = p_secret_hash
    and o.slug = p_slug
    and o.archived_at is null;

  if v_lien.id is null or v_lien.revoque_le is not null then
    return jsonb_build_object('etat', 'lien_invalide');
  end if;

  select count(*) > 0, max(a.date_fin) into v_renouvele, v_date_fin
  from public.adhesions a
  where a.adherent_id = v_lien.adherent_id and a.created_at > v_lien.cree_le;
  if v_renouvele then
    return jsonb_build_object('etat', 'deja_renouvele', 'date_fin', v_date_fin);
  end if;

  if exists (
    select 1 from public.demandes_adhesion d
    where d.adherent_vise_id = v_lien.adherent_id and d.type = 'renouvellement' and d.statut = 'en_attente'
  ) then
    return jsonb_build_object('etat', 'deja_envoye');
  end if;

  if v_lien.utilise_le is not null then
    return jsonb_build_object('etat', 'lien_invalide');
  end if;

  if v_lien.expire_le <= now() then
    return jsonb_build_object('etat', 'lien_expire');
  end if;

  return jsonb_build_object(
    'etat', 'valide',
    'lien_id', v_lien.id,
    'adherent_id', v_lien.adherent_id,
    'organisation_id', v_lien.organisation_id
  );
end;
$function$
;
CREATE OR REPLACE FUNCTION public.resoudre_secret_portefeuille(p_secret text)
 RETURNS TABLE(portefeuille_id uuid, evenement_id uuid, organisation_id uuid)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  select *
  from public.resoudre_hash_secret_portefeuille(
    encode(sha256(convert_to(coalesce(p_secret, ''), 'UTF8')), 'hex')
  );
$function$
;
CREATE OR REPLACE FUNCTION public.revoquer_liens_renouvellement(p_ids uuid[])
 RETURNS integer
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  with revoques as (
    update public.liens_renouvellement set revoque_le = now()
     where id = any (p_ids) and revoque_le is null
    returning 1
  )
  select count(*)::integer from revoques;
$function$
;
CREATE OR REPLACE FUNCTION public.revoquer_secrets_portefeuille(p_portefeuille_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
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
$function$
;
CREATE OR REPLACE FUNCTION public.revoquer_sessions_compte_technique(p_email text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_id uuid;
begin
  if p_email is null or p_email !~ '^(benevole|vendeur)-[0-9a-f-]{36}@mothana\.internal$' then
    raise exception 'COMPTE_TECHNIQUE_INVALIDE' using errcode = '22023';
  end if;
  select id into v_id from auth.users where email = p_email;
  if v_id is not null then
    delete from auth.sessions where user_id = v_id;
  end if;
  return v_id;
end;
$function$
;
CREATE OR REPLACE FUNCTION public.rls_auto_enable()
 RETURNS event_trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog'
AS $function$
DECLARE
  cmd record;
BEGIN
  FOR cmd IN
    SELECT *
    FROM pg_event_trigger_ddl_commands()
    WHERE command_tag IN ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
      AND object_type IN ('table','partitioned table')
  LOOP
     IF cmd.schema_name IS NOT NULL AND cmd.schema_name IN ('public') AND cmd.schema_name NOT IN ('pg_catalog','information_schema') AND cmd.schema_name NOT LIKE 'pg_toast%' AND cmd.schema_name NOT LIKE 'pg_temp%' THEN
      BEGIN
        EXECUTE format('alter table if exists %s enable row level security', cmd.object_identity);
        RAISE LOG 'rls_auto_enable: enabled RLS on %', cmd.object_identity;
      EXCEPTION
        WHEN OTHERS THEN
          RAISE LOG 'rls_auto_enable: failed to enable RLS on %', cmd.object_identity;
      END;
     ELSE
        RAISE LOG 'rls_auto_enable: skip % (either system schema or not in enforced list: %.)', cmd.object_identity, cmd.schema_name;
     END IF;
  END LOOP;
END;
$function$
;
CREATE OR REPLACE FUNCTION public.rythme_envoi_recus(p_organisation_id uuid)
 RETURNS TABLE(par_jour integer, par_minute integer)
 LANGUAGE sql
 STABLE
 SET search_path TO ''
AS $function$
  with m as (
    select o.modele_recu_pdf ->> 'envoi_lot_par_jour' as j, o.modele_recu_pdf ->> 'envoi_lot_par_minute' as mi
      from public.organisations o where o.id = p_organisation_id
  )
  select
    coalesce((select case when j ~ '^\d{1,5}$' and j::integer between 1 and 10000 then j::integer end from m), 250),
    coalesce((select case when mi ~ '^\d{1,2}$' and mi::integer between 1 and 60 then mi::integer end from m), 5)
$function$
;
CREATE OR REPLACE FUNCTION public.search_adherents(p_organisation_id uuid, p_search text DEFAULT NULL::text, p_statut text DEFAULT NULL::text, p_limit integer DEFAULT 50, p_offset integer DEFAULT 0, p_tag text DEFAULT NULL::text, p_exclude_tag text DEFAULT NULL::text, p_email_filter text DEFAULT NULL::text, p_code_postal text DEFAULT NULL::text, p_ville text DEFAULT NULL::text, p_pays text DEFAULT NULL::text, p_tri text DEFAULT NULL::text, p_sens text DEFAULT NULL::text)
 RETURNS TABLE(id uuid, id_externe text, civilite smallint, nom text, prenom text, date_naissance date, adresse text, code_postal text, ville text, pays text, telephone text, courriel text, statut text, statuts_acceptes boolean, consent_rgpd boolean, mailing_opt_out boolean, mailing_opt_out_at timestamp with time zone, tags text[], email_invalide_at timestamp with time zone, created_at timestamp with time zone, updated_at timestamp with time zone, total_count bigint)
 LANGUAGE sql
 STABLE
AS $function$
  with tri as (
    select
      case when p_tri in ('nom', 'prenom', 'statut', 'date_adhesion', 'date_fin', 'code_postal', 'ville')
        then p_tri else 'nom' end as cle,
      coalesce(lower(p_sens) = 'desc', false) as desc_
  )
  select
    a.id, a.id_externe, a.civilite, a.nom, a.prenom, a.date_naissance,
    a.adresse, a.code_postal, a.ville, a.pays, a.telephone, a.courriel,
    a.statut, a.statuts_acceptes, a.consent_rgpd, a.mailing_opt_out, a.mailing_opt_out_at,
    a.tags, a.email_invalide_at, a.created_at, a.updated_at,
    count(*) over() as total_count
  from adherents a
  cross join tri t
  left join lateral (
    select h.date_debut, h.date_fin
    from adhesions h
    where h.adherent_id = a.id
    order by h.date_debut desc, h.date_fin desc nulls first
    limit 1
  ) d on t.cle in ('date_adhesion', 'date_fin')
  where a.organisation_id = p_organisation_id
    and (
      p_statut is null
      or (p_statut not in ('a_jour', 'a_renouveler', 'expire') and a.statut = p_statut)
      or (
        p_statut in ('a_jour', 'a_renouveler', 'expire') and a.statut = 'actif'
        and coalesce((
          select case
            when h.date_fin is null or h.date_fin > current_date + 30 then 'a_jour'
            when h.date_fin >= current_date then 'a_renouveler'
            else 'expire'
          end
          from adhesions h
          where h.adherent_id = a.id
          order by h.date_debut desc, h.date_fin desc nulls first
          limit 1
        ), 'expire') = p_statut
      )
    )
    and (p_tag is null or p_tag = any(a.tags))
    and (p_exclude_tag is null or not (p_exclude_tag = any(a.tags)))
    and (
      p_email_filter is null or p_email_filter = ''
      or (p_email_filter = 'avec' and a.courriel is not null and trim(a.courriel) <> '')
      or (p_email_filter = 'sans' and (a.courriel is null or trim(a.courriel) = ''))
      or (p_email_filter = 'invalide' and a.email_invalide_at is not null)
    )
    and (p_code_postal is null or trim(p_code_postal) = '' or a.code_postal ilike '%' || trim(p_code_postal) || '%')
    and (p_ville is null or trim(p_ville) = '' or a.ville ilike '%' || trim(p_ville) || '%')
    and (p_pays is null or trim(p_pays) = '' or a.pays ilike '%' || trim(p_pays) || '%')
    and (
      p_search is null or trim(p_search) = ''
      or (a.nom || ' ' || coalesce(a.prenom, '')) ilike all (
        array(
          select '%' || tok || '%'
          from unnest(string_to_array(trim(p_search), ' ')) as tok
          where tok <> ''
        )
      )
      or a.courriel ilike '%' || trim(p_search) || '%'
    )
  order by
    -- Clé choisie (texte), dans le sens choisi ; une expression NULL pour toutes les lignes est neutre.
    case when not t.desc_ then case t.cle
      when 'nom' then a.nom
      when 'prenom' then nullif(trim(a.prenom), '')
      when 'statut' then a.statut
      when 'code_postal' then nullif(trim(a.code_postal), '')
      when 'ville' then nullif(trim(a.ville), '')
    end end asc nulls last,
    case when t.desc_ then case t.cle
      when 'nom' then a.nom
      when 'prenom' then nullif(trim(a.prenom), '')
      when 'statut' then a.statut
      when 'code_postal' then nullif(trim(a.code_postal), '')
      when 'ville' then nullif(trim(a.ville), '')
    end end desc nulls last,
    -- Clé choisie (date de la dernière adhésion).
    case when not t.desc_ then case t.cle
      when 'date_adhesion' then d.date_debut
      when 'date_fin' then d.date_fin
    end end asc nulls last,
    case when t.desc_ then case t.cle
      when 'date_adhesion' then d.date_debut
      when 'date_fin' then d.date_fin
    end end desc nulls last,
    -- Second critère dans le même sens : nom → prénom, prénom → nom, code postal → ville.
    case when not t.desc_ then case t.cle
      when 'nom' then nullif(trim(a.prenom), '')
      when 'prenom' then a.nom
      when 'code_postal' then nullif(trim(a.ville), '')
    end end asc nulls last,
    case when t.desc_ then case t.cle
      when 'nom' then nullif(trim(a.prenom), '')
      when 'prenom' then a.nom
      when 'code_postal' then nullif(trim(a.ville), '')
    end end desc nulls last,
    -- Départage indépendant du sens : ordre par défaut, puis id.
    a.nom asc, a.prenom asc, a.id
  limit p_limit offset p_offset;
$function$
;
CREATE OR REPLACE FUNCTION public.search_adherents_verification(p_organisation_id uuid, p_search text, p_limit integer DEFAULT 20)
 RETURNS TABLE(nom text, prenom text, id_externe text, statut text, date_fin date, a_adhesion boolean)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select
    a.nom, a.prenom, a.id_externe, a.statut, ad.date_fin, ad.adherent_id is not null
  from adherents a
  left join lateral (
    select h.adherent_id, h.date_fin
    from adhesions h
    where h.adherent_id = a.id
    order by h.date_debut desc, h.date_fin desc nulls first
    limit 1
  ) ad on true
  where a.organisation_id = p_organisation_id
    and (
      coalesce(is_current_user_super_admin(), false)
      or p_organisation_id = current_effective_organisation_id()
    )
    and trim(coalesce(p_search, '')) <> ''
    and (a.nom || ' ' || coalesce(a.prenom, '')) ilike all (
      array(
        select '%' || tok || '%'
        from unnest(string_to_array(trim(p_search), ' ')) as tok
        where tok <> ''
      )
    )
  order by a.nom asc, a.prenom asc
  limit p_limit;
$function$
;
CREATE OR REPLACE FUNCTION public.set_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
begin
  new.updated_at = now();
  return new;
end;
$function$
;
CREATE OR REPLACE FUNCTION public.set_updated_at_adherents()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$
;
CREATE OR REPLACE FUNCTION public.soumettre_demande_inscription(p_ip_hash text, p_email_hash text, p_jeton_hash text, p_demande jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_email text := lower(btrim(coalesce(p_demande ->> 'email', '')));
  v_nb integer;
  v_envoyer boolean := true;
  v_id uuid;
begin
  if p_ip_hash is null or p_ip_hash !~ '^[0-9a-f]{64}$'
     or p_email_hash is null or p_email_hash !~ '^[0-9a-f]{64}$'
     or p_jeton_hash is null or p_jeton_hash !~ '^[0-9a-f]{64}$'
     or jsonb_typeof(p_demande) is distinct from 'object' or v_email = '' then
    return jsonb_build_object('ok', false, 'reason', 'ACCES_INVALIDE');
  end if;

  perform pg_advisory_xact_lock(hashtextextended('inscription:ip:' || p_ip_hash, 0));
  perform pg_advisory_xact_lock(hashtextextended('inscription:email:' || p_email_hash, 0));

  delete from public.acces_portefeuille_rate_limits
  where scope in ('inscription_ip', 'inscription_email')
    and ip_hash in (p_ip_hash, p_email_hash)
    and created_at < clock_timestamp() - interval '1 day';

  -- Débit par IP d'abord (5 / heure) : une IP au-delà est refusée sans rien enregistrer, pour
  -- qu'elle ne puisse pas remplir à elle seule le plafond global.
  select count(*) into v_nb
  from public.acces_portefeuille_rate_limits
  where scope = 'inscription_ip'
    and ip_hash = p_ip_hash
    and created_at > clock_timestamp() - interval '1 hour';
  if v_nb >= 5 then
    return jsonb_build_object('ok', false, 'reason', 'RATE_LIMIT');
  end if;

  -- Plafond global quotidien (tentatives enregistrées, toutes IP confondues).
  select count(*) into v_nb
  from public.acces_portefeuille_rate_limits
  where scope = 'inscription_ip'
    and created_at > clock_timestamp() - interval '1 day';
  if v_nb >= 200 then
    return jsonb_build_object('ok', false, 'reason', 'RATE_LIMIT');
  end if;

  insert into public.acces_portefeuille_rate_limits(ip_hash, portefeuille_id, scope)
  values (p_ip_hash, null, 'inscription_ip');

  -- Emails par adresse : 3 / 24 h, au-delà rien n'est envoyé.
  select count(*) into v_nb
  from public.acces_portefeuille_rate_limits
  where scope = 'inscription_email'
    and ip_hash = p_email_hash
    and created_at > clock_timestamp() - interval '1 day';
  if v_nb >= 3 then
    v_envoyer := false;
  else
    insert into public.acces_portefeuille_rate_limits(ip_hash, portefeuille_id, scope)
    values (p_email_hash, null, 'inscription_email');
  end if;

  -- Adresse déjà rattachée à un compte (hors comptes techniques) : rien n'est créé.
  if exists (
    select 1 from auth.users u
    where lower(u.email) = v_email and u.email not like '%@mothana.internal'
  ) then
    return jsonb_build_object('ok', true, 'cas', 'compte_existant', 'envoyer_accuse', v_envoyer);
  end if;

  if exists (select 1 from public.demandes_inscription where email = v_email and statut = 'en_attente') then
    return jsonb_build_object('ok', true, 'cas', 'en_attente', 'envoyer_accuse', v_envoyer);
  end if;

  -- Demande pas encore confirmée : mise à jour (champs saisis, nouveau jeton, nouvelle
  -- expiration) et nouvel email de confirmation. Plafond d'emails atteint : rien ne change, pour
  -- que le dernier lien envoyé reste valable.
  select id into v_id from public.demandes_inscription
  where email = v_email and statut = 'a_confirmer'
  for update;
  if found then
    if v_envoyer then
      update public.demandes_inscription set
        nom_association = btrim(p_demande ->> 'nom_association'),
        ville = btrim(p_demande ->> 'ville'),
        rna = nullif(btrim(coalesce(p_demande ->> 'rna', '')), ''),
        siren = nullif(btrim(coalesce(p_demande ->> 'siren', '')), ''),
        prenom = btrim(p_demande ->> 'prenom'),
        nom = btrim(p_demande ->> 'nom'),
        message = nullif(btrim(coalesce(p_demande ->> 'message', '')), ''),
        cgu_acceptees_le = case when coalesce((p_demande ->> 'cgu_acceptees')::boolean, false) then now() end,
        confirmation_jeton_hash = p_jeton_hash,
        confirmation_expire_le = now() + interval '48 hours'
      where id = v_id;
    end if;
    return jsonb_build_object('ok', true, 'cas', 'a_confirmer', 'envoyer_accuse', v_envoyer, 'demande_id', v_id);
  end if;

  begin
    insert into public.demandes_inscription
      (nom_association, ville, rna, siren, prenom, nom, email, message, cgu_acceptees_le,
       statut, confirmation_jeton_hash, confirmation_expire_le)
    values (
      btrim(p_demande ->> 'nom_association'),
      btrim(p_demande ->> 'ville'),
      nullif(btrim(coalesce(p_demande ->> 'rna', '')), ''),
      nullif(btrim(coalesce(p_demande ->> 'siren', '')), ''),
      btrim(p_demande ->> 'prenom'),
      btrim(p_demande ->> 'nom'),
      v_email,
      nullif(btrim(coalesce(p_demande ->> 'message', '')), ''),
      case when coalesce((p_demande ->> 'cgu_acceptees')::boolean, false) then now() end,
      'a_confirmer',
      p_jeton_hash,
      now() + interval '48 hours'
    )
    returning id into v_id;
  exception when unique_violation then
    -- Course entre deux soumissions de la même adresse (en principe exclue par le verrou sur
    -- l'empreinte de l'adresse) : la première l'emporte, aucun email avec ce jeton non enregistré.
    return jsonb_build_object('ok', true, 'cas', 'a_confirmer', 'envoyer_accuse', false);
  end;

  return jsonb_build_object('ok', true, 'cas', 'nouvelle', 'envoyer_accuse', v_envoyer, 'demande_id', v_id);
end;
$function$
;
CREATE OR REPLACE FUNCTION public.soumettre_renouvellement(p_secret_hash text, p_ip_hash text, p_slug text, p_demande jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_lien public.liens_renouvellement;
  v_etat jsonb;
  v_demande_id uuid;
  v_notif boolean;
begin
  if p_secret_hash is null or p_secret_hash !~ '^[0-9a-f]{64}$'
     or p_ip_hash is null or p_ip_hash !~ '^[0-9a-f]{64}$'
     or p_slug is null or length(p_slug) > 100
     or p_demande is null or jsonb_typeof(p_demande) <> 'object' then
    return jsonb_build_object('ok', false, 'reason', 'ACCES_INVALIDE');
  end if;

  if public.limite_renouvellement_depassee(p_ip_hash, p_secret_hash,
       'renouvellement_envoi_ip', 'renouvellement_envoi_lien', 10, 5, interval '1 hour') then
    return jsonb_build_object('ok', false, 'reason', 'RATE_LIMIT');
  end if;

  -- Sérialise deux envois du même lien, puis deux liens du même adhérent.
  select * into v_lien from public.liens_renouvellement where secret_hash = p_secret_hash for update;
  if v_lien.id is not null then
    perform pg_advisory_xact_lock(hashtextextended('renouvellement:adherent:' || v_lien.adherent_id::text, 0));
  end if;

  v_etat := public.resoudre_lien_renouvellement(p_secret_hash, p_slug);
  if v_etat ->> 'etat' <> 'valide' then
    return jsonb_build_object('ok', false, 'reason', 'ETAT') || (v_etat - 'lien_id' - 'adherent_id' - 'organisation_id');
  end if;

  insert into public.demandes_adhesion (
    organisation_id, type, adherent_vise_id, statut,
    civilite, nom, prenom, date_naissance, adresse, code_postal, ville, pays, telephone, courriel,
    signature_data_url, accepte_statuts, consent_rgpd
  ) values (
    v_lien.organisation_id, 'renouvellement', v_lien.adherent_id, 'en_attente',
    (p_demande ->> 'civilite')::smallint, p_demande ->> 'nom', p_demande ->> 'prenom', null,
    p_demande ->> 'adresse', p_demande ->> 'code_postal', p_demande ->> 'ville', p_demande ->> 'pays',
    p_demande ->> 'telephone', p_demande ->> 'courriel',
    p_demande ->> 'signature_data_url', (p_demande ->> 'accepte_statuts')::boolean, (p_demande ->> 'consent_rgpd')::boolean
  )
  returning id into v_demande_id;

  update public.liens_renouvellement set utilise_le = now() where id = v_lien.id;

  select o.notif_demandes_adhesion into v_notif from public.organisations o where o.id = v_lien.organisation_id;

  return jsonb_build_object(
    'ok', true,
    'demande_id', v_demande_id,
    'organisation_id', v_lien.organisation_id,
    'notif_demandes_adhesion', coalesce(v_notif, false)
  );
end;
$function$
;
CREATE OR REPLACE FUNCTION public.supprimer_liste_diffusion(p_organisation_id uuid, p_nom text)
 RETURNS void
 LANGUAGE plpgsql
AS $function$
BEGIN
  UPDATE adherents
  SET tags = array_remove(tags, p_nom)
  WHERE organisation_id = p_organisation_id
    AND p_nom = any(tags);

  DELETE FROM listes_diffusion
  WHERE organisation_id = p_organisation_id
    AND nom = p_nom;
END;
$function$
;
CREATE OR REPLACE FUNCTION public.sync_listes_diffusion_from_tags()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  IF TG_OP = 'INSERT' OR NEW.tags IS DISTINCT FROM OLD.tags THEN
    INSERT INTO listes_diffusion (organisation_id, nom)
    SELECT NEW.organisation_id, t
    FROM unnest(NEW.tags) AS t
    ON CONFLICT (organisation_id, nom) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$function$
;
CREATE OR REPLACE FUNCTION public.terminer_ligne_lot_recus(p_ligne_id uuid, p_resultat text, p_erreur text DEFAULT NULL::text, p_recu_id uuid DEFAULT NULL::uuid, p_recu_preexistant boolean DEFAULT false, p_version_id uuid DEFAULT NULL::uuid, p_envoye_le timestamp with time zone DEFAULT NULL::timestamp with time zone, p_email_canal text DEFAULT NULL::text, p_deja_envoye boolean DEFAULT false)
 RETURNS text
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare
  v_ligne public.recus_lot_lignes%rowtype;
  v_type text;
  v_statut text;
  v_preexistant boolean;
begin
  select * into v_ligne from public.recus_lot_lignes where id = p_ligne_id for update;
  if not found then
    raise exception 'LIGNE_INTROUVABLE';
  end if;
  select l.type into v_type from public.recus_lots l where l.id = v_ligne.lot_id;

  v_statut := case
    when p_resultat = 'fait' then 'fait'
    when p_resultat = 'echec' then 'echec'
    when p_resultat = 'a_verifier' and v_type = 'envoi' then 'a_verifier'
    when p_resultat = 'reessayer' and v_ligne.tentatives >= 3 then 'echec'
    when p_resultat = 'reessayer' then 'a_faire'
  end;
  if v_statut is null then
    raise exception 'RESULTAT_INVALIDE: %', p_resultat;
  end if;

  v_preexistant := v_type = 'generation' and v_statut = 'fait' and coalesce(p_recu_preexistant, false);
  if v_preexistant and v_ligne.tentatives > 1 and p_recu_id is not null then
    select not exists (
      select 1
        from public.recus_lots l
        join lateral (
          select v.genere_par, v.genere_le
            from public.recus_fiscaux_versions v
           where v.recu_id = p_recu_id
           order by v.version
           limit 1
        ) premiere on true
       where l.id = v_ligne.lot_id
         and premiere.genere_par is not distinct from l.cree_par
         and premiere.genere_le >= l.cree_le
    ) into v_preexistant;
  end if;

  update public.recus_lot_lignes
     set statut = v_statut,
         erreur = case when v_statut = 'fait' then null else p_erreur end,
         recu_id = coalesce(p_recu_id, recu_id),
         recu_preexistant = v_preexistant,
         version_id = coalesce(p_version_id, version_id),
         envoye_le = case when v_statut = 'fait' then coalesce(p_envoye_le, envoye_le) else envoye_le end,
         email_canal = case when v_statut = 'fait' then coalesce(p_email_canal, email_canal) else email_canal end,
         deja_envoye = v_type = 'envoi' and v_statut = 'fait' and coalesce(p_deja_envoye, false),
         modifie_le = now()
   where id = p_ligne_id;

  perform public.recompter_lot_recus(v_ligne.lot_id);

  return v_statut;
end;
$function$
;
CREATE OR REPLACE FUNCTION public.valider_renouvellement(p_demande_id uuid, p_date_debut date, p_montant_cotisation numeric, p_mode_paiement smallint, p_date_paiement_cotisation date, p_droit_vote_ag boolean, p_bulletin_signe boolean, p_champs text[], p_reactiver boolean)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  c_champs constant text[] := array['civilite', 'nom', 'prenom', 'adresse', 'code_postal', 'ville', 'pays', 'telephone', 'courriel'];
  v_champs text[] := coalesce(p_champs, '{}');
  v_demande public.demandes_adhesion;
  v_avant public.adherents;
  v_apres public.adherents;
  v_diff jsonb := '{}'::jsonb;
  v_champ text;
  v_reactive boolean := false;
  v_adhesion_id uuid := gen_random_uuid();
  v_date_fin date;
begin
  select * into v_demande from public.demandes_adhesion where id = p_demande_id for update;

  if not coalesce(
    v_demande.id is not null
      and (public.is_current_user_super_admin() or v_demande.organisation_id = public.current_user_organisation_id()),
    false
  ) then
    raise exception 'ACCES_REFUSE' using errcode = '42501';
  end if;

  if v_demande.type <> 'renouvellement' then
    raise exception 'DEMANDE_PAS_UN_RENOUVELLEMENT' using errcode = '22023';
  end if;
  if v_demande.statut <> 'en_attente' then
    raise exception 'DEMANDE_DEJA_TRAITEE' using errcode = '22023';
  end if;
  if p_date_debut is null then
    raise exception 'DATE_ADHESION_REQUISE' using errcode = '22023';
  end if;
  if not (v_champs <@ c_champs) then
    raise exception 'CHAMP_INVALIDE' using errcode = '22023';
  end if;

  -- Adhérent supprimé entre-temps (on delete set null) : pas de renouvellement possible.
  select * into v_avant from public.adherents
  where id = v_demande.adherent_vise_id and organisation_id = v_demande.organisation_id
  for update;
  if v_avant.id is null then
    raise exception 'ADHERENT_INTROUVABLE' using errcode = 'P0002';
  end if;

  if v_avant.statut = 'archive' then
    if not coalesce(p_reactiver, false) then
      raise exception 'ADHERENT_ARCHIVE' using errcode = '22023';
    end if;
    update public.adherents set statut = 'actif' where id = v_avant.id;
    v_reactive := true;
    insert into public.journal_modifications (organisation_id, table_cible, ligne_id, action, details, auteur_id)
    values (v_demande.organisation_id, 'adherents', v_avant.id, 'reactivation',
            jsonb_build_object('nom', v_avant.nom, 'prenom', v_avant.prenom), auth.uid());
  end if;

  if cardinality(v_champs) > 0 then
    update public.adherents set
      civilite    = case when 'civilite'    = any(v_champs) then v_demande.civilite    else civilite end,
      nom         = case when 'nom'         = any(v_champs) then v_demande.nom         else nom end,
      prenom      = case when 'prenom'      = any(v_champs) then v_demande.prenom      else prenom end,
      adresse     = case when 'adresse'     = any(v_champs) then v_demande.adresse     else adresse end,
      code_postal = case when 'code_postal' = any(v_champs) then v_demande.code_postal else code_postal end,
      ville       = case when 'ville'       = any(v_champs) then v_demande.ville       else ville end,
      pays        = case when 'pays'        = any(v_champs) then v_demande.pays        else pays end,
      telephone   = case when 'telephone'   = any(v_champs) then v_demande.telephone   else telephone end,
      courriel    = case when 'courriel'    = any(v_champs) then v_demande.courriel    else courriel end
    where id = v_avant.id;
  end if;

  -- Email de confirmation de la demande rejeté : reporté sur la fiche si elle porte cette adresse
  -- (même règle que la ratification d'une demande d'adhésion).
  if v_demande.email_bounced_at is not null then
    update public.adherents
    set email_invalide_at = v_demande.email_bounced_at, email_invalide_evenement = 'confirmation_demande'
    where id = v_avant.id and lower(courriel) = lower(v_demande.courriel);
  end if;

  select * into v_apres from public.adherents where id = v_avant.id;
  foreach v_champ in array c_champs loop
    if to_jsonb(v_avant) -> v_champ is distinct from to_jsonb(v_apres) -> v_champ then
      v_diff := v_diff || jsonb_build_object(v_champ,
        jsonb_build_object('avant', to_jsonb(v_avant) -> v_champ, 'apres', to_jsonb(v_apres) -> v_champ));
    end if;
  end loop;
  if v_diff <> '{}'::jsonb then
    insert into public.journal_modifications (organisation_id, table_cible, ligne_id, action, details, auteur_id)
    values (v_demande.organisation_id, 'adherents', v_avant.id, 'modification',
            jsonb_build_object('nom', v_apres.nom, 'prenom', v_apres.prenom, 'champs_modifies', v_diff), auth.uid());
  end if;

  insert into public.adhesions (
    id, adherent_id, date_debut, montant_cotisation, date_paiement_cotisation, mode_paiement,
    renouvellement, droit_vote_ag, bulletin_signe
  ) values (
    v_adhesion_id, v_avant.id, p_date_debut, p_montant_cotisation, p_date_paiement_cotisation, p_mode_paiement,
    true, coalesce(p_droit_vote_ag, true), coalesce(p_bulletin_signe, true)
  )
  returning date_fin into v_date_fin;

  update public.demandes_adhesion
  set statut = 'ratifiee', decided_at = now(), decided_by = auth.uid(), adherent_id = v_avant.id
  where id = v_demande.id;

  insert into public.journal_modifications (organisation_id, table_cible, ligne_id, action, details, auteur_id)
  values (v_demande.organisation_id, 'demandes_adhesion', v_demande.id, 'ratification',
          jsonb_build_object('nom', v_demande.nom, 'prenom', v_demande.prenom, 'adherent_id', v_avant.id,
                             'type', 'renouvellement', 'adhesion_id', v_adhesion_id),
          auth.uid());

  return jsonb_build_object(
    'adherent_id', v_avant.id,
    'adhesion_id', v_adhesion_id,
    'date_fin', v_date_fin,
    'reactive', v_reactive,
    'champs_modifies', v_diff
  );
end;
$function$
;
CREATE OR REPLACE FUNCTION public.verifier_doublon_adhesion_benevole(p_organisation_id uuid, p_nom text, p_prenom text, p_courriel text)
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
begin
  if not coalesce(public.peut_saisir_adhesion_benevole(p_organisation_id), false) then
    raise exception 'ACCES_REFUSE' using errcode = '42501';
  end if;
  return public.adherent_doublon_existe(p_organisation_id, p_nom, p_prenom, p_courriel);
end;
$function$
;
CREATE OR REPLACE FUNCTION public.verifier_limite_demande_adhesion(p_ip_hash text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_attempt_count integer;
begin
  if p_ip_hash is null or p_ip_hash !~ '^[0-9a-f]{64}$' then
    return jsonb_build_object('ok', false, 'reason', 'ACCES_INVALIDE');
  end if;

  -- Sérialise les soumissions concurrentes de la même IP avant le comptage.
  perform pg_advisory_xact_lock(hashtextextended(
    'demande_adhesion:ip:' || p_ip_hash, 0
  ));

  delete from public.acces_portefeuille_rate_limits
  where scope = 'demande_adhesion'
    and ip_hash = p_ip_hash
    and created_at < clock_timestamp() - interval '1 day';

  insert into public.acces_portefeuille_rate_limits(ip_hash, portefeuille_id, scope)
  values (p_ip_hash, null, 'demande_adhesion');

  select count(*) into v_attempt_count
  from public.acces_portefeuille_rate_limits
  where scope = 'demande_adhesion'
    and ip_hash = p_ip_hash
    and created_at > clock_timestamp() - interval '1 hour';

  if v_attempt_count > 10 then
    return jsonb_build_object('ok', false, 'reason', 'RATE_LIMIT');
  end if;

  return jsonb_build_object('ok', true);
end;
$function$
;
CREATE OR REPLACE FUNCTION public.verifier_limite_reset_mdp(p_ip_hash text, p_email_hash text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_nb_ip integer;
  v_nb_email integer;
begin
  if p_ip_hash is null or p_ip_hash !~ '^[0-9a-f]{64}$'
     or p_email_hash is null or p_email_hash !~ '^[0-9a-f]{64}$' then
    return jsonb_build_object('ok', false, 'reason', 'ACCES_INVALIDE');
  end if;

  perform pg_advisory_xact_lock(hashtextextended('reset_mdp:ip:' || p_ip_hash, 0));
  perform pg_advisory_xact_lock(hashtextextended('reset_mdp:email:' || p_email_hash, 0));

  delete from public.acces_portefeuille_rate_limits
  where scope in ('reset_mdp_ip', 'reset_mdp_email')
    and ip_hash in (p_ip_hash, p_email_hash)
    and created_at < clock_timestamp() - interval '1 day';

  insert into public.acces_portefeuille_rate_limits(ip_hash, portefeuille_id, scope)
  values (p_ip_hash, null, 'reset_mdp_ip');

  select count(*) into v_nb_ip
  from public.acces_portefeuille_rate_limits
  where scope = 'reset_mdp_ip'
    and ip_hash = p_ip_hash
    and created_at > clock_timestamp() - interval '15 minutes';

  if v_nb_ip > 5 then
    return jsonb_build_object('ok', false, 'reason', 'RATE_LIMIT');
  end if;

  select count(*) into v_nb_email
  from public.acces_portefeuille_rate_limits
  where scope = 'reset_mdp_email'
    and ip_hash = p_email_hash
    and created_at > clock_timestamp() - interval '1 hour';

  if v_nb_email >= 3 then
    return jsonb_build_object('ok', true, 'envoyer', false);
  end if;

  insert into public.acces_portefeuille_rate_limits(ip_hash, portefeuille_id, scope)
  values (p_email_hash, null, 'reset_mdp_email');

  return jsonb_build_object('ok', true, 'envoyer', true);
end;
$function$
;
CREATE OR REPLACE FUNCTION public.verifier_limite_simulation_achat(p_ip_hash text, p_email_hash text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_nb_ip integer;
  v_nb_email integer;
begin
  if p_ip_hash is null or p_ip_hash !~ '^[0-9a-f]{64}$'
     or p_email_hash is null or p_email_hash !~ '^[0-9a-f]{64}$' then
    return jsonb_build_object('ok', false, 'reason', 'ACCES_INVALIDE');
  end if;

  perform pg_advisory_xact_lock(hashtextextended('simulation_achat:ip:' || p_ip_hash, 0));
  perform pg_advisory_xact_lock(hashtextextended('simulation_achat:email:' || p_email_hash, 0));

  delete from public.acces_portefeuille_rate_limits
  where scope in ('simulation_achat_ip', 'simulation_achat_email')
    and ip_hash in (p_ip_hash, p_email_hash)
    and created_at < clock_timestamp() - interval '2 days';

  insert into public.acces_portefeuille_rate_limits(ip_hash, portefeuille_id, scope)
  values (p_ip_hash, null, 'simulation_achat_ip');

  select count(*) into v_nb_ip
  from public.acces_portefeuille_rate_limits
  where scope = 'simulation_achat_ip'
    and ip_hash = p_ip_hash
    and created_at > clock_timestamp() - interval '1 hour';

  if v_nb_ip > 5 then
    return jsonb_build_object('ok', false, 'reason', 'RATE_LIMIT');
  end if;

  select count(*) into v_nb_email
  from public.acces_portefeuille_rate_limits
  where scope = 'simulation_achat_email'
    and ip_hash = p_email_hash
    and created_at > clock_timestamp() - interval '1 day';

  if v_nb_email >= 3 then
    return jsonb_build_object('ok', false, 'reason', 'RATE_LIMIT');
  end if;

  insert into public.acces_portefeuille_rate_limits(ip_hash, portefeuille_id, scope)
  values (p_email_hash, null, 'simulation_achat_email');

  return jsonb_build_object('ok', true);
end;
$function$
;
CREATE OR REPLACE FUNCTION public.verifier_limite_verify_pin(p_ip_hash text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_attempt_count integer;
begin
  if p_ip_hash is null or p_ip_hash !~ '^[0-9a-f]{64}$' then
    return jsonb_build_object('ok', false, 'reason', 'ACCES_INVALIDE');
  end if;

  -- Sérialise les tentatives concurrentes de la même IP avant le comptage.
  perform pg_advisory_xact_lock(hashtextextended(
    'portefeuille:ip:verify_pin:' || p_ip_hash, 0
  ));

  delete from public.acces_portefeuille_rate_limits
  where scope = 'verify_pin'
    and ip_hash = p_ip_hash
    and created_at < clock_timestamp() - interval '1 day';

  insert into public.acces_portefeuille_rate_limits(ip_hash, portefeuille_id, scope)
  values (p_ip_hash, null, 'verify_pin');

  select count(*) into v_attempt_count
  from public.acces_portefeuille_rate_limits
  where scope = 'verify_pin'
    and ip_hash = p_ip_hash
    and created_at > clock_timestamp() - interval '15 minutes';

  if v_attempt_count > 10 then
    return jsonb_build_object('ok', false, 'reason', 'RATE_LIMIT');
  end if;

  return jsonb_build_object('ok', true);
end;
$function$
;
CREATE OR REPLACE FUNCTION public.vider_liste_diffusion(p_organisation_id uuid, p_nom text)
 RETURNS void
 LANGUAGE sql
AS $function$
  update adherents
  set tags = array_remove(tags, p_nom)
  where organisation_id = p_organisation_id
    and p_nom = any(tags);
$function$
;
alter table public.acces_portefeuille_rate_limits alter column created_at set default clock_timestamp();
alter table public.activites alter column created_at set default now();
alter table public.activites alter column id set default uuid_generate_v4();
alter table public.adherents alter column civilite set default 0;
alter table public.adherents alter column consent_rgpd set default false;
alter table public.adherents alter column created_at set default now();
alter table public.adherents alter column id set default gen_random_uuid();
alter table public.adherents alter column mailing_opt_out set default false;
alter table public.adherents alter column mailing_unsubscribe_token set default gen_random_uuid();
alter table public.adherents alter column pays set default 'France'::text;
alter table public.adherents alter column statut set default 'actif'::text;
alter table public.adherents alter column statuts_acceptes set default true;
alter table public.adherents alter column tags set default '{}'::text[];
alter table public.adherents alter column updated_at set default now();
alter table public.adhesions alter column bulletin_signe set default true;
alter table public.adhesions alter column created_at set default now();
alter table public.adhesions alter column droit_vote_ag set default true;
alter table public.adhesions alter column id set default gen_random_uuid();
alter table public.adhesions alter column renouvellement set default false;
alter table public.campagnes_courrier alter column created_at set default now();
alter table public.campagnes_courrier alter column detail_enregistre set default false;
alter table public.campagnes_courrier alter column id set default gen_random_uuid();
alter table public.campagnes_courrier alter column nombre_exclus set default 0;
alter table public.campagnes_courrier_destinataires alter column id set default gen_random_uuid();
alter table public.campagnes_mailing alter column created_at set default now();
alter table public.campagnes_mailing alter column id set default gen_random_uuid();
alter table public.campagnes_mailing alter column nombre_exclus set default 0;
alter table public.campagnes_mailing_destinataires alter column id set default gen_random_uuid();
alter table public.commandes alter column created_at set default now();
alter table public.commandes alter column expire_le set default (now() + '00:30:00'::interval);
alter table public.commandes alter column id set default gen_random_uuid();
alter table public.commandes alter column moyen_paiement set default 'en_ligne'::text;
alter table public.commandes alter column statut set default 'en_attente_paiement'::text;
alter table public.commandes alter column updated_at set default now();
alter table public.coupon_transport_spike alter column changed_at set default clock_timestamp();
alter table public.coupon_transport_spike alter column expires_at set default (clock_timestamp() + '02:00:00'::interval);
alter table public.coupon_transport_spike alter column id set default gen_random_uuid();
alter table public.coupon_transport_spike alter column revision set default 0;
alter table public.coupon_transport_spike alter column status set default 'idle'::text;
alter table public.demandes_adhesion alter column accepte_statuts set default false;
alter table public.demandes_adhesion alter column civilite set default 0;
alter table public.demandes_adhesion alter column consent_rgpd set default false;
alter table public.demandes_adhesion alter column created_at set default now();
alter table public.demandes_adhesion alter column id set default gen_random_uuid();
alter table public.demandes_adhesion alter column pays set default 'France'::text;
alter table public.demandes_adhesion alter column statut set default 'en_attente'::text;
alter table public.demandes_adhesion alter column type set default 'adhesion'::text;
alter table public.demandes_inscription alter column created_at set default now();
alter table public.demandes_inscription alter column id set default gen_random_uuid();
alter table public.demandes_inscription alter column statut set default 'a_confirmer'::text;
alter table public.demandes_paiement alter column created_at set default now();
alter table public.demandes_paiement alter column expire_le set default (now() + '00:01:30'::interval);
alter table public.demandes_paiement alter column id set default gen_random_uuid();
alter table public.demandes_paiement alter column statut set default 'en_attente'::text;
alter table public.demandes_paiement alter column updated_at set default now();
alter table public.dons alter column created_at set default now();
alter table public.dons alter column created_by_role set default 'admin'::text;
alter table public.dons alter column date set default CURRENT_DATE;
alter table public.dons alter column id set default uuid_generate_v4();
alter table public.dons alter column updated_at set default now();
alter table public.dons_fichiers alter column created_at set default now();
alter table public.dons_fichiers alter column id set default gen_random_uuid();
alter table public.dons_reguliers alter column created_at set default now();
alter table public.dons_reguliers alter column id set default gen_random_uuid();
alter table public.dons_reguliers alter column statut set default 'actif'::text;
alter table public.dons_reguliers alter column updated_at set default now();
alter table public.evenements alter column created_at set default now();
alter table public.evenements alter column id set default gen_random_uuid();
alter table public.evenements alter column montants_credit_centimes set default '{500,1000,2000,5000}'::integer[];
alter table public.evenements alter column statut set default 'brouillon'::text;
alter table public.evenements alter column updated_at set default now();
alter table public.journal_modifications alter column created_at set default now();
alter table public.journal_modifications alter column id set default gen_random_uuid();
alter table public.liens_renouvellement alter column cree_le set default now();
alter table public.liens_renouvellement alter column expire_le set default (now() + '90 days'::interval);
alter table public.liens_renouvellement alter column id set default gen_random_uuid();
alter table public.listes_diffusion alter column created_at set default now();
alter table public.listes_diffusion alter column id set default gen_random_uuid();
alter table public.mailing_templates alter column created_at set default now();
alter table public.mailing_templates alter column id set default gen_random_uuid();
alter table public.mouvements_portefeuille alter column created_at set default now();
alter table public.mouvements_portefeuille alter column id set default gen_random_uuid();
alter table public.organisation_assets alter column created_at set default now();
alter table public.organisation_assets alter column id set default uuid_generate_v4();
alter table public.organisation_secrets alter column updated_at set default now();
alter table public.organisations alter column adhesion_mois_bascule set default 12;
alter table public.organisations alter column adhesion_regle_fin set default 'glissante'::text;
alter table public.organisations alter column conservation_evenements_mois set default 18;
alter table public.organisations alter column created_at set default now();
alter table public.organisations alter column fonctionnalites_activees set default '{"dons": true, "adherents": true, "evenements": false}'::jsonb;
alter table public.organisations alter column id set default uuid_generate_v4();
alter table public.organisations alter column modele_recu_pdf set default '{}'::jsonb;
alter table public.organisations alter column notif_demandes_adhesion set default true;
alter table public.organisations alter column pays set default 'France'::text;
alter table public.organisations alter column saisie_adhesion_benevole set default false;
alter table public.organisations alter column updated_at set default now();
alter table public.personnes alter column created_at set default now();
alter table public.personnes alter column id set default uuid_generate_v4();
alter table public.personnes alter column updated_at set default now();
alter table public.portefeuilles alter column code_public set default translate(upper(replace((gen_random_uuid())::text, '-'::text, ''::text)), '01'::text, 'GH'::text);
alter table public.portefeuilles alter column created_at set default now();
alter table public.portefeuilles alter column gele set default false;
alter table public.portefeuilles alter column id set default gen_random_uuid();
alter table public.portefeuilles alter column solde_centimes set default 0;
alter table public.portefeuilles alter column updated_at set default now();
alter table public.profils_organisation alter column created_at set default now();
alter table public.profils_organisation alter column id set default uuid_generate_v4();
alter table public.profils_organisation alter column notif_demandes_adhesion set default true;
alter table public.profils_organisation alter column role set default 'admin'::text;
alter table public.profils_participant alter column created_at set default now();
alter table public.profils_participant alter column id set default uuid_generate_v4();
alter table public.recus_fiscaux alter column date_generation set default now();
alter table public.recus_fiscaux alter column id set default uuid_generate_v4();
alter table public.recus_fiscaux_versions alter column genere_le set default now();
alter table public.recus_fiscaux_versions alter column id set default gen_random_uuid();
alter table public.recus_lot_lignes alter column deja_envoye set default false;
alter table public.recus_lot_lignes alter column id set default gen_random_uuid();
alter table public.recus_lot_lignes alter column modifie_le set default now();
alter table public.recus_lot_lignes alter column recu_preexistant set default false;
alter table public.recus_lot_lignes alter column statut set default 'a_faire'::text;
alter table public.recus_lot_lignes alter column tentatives set default 0;
alter table public.recus_lots alter column cree_le set default now();
alter table public.recus_lots alter column id set default gen_random_uuid();
alter table public.recus_lots alter column nb_a_verifier set default 0;
alter table public.recus_lots alter column nb_echecs set default 0;
alter table public.recus_lots alter column nb_faits set default 0;
alter table public.recus_lots alter column nb_total set default 0;
alter table public.recus_lots alter column statut set default 'en_cours'::text;
alter table public.recus_lots alter column type set default 'generation'::text;
alter table public.secrets_portefeuille alter column created_at set default now();
alter table public.secrets_portefeuille alter column id set default gen_random_uuid();
alter table public.secrets_portefeuille alter column updated_at set default now();
alter table public.signatures_adhesion alter column created_at set default now();
alter table public.templates_carte_adherent alter column created_at set default now();
alter table public.templates_carte_adherent alter column id set default uuid_generate_v4();
alter table public.templates_carte_adherent alter column is_active set default false;
alter table public.templates_carte_adherent alter column is_archived set default false;
alter table public.templates_carte_adherent alter column updated_at set default now();
alter table public.templates_recu alter column created_at set default now();
alter table public.templates_recu alter column id set default uuid_generate_v4();
alter table public.templates_recu alter column is_active set default false;
alter table public.templates_recu alter column is_archived set default false;
alter table public.templates_recu alter column updated_at set default now();
alter table public.acces_portefeuille_rate_limits add constraint acces_portefeuille_rate_limits_ip_hash_check CHECK ((ip_hash ~ '^[0-9a-f]{64}$'::text));
alter table public.acces_portefeuille_rate_limits add constraint acces_portefeuille_rate_limits_pkey PRIMARY KEY (id);
alter table public.acces_portefeuille_rate_limits add constraint acces_portefeuille_rate_limits_scope_check CHECK ((scope = ANY (ARRAY['etat'::text, 'pdf'::text, 'verify_pin'::text, 'demande_adhesion'::text, 'reset_mdp_ip'::text, 'reset_mdp_email'::text, 'simulation_achat_ip'::text, 'simulation_achat_email'::text, 'renouvellement_lecture_ip'::text, 'renouvellement_lecture_lien'::text, 'renouvellement_envoi_ip'::text, 'renouvellement_envoi_lien'::text, 'inscription_ip'::text, 'inscription_email'::text, 'inscription_confirmation_ip'::text])));
alter table public.activites add constraint activites_dates_check CHECK (((date_fin IS NULL) OR (date_debut IS NULL) OR (date_fin >= date_debut))) NOT VALID;
alter table public.activites add constraint activites_organisation_id_externe_unique UNIQUE (organisation_id, id_externe);
alter table public.activites add constraint activites_pkey PRIMARY KEY (id);
alter table public.adherents add constraint adherents_civilite_check CHECK ((civilite = ANY (ARRAY[0, 1, 2])));
alter table public.adherents add constraint adherents_id_externe_unique UNIQUE (organisation_id, id_externe);
alter table public.adherents add constraint adherents_pkey PRIMARY KEY (id);
alter table public.adherents add constraint adherents_statut_check CHECK ((statut = ANY (ARRAY['actif'::text, 'archive'::text])));
alter table public.adhesions add constraint adhesions_dates_check CHECK (((date_fin IS NULL) OR (date_fin >= date_debut)));
alter table public.adhesions add constraint adhesions_mode_paiement_check CHECK ((mode_paiement = ANY (ARRAY[1, 2, 3, 4])));
alter table public.adhesions add constraint adhesions_pkey PRIMARY KEY (id);
alter table public.campagnes_courrier_destinataires add constraint campagnes_courrier_destinataires_pkey PRIMARY KEY (id);
alter table public.campagnes_courrier_destinataires add constraint campagnes_courrier_destinataires_raison_coherente CHECK ((((statut = 'genere'::text) AND (raison_exclusion IS NULL)) OR ((statut = 'exclu'::text) AND (raison_exclusion IS NOT NULL))));
alter table public.campagnes_courrier_destinataires add constraint campagnes_courrier_destinataires_raison_exclusion_check CHECK ((raison_exclusion = 'adresse_incomplete'::text));
alter table public.campagnes_courrier_destinataires add constraint campagnes_courrier_destinataires_statut_check CHECK ((statut = ANY (ARRAY['genere'::text, 'exclu'::text])));
alter table public.campagnes_courrier add constraint campagnes_courrier_pkey PRIMARY KEY (id);
alter table public.campagnes_mailing_destinataires add constraint campagnes_mailing_destinataires_pkey PRIMARY KEY (id);
alter table public.campagnes_mailing_destinataires add constraint campagnes_mailing_destinataires_raison_coherente CHECK ((((statut = 'envoye'::text) AND (raison_exclusion IS NULL)) OR ((statut = 'exclu'::text) AND (raison_exclusion IS NOT NULL))));
alter table public.campagnes_mailing_destinataires add constraint campagnes_mailing_destinataires_raison_exclusion_check CHECK ((raison_exclusion = ANY (ARRAY['email_manquant'::text, 'email_invalide'::text, 'email_rejete'::text])));
alter table public.campagnes_mailing_destinataires add constraint campagnes_mailing_destinataires_statut_check CHECK ((statut = ANY (ARRAY['envoye'::text, 'exclu'::text])));
alter table public.campagnes_mailing add constraint campagnes_mailing_pkey PRIMARY KEY (id);
alter table public.commandes add constraint commandes_cle_idempotence_key UNIQUE (cle_idempotence);
alter table public.commandes add constraint commandes_email_check CHECK (((email = lower(btrim(email))) AND (email ~ '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$'::text)));
alter table public.commandes add constraint commandes_id_organisation_id_key UNIQUE (id, organisation_id);
alter table public.commandes add constraint commandes_id_portefeuille_id_organisation_id_key UNIQUE (id, portefeuille_id, organisation_id);
alter table public.commandes add constraint commandes_montant_centimes_check CHECK ((montant_centimes > 0));
alter table public.commandes add constraint commandes_moyen_paiement_check CHECK ((moyen_paiement = ANY (ARRAY['en_ligne'::text, 'manuel'::text])));
alter table public.commandes add constraint commandes_pkey PRIMARY KEY (id);
alter table public.commandes add constraint commandes_reference_paiement_key UNIQUE (reference_paiement);
alter table public.commandes add constraint commandes_statut_check CHECK ((statut = ANY (ARRAY['en_attente_paiement'::text, 'payee'::text, 'annulee'::text, 'expiree'::text, 'remboursee'::text])));
alter table public.coupon_transport_spike add constraint coupon_transport_spike_pkey PRIMARY KEY (id);
alter table public.coupon_transport_spike add constraint coupon_transport_spike_status_check CHECK ((status = ANY (ARRAY['idle'::text, 'pending'::text, 'accepted'::text, 'refused'::text, 'expired'::text])));
alter table public.demandes_adhesion add constraint demandes_adhesion_accepte_statuts_check CHECK ((accepte_statuts = true));
alter table public.demandes_adhesion add constraint demandes_adhesion_adherent_vise_check CHECK (((type = 'renouvellement'::text) OR (adherent_vise_id IS NULL)));
alter table public.demandes_adhesion add constraint demandes_adhesion_civilite_check CHECK ((civilite = ANY (ARRAY[0, 1, 2])));
alter table public.demandes_adhesion add constraint demandes_adhesion_consent_rgpd_check CHECK ((consent_rgpd = true));
alter table public.demandes_adhesion add constraint demandes_adhesion_pkey PRIMARY KEY (id);
alter table public.demandes_adhesion add constraint demandes_adhesion_statut_check CHECK ((statut = ANY (ARRAY['en_attente'::text, 'ratifiee'::text, 'refusee'::text])));
alter table public.demandes_adhesion add constraint demandes_adhesion_type_check CHECK ((type = ANY (ARRAY['adhesion'::text, 'renouvellement'::text])));
alter table public.demandes_inscription add constraint demandes_inscription_confirmation_check CHECK ((((confirmation_jeton_hash IS NULL) OR (confirmation_jeton_hash ~ '^[0-9a-f]{64}$'::text)) AND ((statut <> 'a_confirmer'::text) OR ((confirmation_jeton_hash IS NOT NULL) AND (confirmation_expire_le IS NOT NULL)))));
alter table public.demandes_inscription add constraint demandes_inscription_email_check CHECK (((char_length(email) <= 254) AND (email = lower(email)) AND (email ~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'::text)));
alter table public.demandes_inscription add constraint demandes_inscription_message_check CHECK (((message IS NULL) OR (char_length(message) <= 2000)));
alter table public.demandes_inscription add constraint demandes_inscription_nom_association_check CHECK (((char_length(btrim(nom_association)) >= 2) AND (char_length(btrim(nom_association)) <= 150)));
alter table public.demandes_inscription add constraint demandes_inscription_nom_check CHECK (((char_length(btrim(nom)) >= 1) AND (char_length(btrim(nom)) <= 100)));
alter table public.demandes_inscription add constraint demandes_inscription_pkey PRIMARY KEY (id);
alter table public.demandes_inscription add constraint demandes_inscription_prenom_check CHECK (((char_length(btrim(prenom)) >= 1) AND (char_length(btrim(prenom)) <= 100)));
alter table public.demandes_inscription add constraint demandes_inscription_rna_check CHECK (((rna IS NULL) OR (rna ~ '^W[0-9]{9}$'::text)));
alter table public.demandes_inscription add constraint demandes_inscription_siren_check CHECK (((siren IS NULL) OR (siren ~ '^[0-9]{9}$'::text)));
alter table public.demandes_inscription add constraint demandes_inscription_statut_check CHECK ((statut = ANY (ARRAY['a_confirmer'::text, 'en_attente'::text, 'acceptee'::text, 'refusee'::text])));
alter table public.demandes_inscription add constraint demandes_inscription_ville_check CHECK (((char_length(btrim(ville)) >= 1) AND (char_length(btrim(ville)) <= 100)));
alter table public.demandes_paiement add constraint demandes_paiement_id_organisation_id_key UNIQUE (id, organisation_id);
alter table public.demandes_paiement add constraint demandes_paiement_id_portefeuille_id_organisation_id_key UNIQUE (id, portefeuille_id, organisation_id);
alter table public.demandes_paiement add constraint demandes_paiement_montant_centimes_check CHECK ((montant_centimes > 0));
alter table public.demandes_paiement add constraint demandes_paiement_pkey PRIMARY KEY (id);
alter table public.demandes_paiement add constraint demandes_paiement_statut_check CHECK ((statut = ANY (ARRAY['en_attente'::text, 'validee'::text, 'refusee'::text, 'expiree'::text, 'annulee'::text])));
alter table public.dons add constraint dons_created_by_role_check CHECK ((created_by_role = ANY (ARRAY['admin'::text, 'benevole'::text])));
alter table public.dons_fichiers add constraint dons_fichiers_pkey PRIMARY KEY (id);
alter table public.dons add constraint dons_mode_paiement_check CHECK ((mode_paiement = ANY (ARRAY[1, 2, 3, 4])));
alter table public.dons add constraint dons_montant_check CHECK ((montant > (0)::numeric));
alter table public.dons add constraint dons_organisation_id_externe_unique UNIQUE (organisation_id, id_externe);
alter table public.dons add constraint dons_pkey PRIMARY KEY (id);
alter table public.dons_reguliers add constraint dons_reguliers_jour_prelevement_check CHECK (((jour_prelevement >= 1) AND (jour_prelevement <= 28)));
alter table public.dons_reguliers add constraint dons_reguliers_montant_check CHECK ((montant > (0)::numeric));
alter table public.dons_reguliers add constraint dons_reguliers_pkey PRIMARY KEY (id);
alter table public.dons_reguliers add constraint dons_reguliers_statut_check CHECK ((statut = ANY (ARRAY['actif'::text, 'arrete'::text])));
alter table public.evenements add constraint evenements_date_fin_check CHECK ((date_fin >= date_evenement));
alter table public.evenements add constraint evenements_id_organisation_id_key UNIQUE (id, organisation_id);
alter table public.evenements add constraint evenements_montants_credit_centimes_check CHECK (((cardinality(montants_credit_centimes) > 0) AND (array_ndims(montants_credit_centimes) = 1) AND (array_position(montants_credit_centimes, NULL::integer) IS NULL) AND (0 < ALL (montants_credit_centimes))));
alter table public.evenements add constraint evenements_nom_check CHECK ((btrim(nom) <> ''::text));
alter table public.evenements add constraint evenements_organisation_id_slug_key UNIQUE (organisation_id, slug);
alter table public.evenements add constraint evenements_pkey PRIMARY KEY (id);
alter table public.evenements add constraint evenements_slug_check CHECK ((btrim(slug) <> ''::text));
alter table public.evenements add constraint evenements_statut_check CHECK ((statut = ANY (ARRAY['brouillon'::text, 'ouvert'::text, 'clos'::text])));
alter table public.journal_modifications add constraint journal_modifications_pkey PRIMARY KEY (id);
alter table public.liens_renouvellement add constraint liens_renouvellement_pkey PRIMARY KEY (id);
alter table public.liens_renouvellement add constraint liens_renouvellement_secret_hash_check CHECK ((secret_hash ~ '^[0-9a-f]{64}$'::text));
alter table public.liens_renouvellement add constraint liens_renouvellement_secret_hash_key UNIQUE (secret_hash);
alter table public.listes_diffusion add constraint listes_diffusion_nom_unique UNIQUE (organisation_id, nom);
alter table public.listes_diffusion add constraint listes_diffusion_pkey PRIMARY KEY (id);
alter table public.mailing_templates add constraint mailing_templates_nom_unique UNIQUE (organisation_id, nom);
alter table public.mailing_templates add constraint mailing_templates_pkey PRIMARY KEY (id);
alter table public.mouvements_portefeuille add constraint mouvements_portefeuille_check CHECK ((((type = ANY (ARRAY['credit_initial'::text, 'credit_recharge'::text])) AND (commande_id IS NOT NULL) AND (demande_paiement_id IS NULL)) OR ((type = 'debit'::text) AND (commande_id IS NULL) AND (demande_paiement_id IS NOT NULL))));
alter table public.mouvements_portefeuille add constraint mouvements_portefeuille_commande_id_key UNIQUE (commande_id);
alter table public.mouvements_portefeuille add constraint mouvements_portefeuille_demande_paiement_id_key UNIQUE (demande_paiement_id);
alter table public.mouvements_portefeuille add constraint mouvements_portefeuille_montant_centimes_check CHECK ((montant_centimes > 0));
alter table public.mouvements_portefeuille add constraint mouvements_portefeuille_pkey PRIMARY KEY (id);
alter table public.mouvements_portefeuille add constraint mouvements_portefeuille_solde_apres_centimes_check CHECK ((solde_apres_centimes >= 0));
alter table public.mouvements_portefeuille add constraint mouvements_portefeuille_type_check CHECK ((type = ANY (ARRAY['credit_initial'::text, 'credit_recharge'::text, 'debit'::text])));
alter table public.organisation_assets add constraint organisation_assets_identifiant_check CHECK ((identifiant ~ '^[a-z0-9_]+$'::text));
alter table public.organisation_assets add constraint organisation_assets_organisation_id_identifiant_key UNIQUE (organisation_id, identifiant);
alter table public.organisation_assets add constraint organisation_assets_pkey PRIMARY KEY (id);
alter table public.organisation_secrets add constraint organisation_secrets_brevo_webhook_secret_check CHECK (((brevo_webhook_secret IS NULL) OR (brevo_webhook_secret ~ '^[0-9a-f]{64}$'::text)));
alter table public.organisation_secrets add constraint organisation_secrets_code_pin_benevole_key UNIQUE (code_pin_benevole);
alter table public.organisation_secrets add constraint organisation_secrets_code_pin_vendeur_evenement_key UNIQUE (code_pin_vendeur_evenement);
alter table public.organisation_secrets add constraint organisation_secrets_pkey PRIMARY KEY (organisation_id);
alter table public.organisations add constraint organisations_adhesion_mois_bascule_check CHECK (((adhesion_mois_bascule >= 1) AND (adhesion_mois_bascule <= 12)));
alter table public.organisations add constraint organisations_adhesion_regle_fin_check CHECK ((adhesion_regle_fin = ANY (ARRAY['glissante'::text, 'annee_civile'::text])));
alter table public.organisations add constraint organisations_conservation_evenements_mois_check CHECK (((conservation_evenements_mois >= 1) AND (conservation_evenements_mois <= 120)));
alter table public.organisations add constraint organisations_pkey PRIMARY KEY (id);
alter table public.organisations add constraint organisations_slug_unique UNIQUE (slug);
alter table public.organisations add constraint organisations_url_politique_confidentialite_check CHECK (((url_politique_confidentialite IS NULL) OR ((url_politique_confidentialite ~* '^https?://[^[:space:]]+$'::text) AND (length(url_politique_confidentialite) <= 2048))));
alter table public.personnes add constraint personnes_pkey PRIMARY KEY (id);
alter table public.portefeuilles add constraint portefeuilles_code_public_check CHECK ((code_public ~ '^[2-9A-H]{10,}$'::text));
alter table public.portefeuilles add constraint portefeuilles_code_public_key UNIQUE (code_public);
alter table public.portefeuilles add constraint portefeuilles_email_check CHECK (((email = lower(btrim(email))) AND (email ~ '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$'::text)));
alter table public.portefeuilles add constraint portefeuilles_id_evenement_id_organisation_id_key UNIQUE (id, evenement_id, organisation_id);
alter table public.portefeuilles add constraint portefeuilles_id_organisation_id_key UNIQUE (id, organisation_id);
alter table public.portefeuilles add constraint portefeuilles_pkey PRIMARY KEY (id);
alter table public.portefeuilles add constraint portefeuilles_solde_centimes_check CHECK ((solde_centimes >= 0));
alter table public.profils_organisation add constraint profils_organisation_pkey PRIMARY KEY (id);
alter table public.profils_organisation add constraint profils_organisation_role_check CHECK ((role = ANY (ARRAY['admin'::text, 'contributeur'::text])));
alter table public.profils_organisation add constraint profils_organisation_utilisateur_id_organisation_id_key UNIQUE (utilisateur_id, organisation_id);
alter table public.profils_participant add constraint profils_participant_organisation_id_externe_unique UNIQUE (organisation_id, id_externe);
alter table public.profils_participant add constraint profils_participant_personne_id_organisation_id_key UNIQUE (personne_id, organisation_id);
alter table public.profils_participant add constraint profils_participant_pkey PRIMARY KEY (id);
alter table public.recus_fiscaux add constraint recus_fiscaux_email_canal_check CHECK (((email_canal IS NULL) OR (email_canal = ANY (ARRAY['brevo'::text, 'resend'::text, 'simulation'::text]))));
alter table public.recus_fiscaux add constraint recus_fiscaux_pkey PRIMARY KEY (id);
alter table public.recus_fiscaux add constraint recus_fiscaux_profil_participant_id_annee_key UNIQUE (profil_participant_id, annee);
alter table public.recus_fiscaux add constraint recus_fiscaux_type_cerfa_check CHECK ((type_cerfa = ANY (ARRAY['11580'::text, '16216'::text])));
alter table public.recus_fiscaux_versions add constraint recus_fiscaux_versions_pkey PRIMARY KEY (id);
alter table public.recus_fiscaux_versions add constraint recus_fiscaux_versions_recu_id_version_key UNIQUE (recu_id, version);
alter table public.recus_fiscaux_versions add constraint recus_fiscaux_versions_version_check CHECK ((version >= 1));
alter table public.recus_lot_lignes add constraint recus_lot_lignes_lot_id_profil_participant_id_key UNIQUE (lot_id, profil_participant_id);
alter table public.recus_lot_lignes add constraint recus_lot_lignes_lot_id_rang_key UNIQUE (lot_id, rang);
alter table public.recus_lot_lignes add constraint recus_lot_lignes_pkey PRIMARY KEY (id);
alter table public.recus_lot_lignes add constraint recus_lot_lignes_statut_check CHECK ((statut = ANY (ARRAY['a_faire'::text, 'en_cours'::text, 'fait'::text, 'echec'::text, 'a_verifier'::text])));
alter table public.recus_lots add constraint recus_lots_pkey PRIMARY KEY (id);
alter table public.recus_lots add constraint recus_lots_statut_check CHECK ((statut = ANY (ARRAY['en_cours'::text, 'arrete'::text, 'termine'::text])));
alter table public.recus_lots add constraint recus_lots_type_check CHECK ((type = ANY (ARRAY['generation'::text, 'envoi'::text])));
alter table public.secrets_portefeuille add constraint secrets_portefeuille_pkey PRIMARY KEY (id);
alter table public.secrets_portefeuille add constraint secrets_portefeuille_secret_hash_check CHECK ((secret_hash ~ '^[0-9a-f]{64}$'::text));
alter table public.secrets_portefeuille add constraint secrets_portefeuille_secret_hash_key UNIQUE (secret_hash);
alter table public.signatures_adhesion add constraint signatures_adhesion_format_check CHECK (((signature_data_url ~~ 'data:image/png;base64,%'::text) AND (length(signature_data_url) <= 300000)));
alter table public.signatures_adhesion add constraint signatures_adhesion_pkey PRIMARY KEY (adhesion_id);
alter table public.templates_carte_adherent add constraint templates_carte_adherent_pkey PRIMARY KEY (id);
alter table public.templates_recu add constraint templates_recu_pkey PRIMARY KEY (id);
alter table public.templates_recu add constraint templates_recu_type_cerfa_check CHECK ((type_cerfa = ANY (ARRAY['11580'::text, '16216'::text])));
alter table public.acces_portefeuille_rate_limits add constraint acces_portefeuille_rate_limits_portefeuille_id_fkey FOREIGN KEY (portefeuille_id) REFERENCES portefeuilles(id) ON DELETE CASCADE;
alter table public.activites add constraint activites_organisation_id_fkey FOREIGN KEY (organisation_id) REFERENCES organisations(id) ON DELETE CASCADE;
alter table public.adherents add constraint adherents_organisation_id_fkey FOREIGN KEY (organisation_id) REFERENCES organisations(id) ON DELETE CASCADE;
alter table public.adhesions add constraint adhesions_adherent_id_fkey FOREIGN KEY (adherent_id) REFERENCES adherents(id) ON DELETE CASCADE;
alter table public.campagnes_courrier add constraint campagnes_courrier_activite_id_fkey FOREIGN KEY (activite_id) REFERENCES activites(id);
alter table public.campagnes_courrier_destinataires add constraint campagnes_courrier_destinataires_adherent_id_fkey FOREIGN KEY (adherent_id) REFERENCES adherents(id) ON DELETE CASCADE;
alter table public.campagnes_courrier_destinataires add constraint campagnes_courrier_destinataires_campagne_id_fkey FOREIGN KEY (campagne_id) REFERENCES campagnes_courrier(id) ON DELETE CASCADE;
alter table public.campagnes_courrier_destinataires add constraint campagnes_courrier_destinataires_organisation_id_fkey FOREIGN KEY (organisation_id) REFERENCES organisations(id) ON DELETE CASCADE;
alter table public.campagnes_courrier add constraint campagnes_courrier_genere_par_fkey FOREIGN KEY (genere_par) REFERENCES auth.users(id);
alter table public.campagnes_courrier add constraint campagnes_courrier_organisation_id_fkey FOREIGN KEY (organisation_id) REFERENCES organisations(id) ON DELETE CASCADE;
alter table public.campagnes_mailing_destinataires add constraint campagnes_mailing_destinataires_adherent_id_fkey FOREIGN KEY (adherent_id) REFERENCES adherents(id) ON DELETE CASCADE;
alter table public.campagnes_mailing_destinataires add constraint campagnes_mailing_destinataires_campagne_id_fkey FOREIGN KEY (campagne_id) REFERENCES campagnes_mailing(id) ON DELETE CASCADE;
alter table public.campagnes_mailing_destinataires add constraint campagnes_mailing_destinataires_organisation_id_fkey FOREIGN KEY (organisation_id) REFERENCES organisations(id) ON DELETE CASCADE;
alter table public.campagnes_mailing add constraint campagnes_mailing_envoye_par_fkey FOREIGN KEY (envoye_par) REFERENCES auth.users(id);
alter table public.campagnes_mailing add constraint campagnes_mailing_organisation_id_fkey FOREIGN KEY (organisation_id) REFERENCES organisations(id) ON DELETE CASCADE;
alter table public.commandes add constraint commandes_evenement_id_organisation_id_fkey FOREIGN KEY (evenement_id, organisation_id) REFERENCES evenements(id, organisation_id);
alter table public.commandes add constraint commandes_organisation_id_fkey FOREIGN KEY (organisation_id) REFERENCES organisations(id) ON DELETE CASCADE;
alter table public.commandes add constraint commandes_portefeuille_id_evenement_id_organisation_id_fkey FOREIGN KEY (portefeuille_id, evenement_id, organisation_id) REFERENCES portefeuilles(id, evenement_id, organisation_id);
alter table public.demandes_adhesion add constraint demandes_adhesion_adherent_id_fkey FOREIGN KEY (adherent_id) REFERENCES adherents(id) ON DELETE SET NULL;
alter table public.demandes_adhesion add constraint demandes_adhesion_adherent_vise_id_fkey FOREIGN KEY (adherent_vise_id) REFERENCES adherents(id) ON DELETE SET NULL;
alter table public.demandes_adhesion add constraint demandes_adhesion_decided_by_fkey FOREIGN KEY (decided_by) REFERENCES auth.users(id);
alter table public.demandes_adhesion add constraint demandes_adhesion_organisation_id_fkey FOREIGN KEY (organisation_id) REFERENCES organisations(id) ON DELETE CASCADE;
alter table public.demandes_inscription add constraint demandes_inscription_admin_utilisateur_id_fkey FOREIGN KEY (admin_utilisateur_id) REFERENCES auth.users(id) ON DELETE SET NULL;
alter table public.demandes_inscription add constraint demandes_inscription_organisation_id_fkey FOREIGN KEY (organisation_id) REFERENCES organisations(id) ON DELETE SET NULL;
alter table public.demandes_inscription add constraint demandes_inscription_traitee_par_fkey FOREIGN KEY (traitee_par) REFERENCES auth.users(id) ON DELETE SET NULL;
alter table public.demandes_paiement add constraint demandes_paiement_organisation_id_fkey FOREIGN KEY (organisation_id) REFERENCES organisations(id) ON DELETE CASCADE;
alter table public.demandes_paiement add constraint demandes_paiement_portefeuille_id_organisation_id_fkey FOREIGN KEY (portefeuille_id, organisation_id) REFERENCES portefeuilles(id, organisation_id);
alter table public.dons add constraint dons_activite_id_fkey FOREIGN KEY (activite_id) REFERENCES activites(id) ON DELETE SET NULL;
alter table public.dons add constraint dons_don_regulier_id_fkey FOREIGN KEY (don_regulier_id) REFERENCES dons_reguliers(id) ON DELETE SET NULL;
alter table public.dons_fichiers add constraint dons_fichiers_don_id_fkey FOREIGN KEY (don_id) REFERENCES dons(id) ON DELETE CASCADE;
alter table public.dons_fichiers add constraint dons_fichiers_organisation_id_fkey FOREIGN KEY (organisation_id) REFERENCES organisations(id) ON DELETE CASCADE;
alter table public.dons_fichiers add constraint dons_fichiers_uploaded_by_fkey FOREIGN KEY (uploaded_by) REFERENCES auth.users(id) ON DELETE SET NULL;
alter table public.dons add constraint dons_organisation_id_fkey FOREIGN KEY (organisation_id) REFERENCES organisations(id) ON DELETE CASCADE;
alter table public.dons add constraint dons_profil_participant_id_fkey FOREIGN KEY (profil_participant_id) REFERENCES profils_participant(id) ON DELETE CASCADE;
alter table public.dons_reguliers add constraint dons_reguliers_activite_id_fkey FOREIGN KEY (activite_id) REFERENCES activites(id) ON DELETE SET NULL;
alter table public.dons_reguliers add constraint dons_reguliers_organisation_id_fkey FOREIGN KEY (organisation_id) REFERENCES organisations(id) ON DELETE CASCADE;
alter table public.dons_reguliers add constraint dons_reguliers_profil_participant_id_fkey FOREIGN KEY (profil_participant_id) REFERENCES profils_participant(id) ON DELETE CASCADE;
alter table public.evenements add constraint evenements_activite_id_fkey FOREIGN KEY (activite_id) REFERENCES activites(id) ON DELETE SET NULL;
alter table public.evenements add constraint evenements_organisation_id_fkey FOREIGN KEY (organisation_id) REFERENCES organisations(id) ON DELETE CASCADE;
alter table public.journal_modifications add constraint journal_modifications_auteur_id_fkey FOREIGN KEY (auteur_id) REFERENCES auth.users(id);
alter table public.journal_modifications add constraint journal_modifications_organisation_id_fkey FOREIGN KEY (organisation_id) REFERENCES organisations(id) ON DELETE CASCADE;
alter table public.liens_renouvellement add constraint liens_renouvellement_adherent_id_fkey FOREIGN KEY (adherent_id) REFERENCES adherents(id) ON DELETE CASCADE;
alter table public.liens_renouvellement add constraint liens_renouvellement_organisation_id_fkey FOREIGN KEY (organisation_id) REFERENCES organisations(id) ON DELETE CASCADE;
alter table public.listes_diffusion add constraint listes_diffusion_organisation_id_fkey FOREIGN KEY (organisation_id) REFERENCES organisations(id) ON DELETE CASCADE;
alter table public.mailing_templates add constraint mailing_templates_organisation_id_fkey FOREIGN KEY (organisation_id) REFERENCES organisations(id) ON DELETE CASCADE;
alter table public.mouvements_portefeuille add constraint mouvements_portefeuille_commande_id_portefeuille_id_organi_fkey FOREIGN KEY (commande_id, portefeuille_id, organisation_id) REFERENCES commandes(id, portefeuille_id, organisation_id);
alter table public.mouvements_portefeuille add constraint mouvements_portefeuille_demande_paiement_id_portefeuille_i_fkey FOREIGN KEY (demande_paiement_id, portefeuille_id, organisation_id) REFERENCES demandes_paiement(id, portefeuille_id, organisation_id);
alter table public.mouvements_portefeuille add constraint mouvements_portefeuille_organisation_id_fkey FOREIGN KEY (organisation_id) REFERENCES organisations(id) ON DELETE CASCADE;
alter table public.mouvements_portefeuille add constraint mouvements_portefeuille_portefeuille_id_organisation_id_fkey FOREIGN KEY (portefeuille_id, organisation_id) REFERENCES portefeuilles(id, organisation_id);
alter table public.organisation_assets add constraint organisation_assets_organisation_id_fkey FOREIGN KEY (organisation_id) REFERENCES organisations(id) ON DELETE CASCADE;
alter table public.organisation_secrets add constraint organisation_secrets_organisation_id_fkey FOREIGN KEY (organisation_id) REFERENCES organisations(id) ON DELETE CASCADE;
alter table public.organisations add constraint organisations_logo_asset_id_fkey FOREIGN KEY (logo_asset_id) REFERENCES organisation_assets(id) ON DELETE SET NULL;
alter table public.portefeuilles add constraint portefeuilles_evenement_id_organisation_id_fkey FOREIGN KEY (evenement_id, organisation_id) REFERENCES evenements(id, organisation_id);
alter table public.portefeuilles add constraint portefeuilles_organisation_id_fkey FOREIGN KEY (organisation_id) REFERENCES organisations(id) ON DELETE CASCADE;
alter table public.profils_organisation add constraint profils_organisation_organisation_id_fkey FOREIGN KEY (organisation_id) REFERENCES organisations(id) ON DELETE CASCADE;
alter table public.profils_organisation add constraint profils_organisation_utilisateur_id_fkey FOREIGN KEY (utilisateur_id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table public.profils_participant add constraint profils_participant_organisation_id_fkey FOREIGN KEY (organisation_id) REFERENCES organisations(id) ON DELETE CASCADE;
alter table public.profils_participant add constraint profils_participant_personne_id_fkey FOREIGN KEY (personne_id) REFERENCES personnes(id) ON DELETE CASCADE;
alter table public.recus_fiscaux add constraint recus_fiscaux_organisation_id_fkey FOREIGN KEY (organisation_id) REFERENCES organisations(id) ON DELETE CASCADE;
alter table public.recus_fiscaux add constraint recus_fiscaux_profil_participant_id_fkey FOREIGN KEY (profil_participant_id) REFERENCES profils_participant(id) ON DELETE CASCADE;
alter table public.recus_fiscaux add constraint recus_fiscaux_template_id_fkey FOREIGN KEY (template_id) REFERENCES templates_recu(id) ON DELETE SET NULL;
alter table public.recus_fiscaux_versions add constraint recus_fiscaux_versions_organisation_id_fkey FOREIGN KEY (organisation_id) REFERENCES organisations(id) ON DELETE CASCADE;
alter table public.recus_fiscaux_versions add constraint recus_fiscaux_versions_recu_id_fkey FOREIGN KEY (recu_id) REFERENCES recus_fiscaux(id) ON DELETE CASCADE;
alter table public.recus_lot_lignes add constraint recus_lot_lignes_lot_id_fkey FOREIGN KEY (lot_id) REFERENCES recus_lots(id) ON DELETE CASCADE;
alter table public.recus_lot_lignes add constraint recus_lot_lignes_organisation_id_fkey FOREIGN KEY (organisation_id) REFERENCES organisations(id) ON DELETE CASCADE;
alter table public.recus_lot_lignes add constraint recus_lot_lignes_profil_participant_id_fkey FOREIGN KEY (profil_participant_id) REFERENCES profils_participant(id) ON DELETE CASCADE;
alter table public.recus_lot_lignes add constraint recus_lot_lignes_recu_id_fkey FOREIGN KEY (recu_id) REFERENCES recus_fiscaux(id) ON DELETE SET NULL;
alter table public.recus_lot_lignes add constraint recus_lot_lignes_version_id_fkey FOREIGN KEY (version_id) REFERENCES recus_fiscaux_versions(id);
alter table public.recus_lots add constraint recus_lots_organisation_id_fkey FOREIGN KEY (organisation_id) REFERENCES organisations(id) ON DELETE CASCADE;
alter table public.secrets_portefeuille add constraint secrets_portefeuille_organisation_id_fkey FOREIGN KEY (organisation_id) REFERENCES organisations(id) ON DELETE CASCADE;
alter table public.secrets_portefeuille add constraint secrets_portefeuille_portefeuille_id_organisation_id_fkey FOREIGN KEY (portefeuille_id, organisation_id) REFERENCES portefeuilles(id, organisation_id);
alter table public.signatures_adhesion add constraint signatures_adhesion_adhesion_id_fkey FOREIGN KEY (adhesion_id) REFERENCES adhesions(id) ON DELETE CASCADE;
alter table public.signatures_adhesion add constraint signatures_adhesion_organisation_id_fkey FOREIGN KEY (organisation_id) REFERENCES organisations(id) ON DELETE CASCADE;
alter table public.templates_carte_adherent add constraint templates_carte_adherent_organisation_id_fkey FOREIGN KEY (organisation_id) REFERENCES organisations(id) ON DELETE CASCADE;
alter table public.templates_recu add constraint templates_recu_organisation_id_fkey FOREIGN KEY (organisation_id) REFERENCES organisations(id) ON DELETE CASCADE;
CREATE UNIQUE INDEX demandes_inscription_confirmation_jeton ON public.demandes_inscription USING btree (confirmation_jeton_hash) WHERE (confirmation_jeton_hash IS NOT NULL);
CREATE UNIQUE INDEX demandes_inscription_email_active ON public.demandes_inscription USING btree (email) WHERE (statut = ANY (ARRAY['a_confirmer'::text, 'en_attente'::text]));
CREATE INDEX demandes_inscription_statut_created ON public.demandes_inscription USING btree (statut, created_at DESC);
CREATE INDEX idx_acces_portefeuille_rate_limits_ip ON public.acces_portefeuille_rate_limits USING btree (scope, ip_hash, created_at DESC);
CREATE INDEX idx_acces_portefeuille_rate_limits_wallet ON public.acces_portefeuille_rate_limits USING btree (scope, portefeuille_id, created_at DESC) WHERE (portefeuille_id IS NOT NULL);
CREATE UNIQUE INDEX idx_adherents_mailing_unsubscribe_token ON public.adherents USING btree (mailing_unsubscribe_token);
CREATE INDEX idx_adherents_nom_prenom ON public.adherents USING gin ((((nom || ' '::text) || COALESCE(prenom, ''::text))) gin_trgm_ops);
CREATE INDEX idx_adherents_organisation_id ON public.adherents USING btree (organisation_id);
CREATE INDEX idx_adherents_statut ON public.adherents USING btree (organisation_id, statut);
CREATE INDEX idx_adherents_tags ON public.adherents USING gin (tags);
CREATE INDEX idx_adhesions_adherent_id ON public.adhesions USING btree (adherent_id);
CREATE INDEX idx_adhesions_date_fin ON public.adhesions USING btree (date_fin);
CREATE INDEX idx_campagnes_courrier_destinataires_adherent ON public.campagnes_courrier_destinataires USING btree (adherent_id);
CREATE INDEX idx_campagnes_courrier_destinataires_campagne ON public.campagnes_courrier_destinataires USING btree (campagne_id, statut, nom);
CREATE INDEX idx_campagnes_courrier_organisation_id ON public.campagnes_courrier USING btree (organisation_id, created_at DESC);
CREATE INDEX idx_campagnes_mailing_destinataires_adherent ON public.campagnes_mailing_destinataires USING btree (adherent_id);
CREATE INDEX idx_campagnes_mailing_destinataires_campagne ON public.campagnes_mailing_destinataires USING btree (campagne_id, statut, nom);
CREATE INDEX idx_campagnes_mailing_organisation_id ON public.campagnes_mailing USING btree (organisation_id, created_at DESC);
CREATE INDEX idx_commandes_evenement_statut ON public.commandes USING btree (evenement_id, statut);
CREATE INDEX idx_commandes_organisation ON public.commandes USING btree (organisation_id);
CREATE INDEX idx_commandes_portefeuille ON public.commandes USING btree (portefeuille_id);
CREATE INDEX idx_demandes_adhesion_organisation_id ON public.demandes_adhesion USING btree (organisation_id);
CREATE INDEX idx_demandes_adhesion_statut ON public.demandes_adhesion USING btree (organisation_id, statut);
CREATE UNIQUE INDEX idx_demandes_paiement_attente ON public.demandes_paiement USING btree (portefeuille_id) WHERE (statut = 'en_attente'::text);
CREATE INDEX idx_demandes_paiement_organisation ON public.demandes_paiement USING btree (organisation_id);
CREATE INDEX idx_demandes_paiement_portefeuille_statut ON public.demandes_paiement USING btree (portefeuille_id, statut);
CREATE INDEX idx_dons_date ON public.dons USING btree (date);
CREATE INDEX idx_dons_don_regulier ON public.dons USING btree (don_regulier_id);
CREATE INDEX idx_dons_fichiers_don ON public.dons_fichiers USING btree (don_id);
CREATE INDEX idx_dons_fichiers_organisation ON public.dons_fichiers USING btree (organisation_id);
CREATE INDEX idx_dons_organisation ON public.dons USING btree (organisation_id);
CREATE INDEX idx_dons_profil_participant ON public.dons USING btree (profil_participant_id);
CREATE INDEX idx_dons_reguliers_organisation ON public.dons_reguliers USING btree (organisation_id);
CREATE INDEX idx_evenements_activite_id ON public.evenements USING btree (activite_id);
CREATE INDEX idx_evenements_organisation ON public.evenements USING btree (organisation_id);
CREATE INDEX idx_journal_modifications_ligne ON public.journal_modifications USING btree (table_cible, ligne_id);
CREATE INDEX idx_journal_modifications_organisation_id ON public.journal_modifications USING btree (organisation_id, created_at DESC);
CREATE INDEX idx_liens_renouvellement_adherent_actif ON public.liens_renouvellement USING btree (adherent_id) WHERE ((revoque_le IS NULL) AND (utilise_le IS NULL));
CREATE INDEX idx_liens_renouvellement_organisation ON public.liens_renouvellement USING btree (organisation_id);
CREATE INDEX idx_listes_diffusion_organisation_id ON public.listes_diffusion USING btree (organisation_id);
CREATE INDEX idx_mailing_templates_organisation_id ON public.mailing_templates USING btree (organisation_id);
CREATE INDEX idx_mouvements_portefeuille_organisation ON public.mouvements_portefeuille USING btree (organisation_id);
CREATE INDEX idx_mouvements_portefeuille_portefeuille ON public.mouvements_portefeuille USING btree (portefeuille_id);
CREATE UNIQUE INDEX idx_portefeuilles_evenement_email ON public.portefeuilles USING btree (evenement_id, lower(email));
CREATE INDEX idx_portefeuilles_organisation ON public.portefeuilles USING btree (organisation_id);
CREATE INDEX idx_profils_participant_id_externe ON public.profils_participant USING btree (id_externe);
CREATE INDEX idx_recus_organisation ON public.recus_fiscaux USING btree (organisation_id);
CREATE INDEX idx_secrets_portefeuille_organisation ON public.secrets_portefeuille USING btree (organisation_id);
CREATE INDEX idx_secrets_portefeuille_portefeuille ON public.secrets_portefeuille USING btree (portefeuille_id);
CREATE INDEX idx_signatures_adhesion_organisation_id ON public.signatures_adhesion USING btree (organisation_id);
CREATE UNIQUE INDEX idx_templates_carte_adherent_active ON public.templates_carte_adherent USING btree (organisation_id) WHERE ((is_active = true) AND (is_archived = false));
CREATE UNIQUE INDEX idx_templates_recu_active ON public.templates_recu USING btree (organisation_id, type_cerfa) WHERE ((is_active = true) AND (is_archived = false));
CREATE UNIQUE INDEX recus_fiscaux_organisation_numero_ordre_key ON public.recus_fiscaux USING btree (organisation_id, numero_ordre) WHERE (numero_ordre IS NOT NULL);
CREATE INDEX recus_fiscaux_versions_envois_idx ON public.recus_fiscaux_versions USING btree (organisation_id, email_envoye_le) WHERE (email_envoye_le IS NOT NULL);
CREATE INDEX recus_fiscaux_versions_organisation_idx ON public.recus_fiscaux_versions USING btree (organisation_id);
CREATE INDEX recus_lot_lignes_a_traiter_idx ON public.recus_lot_lignes USING btree (lot_id, rang) WHERE (statut = ANY (ARRAY['a_faire'::text, 'en_cours'::text]));
CREATE INDEX recus_lot_lignes_a_verifier_idx ON public.recus_lot_lignes USING btree (organisation_id, modifie_le) WHERE (statut = 'a_verifier'::text);
CREATE INDEX recus_lots_organisation_idx ON public.recus_lots USING btree (organisation_id, annee, cree_le DESC);
CREATE UNIQUE INDEX recus_lots_un_en_cours ON public.recus_lots USING btree (organisation_id, annee, type) WHERE (statut = 'en_cours'::text);
CREATE UNIQUE INDEX uq_demandes_adhesion_renouvellement_en_attente ON public.demandes_adhesion USING btree (adherent_vise_id) WHERE ((type = 'renouvellement'::text) AND (statut = 'en_attente'::text));
CREATE TRIGGER organisations_verifier_logo BEFORE INSERT OR UPDATE OF logo_asset_id ON public.organisations FOR EACH ROW EXECUTE FUNCTION organisations_verifier_logo();
CREATE TRIGGER profils_participant_attribuer_id_externe BEFORE INSERT ON public.profils_participant FOR EACH ROW EXECUTE FUNCTION profils_participant_attribuer_id_externe();
CREATE TRIGGER recus_fiscaux_verrou_identite BEFORE UPDATE ON public.recus_fiscaux FOR EACH ROW EXECUTE FUNCTION recus_fiscaux_verrou_identite();
CREATE TRIGGER recus_fiscaux_versions_immuables BEFORE DELETE OR UPDATE ON public.recus_fiscaux_versions FOR EACH ROW EXECUTE FUNCTION recus_fiscaux_versions_immuables();
CREATE TRIGGER recus_fiscaux_versions_immuables_truncate BEFORE TRUNCATE ON public.recus_fiscaux_versions FOR EACH STATEMENT EXECUTE FUNCTION recus_fiscaux_versions_immuables();
CREATE TRIGGER trg_adherents_reset_email_invalide BEFORE UPDATE OF courriel ON public.adherents FOR EACH ROW EXECUTE FUNCTION reset_adherent_email_invalide();
CREATE TRIGGER trg_adherents_sync_listes_diffusion AFTER INSERT OR UPDATE OF tags ON public.adherents FOR EACH ROW EXECUTE FUNCTION sync_listes_diffusion_from_tags();
CREATE TRIGGER trg_adherents_updated_at BEFORE UPDATE ON public.adherents FOR EACH ROW EXECUTE FUNCTION set_updated_at_adherents();
CREATE TRIGGER trg_adhesions_poser_date_fin BEFORE INSERT OR UPDATE OF date_debut ON public.adhesions FOR EACH ROW EXECUTE FUNCTION adhesions_poser_date_fin();
CREATE TRIGGER trg_commandes_updated_at BEFORE UPDATE ON public.commandes FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_demandes_adhesion_adherent_vise BEFORE INSERT OR UPDATE OF adherent_vise_id, organisation_id ON public.demandes_adhesion FOR EACH ROW EXECUTE FUNCTION demandes_adhesion_verifier_adherent_vise();
CREATE TRIGGER trg_demandes_paiement_broadcast_acheteur AFTER INSERT OR UPDATE OF statut ON public.demandes_paiement FOR EACH ROW EXECUTE FUNCTION broadcast_portefeuille_payment_wakeup();
CREATE TRIGGER trg_demandes_paiement_updated_at BEFORE UPDATE ON public.demandes_paiement FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_dons_reguliers_updated_at BEFORE UPDATE ON public.dons_reguliers FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_dons_updated_at BEFORE UPDATE ON public.dons FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_evenements_organisation_immuable BEFORE UPDATE ON public.evenements FOR EACH ROW EXECUTE FUNCTION evenements_organisation_immuable();
CREATE TRIGGER trg_evenements_updated_at BEFORE UPDATE ON public.evenements FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_liens_renouvellement_organisation BEFORE INSERT OR UPDATE OF adherent_id, organisation_id ON public.liens_renouvellement FOR EACH ROW EXECUTE FUNCTION liens_renouvellement_verifier_organisation();
CREATE TRIGGER trg_mouvements_portefeuille_immuables BEFORE DELETE OR UPDATE ON public.mouvements_portefeuille FOR EACH ROW EXECUTE FUNCTION mouvements_portefeuille_immuables();
CREATE TRIGGER trg_mouvements_portefeuille_non_anonymise BEFORE INSERT ON public.mouvements_portefeuille FOR EACH ROW EXECUTE FUNCTION portefeuille_non_anonymise();
CREATE TRIGGER trg_organisations_creer_secrets AFTER INSERT ON public.organisations FOR EACH ROW EXECUTE FUNCTION creer_secrets_organisation();
CREATE TRIGGER trg_organisations_fonctionnalites_super_admin BEFORE UPDATE ON public.organisations FOR EACH ROW EXECUTE FUNCTION organisations_fonctionnalites_super_admin();
CREATE TRIGGER trg_organisations_reevaluer_attente_lots_envoi AFTER UPDATE OF modele_recu_pdf ON public.organisations FOR EACH ROW EXECUTE FUNCTION reevaluer_attente_lots_envoi_recus();
CREATE TRIGGER trg_organisations_updated_at BEFORE UPDATE ON public.organisations FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_personnes_reset_email_invalide AFTER UPDATE OF email ON public.personnes FOR EACH ROW EXECUTE FUNCTION reset_profil_email_invalide();
CREATE TRIGGER trg_personnes_updated_at BEFORE UPDATE ON public.personnes FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_portefeuilles_anonymise_fige BEFORE UPDATE ON public.portefeuilles FOR EACH ROW EXECUTE FUNCTION portefeuilles_anonymise_fige();
CREATE TRIGGER trg_portefeuilles_updated_at BEFORE UPDATE ON public.portefeuilles FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_profils_organisation_tampering BEFORE UPDATE ON public.profils_organisation FOR EACH ROW EXECUTE FUNCTION prevent_profils_organisation_tampering();
CREATE TRIGGER trg_secrets_portefeuille_non_anonymise BEFORE INSERT ON public.secrets_portefeuille FOR EACH ROW EXECUTE FUNCTION portefeuille_non_anonymise();
CREATE TRIGGER trg_secrets_portefeuille_updated_at BEFORE UPDATE ON public.secrets_portefeuille FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_templates_carte_adherent_updated_at BEFORE UPDATE ON public.templates_carte_adherent FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_templates_recu_updated_at BEFORE UPDATE ON public.templates_recu FOR EACH ROW EXECUTE FUNCTION set_updated_at();
alter table public.acces_portefeuille_rate_limits enable row level security;
alter table public.activites enable row level security;
alter table public.adherents enable row level security;
alter table public.adhesions enable row level security;
alter table public.campagnes_courrier enable row level security;
alter table public.campagnes_courrier_destinataires enable row level security;
alter table public.campagnes_mailing enable row level security;
alter table public.campagnes_mailing_destinataires enable row level security;
alter table public.commandes enable row level security;
alter table public.coupon_transport_spike enable row level security;
alter table public.demandes_adhesion enable row level security;
alter table public.demandes_inscription enable row level security;
alter table public.demandes_paiement enable row level security;
alter table public.dons enable row level security;
alter table public.dons_fichiers enable row level security;
alter table public.dons_reguliers enable row level security;
alter table public.evenements enable row level security;
alter table public.journal_modifications enable row level security;
alter table public.liens_renouvellement enable row level security;
alter table public.listes_diffusion enable row level security;
alter table public.mailing_templates enable row level security;
alter table public.mouvements_portefeuille enable row level security;
alter table public.organisation_assets enable row level security;
alter table public.organisation_secrets enable row level security;
alter table public.organisations enable row level security;
alter table public.personnes enable row level security;
alter table public.portefeuilles enable row level security;
alter table public.profils_organisation enable row level security;
alter table public.profils_participant enable row level security;
alter table public.recus_fiscaux enable row level security;
alter table public.recus_fiscaux_versions enable row level security;
alter table public.recus_lot_lignes enable row level security;
alter table public.recus_lots enable row level security;
alter table public.secrets_portefeuille enable row level security;
alter table public.signatures_adhesion enable row level security;
alter table public.templates_carte_adherent enable row level security;
alter table public.templates_recu enable row level security;
create policy activites_select on public.activites as PERMISSIVE for SELECT to public using ((((((( SELECT auth.jwt() AS jwt) -> 'app_metadata'::text) ->> 'is_super_admin'::text))::boolean = true) OR (organisation_id = ( SELECT current_effective_organisation_id() AS current_effective_organisation_id))));
create policy activites_write_admin on public.activites as PERMISSIVE for ALL to public using (((organisation_id = current_user_organisation_id()) OR ((((auth.jwt() -> 'app_metadata'::text) ->> 'is_super_admin'::text))::boolean = true))) with check (((organisation_id = current_user_organisation_id()) OR ((((auth.jwt() -> 'app_metadata'::text) ->> 'is_super_admin'::text))::boolean = true)));
create policy adherents_delete on public.adherents as PERMISSIVE for DELETE to public using (((organisation_id = ( SELECT current_user_organisation_id() AS current_user_organisation_id)) OR ((((( SELECT auth.jwt() AS jwt) -> 'app_metadata'::text) ->> 'is_super_admin'::text))::boolean = true)));
create policy adherents_insert on public.adherents as PERMISSIVE for INSERT to public with check (((organisation_id = ( SELECT current_user_organisation_id() AS current_user_organisation_id)) OR ((((( SELECT auth.jwt() AS jwt) -> 'app_metadata'::text) ->> 'is_super_admin'::text))::boolean = true)));
create policy adherents_select on public.adherents as PERMISSIVE for SELECT to public using (((organisation_id = ( SELECT current_user_organisation_id() AS current_user_organisation_id)) OR ((((( SELECT auth.jwt() AS jwt) -> 'app_metadata'::text) ->> 'is_super_admin'::text))::boolean = true)));
create policy adherents_update on public.adherents as PERMISSIVE for UPDATE to public using (((organisation_id = ( SELECT current_user_organisation_id() AS current_user_organisation_id)) OR ((((( SELECT auth.jwt() AS jwt) -> 'app_metadata'::text) ->> 'is_super_admin'::text))::boolean = true))) with check (((organisation_id = ( SELECT current_user_organisation_id() AS current_user_organisation_id)) OR ((((( SELECT auth.jwt() AS jwt) -> 'app_metadata'::text) ->> 'is_super_admin'::text))::boolean = true)));
create policy adhesions_delete on public.adhesions as PERMISSIVE for DELETE to public using ((EXISTS ( SELECT 1
   FROM adherents a
  WHERE ((a.id = adhesions.adherent_id) AND ((a.organisation_id = ( SELECT current_user_organisation_id() AS current_user_organisation_id)) OR ((((( SELECT auth.jwt() AS jwt) -> 'app_metadata'::text) ->> 'is_super_admin'::text))::boolean = true))))));
create policy adhesions_insert on public.adhesions as PERMISSIVE for INSERT to public with check ((EXISTS ( SELECT 1
   FROM adherents a
  WHERE ((a.id = adhesions.adherent_id) AND ((a.organisation_id = ( SELECT current_user_organisation_id() AS current_user_organisation_id)) OR ((((( SELECT auth.jwt() AS jwt) -> 'app_metadata'::text) ->> 'is_super_admin'::text))::boolean = true))))));
create policy adhesions_select on public.adhesions as PERMISSIVE for SELECT to public using ((EXISTS ( SELECT 1
   FROM adherents a
  WHERE ((a.id = adhesions.adherent_id) AND ((a.organisation_id = ( SELECT current_user_organisation_id() AS current_user_organisation_id)) OR ((((( SELECT auth.jwt() AS jwt) -> 'app_metadata'::text) ->> 'is_super_admin'::text))::boolean = true))))));
create policy adhesions_update on public.adhesions as PERMISSIVE for UPDATE to public using ((EXISTS ( SELECT 1
   FROM adherents a
  WHERE ((a.id = adhesions.adherent_id) AND ((a.organisation_id = ( SELECT current_user_organisation_id() AS current_user_organisation_id)) OR ((((( SELECT auth.jwt() AS jwt) -> 'app_metadata'::text) ->> 'is_super_admin'::text))::boolean = true)))))) with check ((EXISTS ( SELECT 1
   FROM adherents a
  WHERE ((a.id = adhesions.adherent_id) AND ((a.organisation_id = ( SELECT current_user_organisation_id() AS current_user_organisation_id)) OR ((((( SELECT auth.jwt() AS jwt) -> 'app_metadata'::text) ->> 'is_super_admin'::text))::boolean = true))))));
create policy campagnes_courrier_destinataires_select on public.campagnes_courrier_destinataires as PERMISSIVE for SELECT to authenticated using (((organisation_id = ( SELECT current_user_organisation_id() AS current_user_organisation_id)) OR ((((( SELECT auth.jwt() AS jwt) -> 'app_metadata'::text) ->> 'is_super_admin'::text))::boolean = true)));
create policy campagnes_courrier_select on public.campagnes_courrier as PERMISSIVE for SELECT to authenticated using (((organisation_id = ( SELECT current_user_organisation_id() AS current_user_organisation_id)) OR ((((( SELECT auth.jwt() AS jwt) -> 'app_metadata'::text) ->> 'is_super_admin'::text))::boolean = true)));
create policy campagnes_mailing_destinataires_select on public.campagnes_mailing_destinataires as PERMISSIVE for SELECT to authenticated using (((organisation_id = ( SELECT current_user_organisation_id() AS current_user_organisation_id)) OR ((((( SELECT auth.jwt() AS jwt) -> 'app_metadata'::text) ->> 'is_super_admin'::text))::boolean = true)));
create policy campagnes_mailing_select on public.campagnes_mailing as PERMISSIVE for SELECT to authenticated using (((organisation_id = ( SELECT current_user_organisation_id() AS current_user_organisation_id)) OR ((((( SELECT auth.jwt() AS jwt) -> 'app_metadata'::text) ->> 'is_super_admin'::text))::boolean = true)));
create policy commandes_select on public.commandes as PERMISSIVE for SELECT to authenticated using ((((((( SELECT auth.jwt() AS jwt) -> 'app_metadata'::text) ->> 'is_super_admin'::text))::boolean = true) OR (organisation_id = ( SELECT current_user_organisation_id() AS current_user_organisation_id))));
create policy demandes_adhesion_select on public.demandes_adhesion as PERMISSIVE for SELECT to authenticated using (((organisation_id = ( SELECT current_user_organisation_id() AS current_user_organisation_id)) OR ((((( SELECT auth.jwt() AS jwt) -> 'app_metadata'::text) ->> 'is_super_admin'::text))::boolean = true)));
create policy demandes_adhesion_update on public.demandes_adhesion as PERMISSIVE for UPDATE to authenticated using (((organisation_id = ( SELECT current_user_organisation_id() AS current_user_organisation_id)) OR ((((( SELECT auth.jwt() AS jwt) -> 'app_metadata'::text) ->> 'is_super_admin'::text))::boolean = true))) with check (((organisation_id = ( SELECT current_user_organisation_id() AS current_user_organisation_id)) OR ((((( SELECT auth.jwt() AS jwt) -> 'app_metadata'::text) ->> 'is_super_admin'::text))::boolean = true)));
create policy demandes_inscription_delete_super_admin on public.demandes_inscription as PERMISSIVE for DELETE to authenticated using (COALESCE(is_current_user_super_admin(), false));
create policy demandes_inscription_select_super_admin on public.demandes_inscription as PERMISSIVE for SELECT to authenticated using ((COALESCE(is_current_user_super_admin(), false) AND (statut <> 'a_confirmer'::text)));
create policy demandes_inscription_update_super_admin on public.demandes_inscription as PERMISSIVE for UPDATE to authenticated using ((COALESCE(is_current_user_super_admin(), false) AND (statut = 'en_attente'::text))) with check ((COALESCE(is_current_user_super_admin(), false) AND (statut = 'refusee'::text)));
create policy demandes_paiement_benevole_select on public.demandes_paiement as PERMISSIVE for SELECT to authenticated using ((((((( SELECT auth.jwt() AS jwt) -> 'app_metadata'::text) ->> 'is_super_admin'::text))::boolean = true) OR (organisation_id = ( SELECT current_benevole_organisation_id() AS current_benevole_organisation_id)) OR (organisation_id = ( SELECT current_vendeur_organisation_id() AS current_vendeur_organisation_id))));
create policy demandes_paiement_select on public.demandes_paiement as PERMISSIVE for SELECT to authenticated using ((((((( SELECT auth.jwt() AS jwt) -> 'app_metadata'::text) ->> 'is_super_admin'::text))::boolean = true) OR (organisation_id = ( SELECT current_user_organisation_id() AS current_user_organisation_id))));
create policy dons_delete_admin on public.dons as PERMISSIVE for DELETE to public using ((((((( SELECT auth.jwt() AS jwt) -> 'app_metadata'::text) ->> 'is_super_admin'::text))::boolean = true) OR (organisation_id = ( SELECT current_user_organisation_id() AS current_user_organisation_id))));
create policy dons_fichiers_delete_admin on public.dons_fichiers as PERMISSIVE for DELETE to public using ((((((auth.jwt() -> 'app_metadata'::text) ->> 'is_super_admin'::text))::boolean = true) OR (organisation_id = current_user_organisation_id())));
create policy dons_fichiers_insert on public.dons_fichiers as PERMISSIVE for INSERT to public with check ((((((auth.jwt() -> 'app_metadata'::text) ->> 'is_super_admin'::text))::boolean = true) OR (organisation_id = current_effective_organisation_id())));
create policy dons_fichiers_select on public.dons_fichiers as PERMISSIVE for SELECT to public using ((((((auth.jwt() -> 'app_metadata'::text) ->> 'is_super_admin'::text))::boolean = true) OR (organisation_id = current_effective_organisation_id())));
create policy dons_insert on public.dons as PERMISSIVE for INSERT to public with check ((((((( SELECT auth.jwt() AS jwt) -> 'app_metadata'::text) ->> 'is_super_admin'::text))::boolean = true) OR (organisation_id = ( SELECT current_effective_organisation_id() AS current_effective_organisation_id))));
create policy dons_reguliers_delete on public.dons_reguliers as PERMISSIVE for DELETE to public using ((((((( SELECT auth.jwt() AS jwt) -> 'app_metadata'::text) ->> 'is_super_admin'::text))::boolean = true) OR (organisation_id = ( SELECT current_user_organisation_id() AS current_user_organisation_id))));
create policy dons_reguliers_insert on public.dons_reguliers as PERMISSIVE for INSERT to public with check ((((((( SELECT auth.jwt() AS jwt) -> 'app_metadata'::text) ->> 'is_super_admin'::text))::boolean = true) OR (organisation_id = ( SELECT current_user_organisation_id() AS current_user_organisation_id))));
create policy dons_reguliers_select on public.dons_reguliers as PERMISSIVE for SELECT to public using ((((((( SELECT auth.jwt() AS jwt) -> 'app_metadata'::text) ->> 'is_super_admin'::text))::boolean = true) OR (organisation_id = ( SELECT current_user_organisation_id() AS current_user_organisation_id))));
create policy dons_reguliers_update on public.dons_reguliers as PERMISSIVE for UPDATE to public using ((((((( SELECT auth.jwt() AS jwt) -> 'app_metadata'::text) ->> 'is_super_admin'::text))::boolean = true) OR (organisation_id = ( SELECT current_user_organisation_id() AS current_user_organisation_id))));
create policy dons_select_admin on public.dons as PERMISSIVE for SELECT to public using ((((((( SELECT auth.jwt() AS jwt) -> 'app_metadata'::text) ->> 'is_super_admin'::text))::boolean = true) OR (organisation_id = ( SELECT current_user_organisation_id() AS current_user_organisation_id))));
create policy dons_update_admin on public.dons as PERMISSIVE for UPDATE to public using ((((((( SELECT auth.jwt() AS jwt) -> 'app_metadata'::text) ->> 'is_super_admin'::text))::boolean = true) OR (organisation_id = ( SELECT current_user_organisation_id() AS current_user_organisation_id))));
create policy evenements_benevole_select on public.evenements as PERMISSIVE for SELECT to authenticated using ((((((( SELECT auth.jwt() AS jwt) -> 'app_metadata'::text) ->> 'is_super_admin'::text))::boolean = true) OR ((organisation_id = ( SELECT current_benevole_organisation_id() AS current_benevole_organisation_id)) AND (statut <> 'brouillon'::text)) OR ((organisation_id = ( SELECT current_vendeur_organisation_id() AS current_vendeur_organisation_id)) AND (statut <> 'brouillon'::text))));
create policy evenements_delete on public.evenements as PERMISSIVE for DELETE to authenticated using ((((((( SELECT auth.jwt() AS jwt) -> 'app_metadata'::text) ->> 'is_super_admin'::text))::boolean = true) OR (organisation_id = ( SELECT current_user_organisation_id() AS current_user_organisation_id))));
create policy evenements_insert on public.evenements as PERMISSIVE for INSERT to authenticated with check ((((((( SELECT auth.jwt() AS jwt) -> 'app_metadata'::text) ->> 'is_super_admin'::text))::boolean = true) OR (organisation_id = ( SELECT current_user_organisation_id() AS current_user_organisation_id))));
create policy evenements_select on public.evenements as PERMISSIVE for SELECT to authenticated using ((((((( SELECT auth.jwt() AS jwt) -> 'app_metadata'::text) ->> 'is_super_admin'::text))::boolean = true) OR (organisation_id = ( SELECT current_user_organisation_id() AS current_user_organisation_id))));
create policy evenements_update on public.evenements as PERMISSIVE for UPDATE to authenticated using ((((((( SELECT auth.jwt() AS jwt) -> 'app_metadata'::text) ->> 'is_super_admin'::text))::boolean = true) OR (organisation_id = ( SELECT current_user_organisation_id() AS current_user_organisation_id)))) with check ((((((( SELECT auth.jwt() AS jwt) -> 'app_metadata'::text) ->> 'is_super_admin'::text))::boolean = true) OR (organisation_id = ( SELECT current_user_organisation_id() AS current_user_organisation_id))));
create policy journal_modifications_insert on public.journal_modifications as PERMISSIVE for INSERT to authenticated with check (((organisation_id = ( SELECT current_user_organisation_id() AS current_user_organisation_id)) OR ((((( SELECT auth.jwt() AS jwt) -> 'app_metadata'::text) ->> 'is_super_admin'::text))::boolean = true)));
create policy journal_modifications_select on public.journal_modifications as PERMISSIVE for SELECT to authenticated using (((organisation_id = ( SELECT current_user_organisation_id() AS current_user_organisation_id)) OR ((((( SELECT auth.jwt() AS jwt) -> 'app_metadata'::text) ->> 'is_super_admin'::text))::boolean = true)));
create policy liens_renouvellement_delete on public.liens_renouvellement as PERMISSIVE for DELETE to authenticated using (COALESCE((((( SELECT auth.jwt() AS jwt) -> 'app_metadata'::text) ->> 'is_super_admin'::text))::boolean, false));
create policy liens_renouvellement_insert on public.liens_renouvellement as PERMISSIVE for INSERT to authenticated with check (COALESCE((((( SELECT auth.jwt() AS jwt) -> 'app_metadata'::text) ->> 'is_super_admin'::text))::boolean, false));
create policy liens_renouvellement_select on public.liens_renouvellement as PERMISSIVE for SELECT to authenticated using ((((((( SELECT auth.jwt() AS jwt) -> 'app_metadata'::text) ->> 'is_super_admin'::text))::boolean = true) OR (organisation_id = ( SELECT current_user_organisation_id() AS current_user_organisation_id))));
create policy liens_renouvellement_update on public.liens_renouvellement as PERMISSIVE for UPDATE to authenticated using (COALESCE((((( SELECT auth.jwt() AS jwt) -> 'app_metadata'::text) ->> 'is_super_admin'::text))::boolean, false)) with check (COALESCE((((( SELECT auth.jwt() AS jwt) -> 'app_metadata'::text) ->> 'is_super_admin'::text))::boolean, false));
create policy listes_diffusion_delete on public.listes_diffusion as PERMISSIVE for DELETE to public using (((organisation_id = ( SELECT current_user_organisation_id() AS current_user_organisation_id)) OR ((((( SELECT auth.jwt() AS jwt) -> 'app_metadata'::text) ->> 'is_super_admin'::text))::boolean = true)));
create policy listes_diffusion_insert on public.listes_diffusion as PERMISSIVE for INSERT to public with check (((organisation_id = ( SELECT current_user_organisation_id() AS current_user_organisation_id)) OR ((((( SELECT auth.jwt() AS jwt) -> 'app_metadata'::text) ->> 'is_super_admin'::text))::boolean = true)));
create policy listes_diffusion_select on public.listes_diffusion as PERMISSIVE for SELECT to public using (((organisation_id = ( SELECT current_user_organisation_id() AS current_user_organisation_id)) OR ((((( SELECT auth.jwt() AS jwt) -> 'app_metadata'::text) ->> 'is_super_admin'::text))::boolean = true)));
create policy listes_diffusion_update on public.listes_diffusion as PERMISSIVE for UPDATE to public using (((organisation_id = ( SELECT current_user_organisation_id() AS current_user_organisation_id)) OR ((((( SELECT auth.jwt() AS jwt) -> 'app_metadata'::text) ->> 'is_super_admin'::text))::boolean = true))) with check (((organisation_id = ( SELECT current_user_organisation_id() AS current_user_organisation_id)) OR ((((( SELECT auth.jwt() AS jwt) -> 'app_metadata'::text) ->> 'is_super_admin'::text))::boolean = true)));
create policy mailing_templates_delete on public.mailing_templates as PERMISSIVE for DELETE to public using (((organisation_id = ( SELECT current_user_organisation_id() AS current_user_organisation_id)) OR ((((( SELECT auth.jwt() AS jwt) -> 'app_metadata'::text) ->> 'is_super_admin'::text))::boolean = true)));
create policy mailing_templates_insert on public.mailing_templates as PERMISSIVE for INSERT to public with check (((organisation_id = ( SELECT current_user_organisation_id() AS current_user_organisation_id)) OR ((((( SELECT auth.jwt() AS jwt) -> 'app_metadata'::text) ->> 'is_super_admin'::text))::boolean = true)));
create policy mailing_templates_select on public.mailing_templates as PERMISSIVE for SELECT to public using (((organisation_id = ( SELECT current_user_organisation_id() AS current_user_organisation_id)) OR ((((( SELECT auth.jwt() AS jwt) -> 'app_metadata'::text) ->> 'is_super_admin'::text))::boolean = true)));
create policy mailing_templates_update on public.mailing_templates as PERMISSIVE for UPDATE to public using (((organisation_id = ( SELECT current_user_organisation_id() AS current_user_organisation_id)) OR ((((( SELECT auth.jwt() AS jwt) -> 'app_metadata'::text) ->> 'is_super_admin'::text))::boolean = true))) with check (((organisation_id = ( SELECT current_user_organisation_id() AS current_user_organisation_id)) OR ((((( SELECT auth.jwt() AS jwt) -> 'app_metadata'::text) ->> 'is_super_admin'::text))::boolean = true)));
create policy mouvements_portefeuille_select on public.mouvements_portefeuille as PERMISSIVE for SELECT to authenticated using ((((((( SELECT auth.jwt() AS jwt) -> 'app_metadata'::text) ->> 'is_super_admin'::text))::boolean = true) OR (organisation_id = ( SELECT current_user_organisation_id() AS current_user_organisation_id))));
create policy org_delete_superadmin on public.organisations as PERMISSIVE for DELETE to public using (((((( SELECT auth.jwt() AS jwt) -> 'app_metadata'::text) ->> 'is_super_admin'::text))::boolean = true));
create policy org_insert_superadmin on public.organisations as PERMISSIVE for INSERT to public with check (((((( SELECT auth.jwt() AS jwt) -> 'app_metadata'::text) ->> 'is_super_admin'::text))::boolean = true));
create policy org_select on public.organisations as PERMISSIVE for SELECT to public using ((((((( SELECT auth.jwt() AS jwt) -> 'app_metadata'::text) ->> 'is_super_admin'::text))::boolean = true) OR (id = ( SELECT current_effective_organisation_id() AS current_effective_organisation_id))));
create policy org_update_admin on public.organisations as PERMISSIVE for UPDATE to public using ((((((( SELECT auth.jwt() AS jwt) -> 'app_metadata'::text) ->> 'is_super_admin'::text))::boolean = true) OR ((id = ( SELECT current_user_organisation_id() AS current_user_organisation_id)) AND (( SELECT current_user_role() AS current_user_role) = 'admin'::text)))) with check ((((((( SELECT auth.jwt() AS jwt) -> 'app_metadata'::text) ->> 'is_super_admin'::text))::boolean = true) OR ((id = ( SELECT current_user_organisation_id() AS current_user_organisation_id)) AND (( SELECT current_user_role() AS current_user_role) = 'admin'::text))));
create policy organisation_assets_delete on public.organisation_assets as PERMISSIVE for DELETE to public using ((((((( SELECT auth.jwt() AS jwt) -> 'app_metadata'::text) ->> 'is_super_admin'::text))::boolean = true) OR ((organisation_id = ( SELECT current_user_organisation_id() AS current_user_organisation_id)) AND (( SELECT current_user_role() AS current_user_role) = 'admin'::text))));
create policy organisation_assets_insert on public.organisation_assets as PERMISSIVE for INSERT to public with check ((((((( SELECT auth.jwt() AS jwt) -> 'app_metadata'::text) ->> 'is_super_admin'::text))::boolean = true) OR ((organisation_id = ( SELECT current_user_organisation_id() AS current_user_organisation_id)) AND (( SELECT current_user_role() AS current_user_role) = 'admin'::text))));
create policy organisation_assets_select on public.organisation_assets as PERMISSIVE for SELECT to public using ((((((( SELECT auth.jwt() AS jwt) -> 'app_metadata'::text) ->> 'is_super_admin'::text))::boolean = true) OR (organisation_id = ( SELECT current_user_organisation_id() AS current_user_organisation_id))));
create policy organisation_assets_update on public.organisation_assets as PERMISSIVE for UPDATE to public using ((((((( SELECT auth.jwt() AS jwt) -> 'app_metadata'::text) ->> 'is_super_admin'::text))::boolean = true) OR ((organisation_id = ( SELECT current_user_organisation_id() AS current_user_organisation_id)) AND (( SELECT current_user_role() AS current_user_role) = 'admin'::text)))) with check ((((((( SELECT auth.jwt() AS jwt) -> 'app_metadata'::text) ->> 'is_super_admin'::text))::boolean = true) OR ((organisation_id = ( SELECT current_user_organisation_id() AS current_user_organisation_id)) AND (( SELECT current_user_role() AS current_user_role) = 'admin'::text))));
create policy personnes_insert on public.personnes as PERMISSIVE for INSERT to authenticated with check (true);
create policy personnes_select on public.personnes as PERMISSIVE for SELECT to public using ((((((( SELECT auth.jwt() AS jwt) -> 'app_metadata'::text) ->> 'is_super_admin'::text))::boolean = true) OR (EXISTS ( SELECT 1
   FROM profils_participant pp
  WHERE ((pp.personne_id = personnes.id) AND (pp.organisation_id = ( SELECT current_effective_organisation_id() AS current_effective_organisation_id)))))));
create policy personnes_update on public.personnes as PERMISSIVE for UPDATE to public using ((((((( SELECT auth.jwt() AS jwt) -> 'app_metadata'::text) ->> 'is_super_admin'::text))::boolean = true) OR (EXISTS ( SELECT 1
   FROM profils_participant pp
  WHERE ((pp.personne_id = personnes.id) AND (pp.organisation_id = ( SELECT current_user_organisation_id() AS current_user_organisation_id)))))));
create policy portefeuilles_select on public.portefeuilles as PERMISSIVE for SELECT to authenticated using ((((((( SELECT auth.jwt() AS jwt) -> 'app_metadata'::text) ->> 'is_super_admin'::text))::boolean = true) OR (organisation_id = ( SELECT current_user_organisation_id() AS current_user_organisation_id))));
create policy profils_org_select on public.profils_organisation as PERMISSIVE for SELECT to public using ((((((( SELECT auth.jwt() AS jwt) -> 'app_metadata'::text) ->> 'is_super_admin'::text))::boolean = true) OR (organisation_id = ( SELECT current_user_organisation_id() AS current_user_organisation_id))));
create policy profils_org_update_self on public.profils_organisation as PERMISSIVE for UPDATE to public using ((utilisateur_id = auth.uid())) with check ((utilisateur_id = auth.uid()));
create policy profils_participant_delete_admin on public.profils_participant as PERMISSIVE for DELETE to public using ((((((( SELECT auth.jwt() AS jwt) -> 'app_metadata'::text) ->> 'is_super_admin'::text))::boolean = true) OR (organisation_id = ( SELECT current_user_organisation_id() AS current_user_organisation_id))));
create policy profils_participant_insert on public.profils_participant as PERMISSIVE for INSERT to public with check ((((((( SELECT auth.jwt() AS jwt) -> 'app_metadata'::text) ->> 'is_super_admin'::text))::boolean = true) OR (organisation_id = ( SELECT current_effective_organisation_id() AS current_effective_organisation_id))));
create policy profils_participant_select on public.profils_participant as PERMISSIVE for SELECT to public using ((((((( SELECT auth.jwt() AS jwt) -> 'app_metadata'::text) ->> 'is_super_admin'::text))::boolean = true) OR (organisation_id = ( SELECT current_effective_organisation_id() AS current_effective_organisation_id))));
create policy profils_participant_update_admin on public.profils_participant as PERMISSIVE for UPDATE to public using ((((((( SELECT auth.jwt() AS jwt) -> 'app_metadata'::text) ->> 'is_super_admin'::text))::boolean = true) OR (organisation_id = ( SELECT current_user_organisation_id() AS current_user_organisation_id))));
create policy recus_lot_lignes_select on public.recus_lot_lignes as PERMISSIVE for SELECT to authenticated using (((organisation_id = ( SELECT current_user_organisation_id() AS current_user_organisation_id)) OR ((((( SELECT auth.jwt() AS jwt) -> 'app_metadata'::text) ->> 'is_super_admin'::text))::boolean = true)));
create policy recus_lots_select on public.recus_lots as PERMISSIVE for SELECT to authenticated using (((organisation_id = ( SELECT current_user_organisation_id() AS current_user_organisation_id)) OR ((((( SELECT auth.jwt() AS jwt) -> 'app_metadata'::text) ->> 'is_super_admin'::text))::boolean = true)));
create policy recus_select on public.recus_fiscaux as PERMISSIVE for SELECT to authenticated using (((organisation_id = ( SELECT current_user_organisation_id() AS current_user_organisation_id)) OR ((((( SELECT auth.jwt() AS jwt) -> 'app_metadata'::text) ->> 'is_super_admin'::text))::boolean = true)));
create policy recus_versions_select on public.recus_fiscaux_versions as PERMISSIVE for SELECT to authenticated using (((organisation_id = ( SELECT current_user_organisation_id() AS current_user_organisation_id)) OR ((((( SELECT auth.jwt() AS jwt) -> 'app_metadata'::text) ->> 'is_super_admin'::text))::boolean = true)));
create policy secrets_portefeuille_select on public.secrets_portefeuille as PERMISSIVE for SELECT to authenticated using ((((((( SELECT auth.jwt() AS jwt) -> 'app_metadata'::text) ->> 'is_super_admin'::text))::boolean = true) OR (organisation_id = ( SELECT current_user_organisation_id() AS current_user_organisation_id))));
create policy signatures_adhesion_delete on public.signatures_adhesion as PERMISSIVE for DELETE to authenticated using (((organisation_id = ( SELECT current_user_organisation_id() AS current_user_organisation_id)) OR COALESCE(( SELECT is_current_user_super_admin() AS is_current_user_super_admin), false)));
create policy signatures_adhesion_insert on public.signatures_adhesion as PERMISSIVE for INSERT to authenticated with check (((organisation_id = ( SELECT current_user_organisation_id() AS current_user_organisation_id)) OR COALESCE(( SELECT is_current_user_super_admin() AS is_current_user_super_admin), false)));
create policy signatures_adhesion_select on public.signatures_adhesion as PERMISSIVE for SELECT to authenticated using (((organisation_id = ( SELECT current_user_organisation_id() AS current_user_organisation_id)) OR COALESCE(( SELECT is_current_user_super_admin() AS is_current_user_super_admin), false)));
create policy signatures_adhesion_update on public.signatures_adhesion as PERMISSIVE for UPDATE to authenticated using (((organisation_id = ( SELECT current_user_organisation_id() AS current_user_organisation_id)) OR COALESCE(( SELECT is_current_user_super_admin() AS is_current_user_super_admin), false))) with check (((organisation_id = ( SELECT current_user_organisation_id() AS current_user_organisation_id)) OR COALESCE(( SELECT is_current_user_super_admin() AS is_current_user_super_admin), false)));
create policy templates_carte_adherent_delete on public.templates_carte_adherent as PERMISSIVE for DELETE to public using ((((((( SELECT auth.jwt() AS jwt) -> 'app_metadata'::text) ->> 'is_super_admin'::text))::boolean = true) OR ((organisation_id = ( SELECT current_user_organisation_id() AS current_user_organisation_id)) AND (( SELECT current_user_role() AS current_user_role) = 'admin'::text))));
create policy templates_carte_adherent_insert on public.templates_carte_adherent as PERMISSIVE for INSERT to public with check ((((((( SELECT auth.jwt() AS jwt) -> 'app_metadata'::text) ->> 'is_super_admin'::text))::boolean = true) OR ((organisation_id = ( SELECT current_user_organisation_id() AS current_user_organisation_id)) AND (( SELECT current_user_role() AS current_user_role) = 'admin'::text))));
create policy templates_carte_adherent_select on public.templates_carte_adherent as PERMISSIVE for SELECT to public using ((((((( SELECT auth.jwt() AS jwt) -> 'app_metadata'::text) ->> 'is_super_admin'::text))::boolean = true) OR (organisation_id = ( SELECT current_user_organisation_id() AS current_user_organisation_id))));
create policy templates_carte_adherent_update on public.templates_carte_adherent as PERMISSIVE for UPDATE to public using ((((((( SELECT auth.jwt() AS jwt) -> 'app_metadata'::text) ->> 'is_super_admin'::text))::boolean = true) OR ((organisation_id = ( SELECT current_user_organisation_id() AS current_user_organisation_id)) AND (( SELECT current_user_role() AS current_user_role) = 'admin'::text)))) with check ((((((( SELECT auth.jwt() AS jwt) -> 'app_metadata'::text) ->> 'is_super_admin'::text))::boolean = true) OR ((organisation_id = ( SELECT current_user_organisation_id() AS current_user_organisation_id)) AND (( SELECT current_user_role() AS current_user_role) = 'admin'::text))));
create policy templates_recu_delete on public.templates_recu as PERMISSIVE for DELETE to public using ((((((( SELECT auth.jwt() AS jwt) -> 'app_metadata'::text) ->> 'is_super_admin'::text))::boolean = true) OR ((organisation_id = ( SELECT current_user_organisation_id() AS current_user_organisation_id)) AND (( SELECT current_user_role() AS current_user_role) = 'admin'::text))));
create policy templates_recu_insert on public.templates_recu as PERMISSIVE for INSERT to public with check ((((((( SELECT auth.jwt() AS jwt) -> 'app_metadata'::text) ->> 'is_super_admin'::text))::boolean = true) OR ((organisation_id = ( SELECT current_user_organisation_id() AS current_user_organisation_id)) AND (( SELECT current_user_role() AS current_user_role) = 'admin'::text))));
create policy templates_recu_select on public.templates_recu as PERMISSIVE for SELECT to public using ((((((( SELECT auth.jwt() AS jwt) -> 'app_metadata'::text) ->> 'is_super_admin'::text))::boolean = true) OR (organisation_id = ( SELECT current_user_organisation_id() AS current_user_organisation_id))));
create policy templates_recu_update on public.templates_recu as PERMISSIVE for UPDATE to public using ((((((( SELECT auth.jwt() AS jwt) -> 'app_metadata'::text) ->> 'is_super_admin'::text))::boolean = true) OR ((organisation_id = ( SELECT current_user_organisation_id() AS current_user_organisation_id)) AND (( SELECT current_user_role() AS current_user_role) = 'admin'::text)))) with check ((((((( SELECT auth.jwt() AS jwt) -> 'app_metadata'::text) ->> 'is_super_admin'::text))::boolean = true) OR ((organisation_id = ( SELECT current_user_organisation_id() AS current_user_organisation_id)) AND (( SELECT current_user_role() AS current_user_role) = 'admin'::text))));
revoke execute on function activer_commande(uuid,text) from public, anon, authenticated; grant execute on function activer_commande(uuid,text) to service_role;
revoke execute on function add_adherents_tag(uuid,uuid[],text) from public, anon, authenticated; grant execute on function add_adherents_tag(uuid,uuid[],text) to public; grant execute on function add_adherents_tag(uuid,uuid[],text) to anon; grant execute on function add_adherents_tag(uuid,uuid[],text) to authenticated; grant execute on function add_adherents_tag(uuid,uuid[],text) to service_role;
revoke execute on function adherent_doublon_existe(uuid,text,text,text) from public, anon, authenticated; grant execute on function adherent_doublon_existe(uuid,text,text,text) to service_role;
revoke execute on function adherents_par_emails(uuid,text[]) from public, anon, authenticated; grant execute on function adherents_par_emails(uuid,text[]) to service_role;
revoke execute on function adhesions_poser_date_fin() from public, anon, authenticated; grant execute on function adhesions_poser_date_fin() to public; grant execute on function adhesions_poser_date_fin() to anon; grant execute on function adhesions_poser_date_fin() to authenticated; grant execute on function adhesions_poser_date_fin() to service_role;
revoke execute on function ajouter_secret_portefeuille(uuid) from public, anon, authenticated; grant execute on function ajouter_secret_portefeuille(uuid) to service_role;
revoke execute on function annuler_demande_paiement(uuid) from public, anon, authenticated; grant execute on function annuler_demande_paiement(uuid) to service_role; grant execute on function annuler_demande_paiement(uuid) to authenticated;
revoke execute on function anonymiser_portefeuille(uuid) from public, anon, authenticated; grant execute on function anonymiser_portefeuille(uuid) to service_role; grant execute on function anonymiser_portefeuille(uuid) to authenticated;
revoke execute on function anonymiser_portefeuille_interne(uuid,uuid) from public, anon, authenticated; grant execute on function anonymiser_portefeuille_interne(uuid,uuid) to service_role;
revoke execute on function apercu_recalage_adhesions(uuid) from public, anon, authenticated; grant execute on function apercu_recalage_adhesions(uuid) to authenticated; grant execute on function apercu_recalage_adhesions(uuid) to service_role;
revoke execute on function arreter_lot_recus(uuid) from public, anon, authenticated; grant execute on function arreter_lot_recus(uuid) to authenticated; grant execute on function arreter_lot_recus(uuid) to service_role;
revoke execute on function attribuer_numero_adherent(uuid) from public, anon, authenticated; grant execute on function attribuer_numero_adherent(uuid) to service_role;
revoke execute on function attribuer_participant_id_externe(uuid) from public, anon, authenticated; grant execute on function attribuer_participant_id_externe(uuid) to service_role;
revoke execute on function audit_missing_super_admin_bypass() from public, anon, authenticated; grant execute on function audit_missing_super_admin_bypass() to service_role;
revoke execute on function brevo_configure_organisation(uuid) from public, anon, authenticated; grant execute on function brevo_configure_organisation(uuid) to service_role;
revoke execute on function broadcast_portefeuille_payment_wakeup() from public, anon, authenticated; grant execute on function broadcast_portefeuille_payment_wakeup() to service_role;
revoke execute on function budget_envoi_lot_recus(uuid) from public, anon, authenticated; grant execute on function budget_envoi_lot_recus(uuid) to service_role;
revoke execute on function calculer_date_fin_adhesion(uuid,date) from public, anon, authenticated; grant execute on function calculer_date_fin_adhesion(uuid,date) to public; grant execute on function calculer_date_fin_adhesion(uuid,date) to anon; grant execute on function calculer_date_fin_adhesion(uuid,date) to authenticated; grant execute on function calculer_date_fin_adhesion(uuid,date) to service_role;
revoke execute on function changer_role_compte(uuid,text) from public, anon, authenticated; grant execute on function changer_role_compte(uuid,text) to authenticated; grant execute on function changer_role_compte(uuid,text) to service_role;
revoke execute on function classer_ligne_envoi_interrompue(uuid) from public, anon, authenticated; grant execute on function classer_ligne_envoi_interrompue(uuid) to service_role;
revoke execute on function codes_pin(uuid) from public, anon, authenticated; grant execute on function codes_pin(uuid) to authenticated; grant execute on function codes_pin(uuid) to service_role;
revoke execute on function codes_pin_benevole_organisations() from public, anon, authenticated; grant execute on function codes_pin_benevole_organisations() to authenticated; grant execute on function codes_pin_benevole_organisations() to service_role;
revoke execute on function confirmer_demande_inscription(text,text) from public, anon, authenticated; grant execute on function confirmer_demande_inscription(text,text) to service_role;
revoke execute on function coupon_spike_step(uuid,text,text,uuid,boolean) from public, anon, authenticated; grant execute on function coupon_spike_step(uuid,text,text,uuid,boolean) to service_role;
revoke execute on function creer_adhesion_benevole(uuid,jsonb,boolean,boolean,text,boolean,date,numeric,smallint) from public, anon, authenticated; grant execute on function creer_adhesion_benevole(uuid,jsonb,boolean,boolean,text,boolean,date,numeric,smallint) to authenticated; grant execute on function creer_adhesion_benevole(uuid,jsonb,boolean,boolean,text,boolean,date,numeric,smallint) to service_role;
revoke execute on function creer_commande_en_attente(uuid,text,integer,text,uuid) from public, anon, authenticated; grant execute on function creer_commande_en_attente(uuid,text,integer,text,uuid) to service_role;
revoke execute on function creer_credit_manuel(uuid,text,integer,uuid) from public, anon, authenticated; grant execute on function creer_credit_manuel(uuid,text,integer,uuid) to service_role; grant execute on function creer_credit_manuel(uuid,text,integer,uuid) to authenticated;
revoke execute on function creer_demande_paiement(uuid,text,integer) from public, anon, authenticated; grant execute on function creer_demande_paiement(uuid,text,integer) to service_role; grant execute on function creer_demande_paiement(uuid,text,integer) to authenticated;
revoke execute on function creer_organisation(text,text,jsonb,jsonb,jsonb,jsonb,text) from public, anon, authenticated; grant execute on function creer_organisation(text,text,jsonb,jsonb,jsonb,jsonb,text) to service_role;
revoke execute on function creer_secrets_organisation() from public, anon, authenticated; grant execute on function creer_secrets_organisation() to public; grant execute on function creer_secrets_organisation() to anon; grant execute on function creer_secrets_organisation() to authenticated; grant execute on function creer_secrets_organisation() to service_role;
revoke execute on function current_benevole_organisation_id() from public, anon, authenticated; grant execute on function current_benevole_organisation_id() to public; grant execute on function current_benevole_organisation_id() to anon; grant execute on function current_benevole_organisation_id() to authenticated; grant execute on function current_benevole_organisation_id() to service_role;
revoke execute on function current_effective_organisation_id() from public, anon, authenticated; grant execute on function current_effective_organisation_id() to public; grant execute on function current_effective_organisation_id() to anon; grant execute on function current_effective_organisation_id() to authenticated; grant execute on function current_effective_organisation_id() to service_role;
revoke execute on function current_user_organisation_id() from public, anon, authenticated; grant execute on function current_user_organisation_id() to public; grant execute on function current_user_organisation_id() to anon; grant execute on function current_user_organisation_id() to authenticated; grant execute on function current_user_organisation_id() to service_role;
revoke execute on function current_user_role() from public, anon, authenticated; grant execute on function current_user_role() to public; grant execute on function current_user_role() to anon; grant execute on function current_user_role() to authenticated; grant execute on function current_user_role() to service_role;
revoke execute on function current_vendeur_organisation_id() from public, anon, authenticated; grant execute on function current_vendeur_organisation_id() to public; grant execute on function current_vendeur_organisation_id() to anon; grant execute on function current_vendeur_organisation_id() to authenticated; grant execute on function current_vendeur_organisation_id() to service_role;
revoke execute on function decider_demande_paiement(uuid,uuid,boolean) from public, anon, authenticated; grant execute on function decider_demande_paiement(uuid,uuid,boolean) to service_role;
revoke execute on function definir_config_brevo(uuid,text,text,text) from public, anon, authenticated; grant execute on function definir_config_brevo(uuid,text,text,text) to authenticated; grant execute on function definir_config_brevo(uuid,text,text,text) to service_role;
revoke execute on function definir_notification_demandes(uuid,uuid,boolean) from public, anon, authenticated; grant execute on function definir_notification_demandes(uuid,uuid,boolean) to authenticated; grant execute on function definir_notification_demandes(uuid,uuid,boolean) to service_role;
revoke execute on function demandes_adhesion_verifier_adherent_vise() from public, anon, authenticated; grant execute on function demandes_adhesion_verifier_adherent_vise() to service_role;
revoke execute on function enregistrer_version_recu(uuid,uuid,integer,integer,numeric,text,text,text,uuid,jsonb,jsonb,uuid) from public, anon, authenticated; grant execute on function enregistrer_version_recu(uuid,uuid,integer,integer,numeric,text,text,text,uuid,jsonb,jsonb,uuid) to service_role;
revoke execute on function envois_recus_depuis(uuid,timestamp with time zone) from public, anon, authenticated; grant execute on function envois_recus_depuis(uuid,timestamp with time zone) to service_role;
revoke execute on function est_dernier_admin_actif(uuid) from public, anon, authenticated; grant execute on function est_dernier_admin_actif(uuid) to service_role;
revoke execute on function etat_config_brevo(uuid) from public, anon, authenticated; grant execute on function etat_config_brevo(uuid) to authenticated; grant execute on function etat_config_brevo(uuid) to service_role;
revoke execute on function evenements_organisation_immuable() from public, anon, authenticated; grant execute on function evenements_organisation_immuable() to service_role;
revoke execute on function geler_portefeuille(uuid,boolean) from public, anon, authenticated; grant execute on function geler_portefeuille(uuid,boolean) to service_role; grant execute on function geler_portefeuille(uuid,boolean) to authenticated;
revoke execute on function generer_pin_unique(text) from public, anon, authenticated; grant execute on function generer_pin_unique(text) to service_role;
revoke execute on function get_evenement_public(text,text) from public, anon, authenticated; grant execute on function get_evenement_public(text,text) to service_role; grant execute on function get_evenement_public(text,text) to anon; grant execute on function get_evenement_public(text,text) to authenticated;
revoke execute on function get_org_admins(uuid) from public, anon, authenticated; grant execute on function get_org_admins(uuid) to authenticated; grant execute on function get_org_admins(uuid) to service_role;
revoke execute on function get_organisation_logo_url(uuid) from public, anon, authenticated; grant execute on function get_organisation_logo_url(uuid) to authenticated; grant execute on function get_organisation_logo_url(uuid) to service_role;
revoke execute on function get_organisation_public(text) from public, anon, authenticated; grant execute on function get_organisation_public(text) to public; grant execute on function get_organisation_public(text) to anon; grant execute on function get_organisation_public(text) to authenticated; grant execute on function get_organisation_public(text) to service_role;
revoke execute on function import_upsert_activites(jsonb,uuid) from public, anon, authenticated; grant execute on function import_upsert_activites(jsonb,uuid) to authenticated; grant execute on function import_upsert_activites(jsonb,uuid) to service_role;
revoke execute on function import_upsert_adherents(jsonb,uuid) from public, anon, authenticated; grant execute on function import_upsert_adherents(jsonb,uuid) to authenticated; grant execute on function import_upsert_adherents(jsonb,uuid) to service_role;
revoke execute on function import_upsert_dons(jsonb,uuid) from public, anon, authenticated; grant execute on function import_upsert_dons(jsonb,uuid) to authenticated; grant execute on function import_upsert_dons(jsonb,uuid) to service_role;
revoke execute on function import_upsert_participants(jsonb,uuid) from public, anon, authenticated; grant execute on function import_upsert_participants(jsonb,uuid) to authenticated; grant execute on function import_upsert_participants(jsonb,uuid) to service_role;
revoke execute on function is_current_user_super_admin() from public, anon, authenticated; grant execute on function is_current_user_super_admin() to public; grant execute on function is_current_user_super_admin() to anon; grant execute on function is_current_user_super_admin() to authenticated; grant execute on function is_current_user_super_admin() to service_role;
revoke execute on function is_organisation_row_accessible(uuid) from public, anon, authenticated; grant execute on function is_organisation_row_accessible(uuid) to public; grant execute on function is_organisation_row_accessible(uuid) to anon; grant execute on function is_organisation_row_accessible(uuid) to authenticated; grant execute on function is_organisation_row_accessible(uuid) to service_role;
revoke execute on function lancer_lot_envoi_recus(uuid,integer) from public, anon, authenticated; grant execute on function lancer_lot_envoi_recus(uuid,integer) to authenticated; grant execute on function lancer_lot_envoi_recus(uuid,integer) to service_role;
revoke execute on function lancer_lot_recus(uuid,integer) from public, anon, authenticated; grant execute on function lancer_lot_recus(uuid,integer) to authenticated; grant execute on function lancer_lot_recus(uuid,integer) to service_role;
revoke execute on function liberer_lot_recus(uuid) from public, anon, authenticated; grant execute on function liberer_lot_recus(uuid) to service_role;
revoke execute on function liens_renouvellement_verifier_organisation() from public, anon, authenticated; grant execute on function liens_renouvellement_verifier_organisation() to service_role;
revoke execute on function ligne_suivante_lot_recus(uuid,integer) from public, anon, authenticated; grant execute on function ligne_suivante_lot_recus(uuid,integer) to service_role;
revoke execute on function limite_renouvellement_depassee(text,text,text,text,integer,integer,interval) from public, anon, authenticated; grant execute on function limite_renouvellement_depassee(text,text,text,text,integer,integer,interval) to service_role;
revoke execute on function lire_lien_renouvellement(text,text,text) from public, anon, authenticated; grant execute on function lire_lien_renouvellement(text,text,text) to service_role;
revoke execute on function lire_portefeuille_par_secret_hash(text,text,text) from public, anon, authenticated; grant execute on function lire_portefeuille_par_secret_hash(text,text,text) to service_role;
revoke execute on function list_journal_modifications(uuid,integer,integer,text,uuid,text) from public, anon, authenticated; grant execute on function list_journal_modifications(uuid,integer,integer,text,uuid,text) to authenticated; grant execute on function list_journal_modifications(uuid,integer,integer,text,uuid,text) to service_role;
revoke execute on function list_listes_diffusion_avec_compte(uuid) from public, anon, authenticated; grant execute on function list_listes_diffusion_avec_compte(uuid) to public; grant execute on function list_listes_diffusion_avec_compte(uuid) to anon; grant execute on function list_listes_diffusion_avec_compte(uuid) to authenticated; grant execute on function list_listes_diffusion_avec_compte(uuid) to service_role;
revoke execute on function modifier_note_campagne_courrier(uuid,text) from public, anon, authenticated; grant execute on function modifier_note_campagne_courrier(uuid,text) to authenticated; grant execute on function modifier_note_campagne_courrier(uuid,text) to service_role;
revoke execute on function modifier_note_campagne_mailing(uuid,text) from public, anon, authenticated; grant execute on function modifier_note_campagne_mailing(uuid,text) to authenticated; grant execute on function modifier_note_campagne_mailing(uuid,text) to service_role;
revoke execute on function mouvements_portefeuille_immuables() from public, anon, authenticated; grant execute on function mouvements_portefeuille_immuables() to service_role;
revoke execute on function nettoyer_texte_saisie(text) from public, anon, authenticated; grant execute on function nettoyer_texte_saisie(text) to service_role;
revoke execute on function next_adherent_id_externe(uuid) from public, anon, authenticated; grant execute on function next_adherent_id_externe(uuid) to authenticated; grant execute on function next_adherent_id_externe(uuid) to service_role;
revoke execute on function next_numero_recu(uuid,integer) from public, anon, authenticated; grant execute on function next_numero_recu(uuid,integer) to service_role;
revoke execute on function next_participant_id_externe(uuid) from public, anon, authenticated; grant execute on function next_participant_id_externe(uuid) to authenticated; grant execute on function next_participant_id_externe(uuid) to service_role;
revoke execute on function organisations_fonctionnalites_super_admin() from public, anon, authenticated; grant execute on function organisations_fonctionnalites_super_admin() to service_role;
revoke execute on function organisations_verifier_logo() from public, anon, authenticated; grant execute on function organisations_verifier_logo() to service_role;
revoke execute on function peut_gerer_secrets(uuid,boolean) from public, anon, authenticated; grant execute on function peut_gerer_secrets(uuid,boolean) to authenticated; grant execute on function peut_gerer_secrets(uuid,boolean) to service_role;
revoke execute on function peut_saisir_adhesion_benevole(uuid) from public, anon, authenticated; grant execute on function peut_saisir_adhesion_benevole(uuid) to service_role;
revoke execute on function planifier_traitement_lots_recus() from public, anon, authenticated; grant execute on function planifier_traitement_lots_recus() to service_role;
revoke execute on function portefeuille_non_anonymise() from public, anon, authenticated; grant execute on function portefeuille_non_anonymise() to service_role;
revoke execute on function portefeuilles_anonymise_fige() from public, anon, authenticated; grant execute on function portefeuilles_anonymise_fige() to service_role;
revoke execute on function prendre_lot_recus(integer,uuid[]) from public, anon, authenticated; grant execute on function prendre_lot_recus(integer,uuid[]) to service_role;
revoke execute on function prevent_profils_organisation_tampering() from public, anon, authenticated; grant execute on function prevent_profils_organisation_tampering() to public; grant execute on function prevent_profils_organisation_tampering() to anon; grant execute on function prevent_profils_organisation_tampering() to authenticated; grant execute on function prevent_profils_organisation_tampering() to service_role;
revoke execute on function profils_donateur_par_emails(uuid,text[]) from public, anon, authenticated; grant execute on function profils_donateur_par_emails(uuid,text[]) to service_role;
revoke execute on function profils_participant_attribuer_id_externe() from public, anon, authenticated; grant execute on function profils_participant_attribuer_id_externe() to service_role;
revoke execute on function purger_demandes_inscription_refusees() from public, anon, authenticated; grant execute on function purger_demandes_inscription_refusees() to service_role;
revoke execute on function purger_donnees_evenements() from public, anon, authenticated; grant execute on function purger_donnees_evenements() to service_role;
revoke execute on function recalculer_dates_fin_adhesions(uuid) from public, anon, authenticated; grant execute on function recalculer_dates_fin_adhesions(uuid) to authenticated; grant execute on function recalculer_dates_fin_adhesions(uuid) to service_role;
revoke execute on function recapitulatif_envoi_lot_recus(uuid,integer) from public, anon, authenticated; grant execute on function recapitulatif_envoi_lot_recus(uuid,integer) to authenticated; grant execute on function recapitulatif_envoi_lot_recus(uuid,integer) to service_role;
revoke execute on function rechercher_destinataires_campagne(uuid,text,text,integer,integer) from public, anon, authenticated; grant execute on function rechercher_destinataires_campagne(uuid,text,text,integer,integer) to authenticated; grant execute on function rechercher_destinataires_campagne(uuid,text,text,integer,integer) to service_role;
revoke execute on function rechercher_destinataires_campagne_courrier(uuid,text,text,integer,integer) from public, anon, authenticated; grant execute on function rechercher_destinataires_campagne_courrier(uuid,text,text,integer,integer) to authenticated; grant execute on function rechercher_destinataires_campagne_courrier(uuid,text,text,integer,integer) to service_role;
revoke execute on function rechercher_global(text,uuid) from public, anon, authenticated; grant execute on function rechercher_global(text,uuid) to authenticated; grant execute on function rechercher_global(text,uuid) to service_role;
revoke execute on function recompter_lot_recus(uuid) from public, anon, authenticated; grant execute on function recompter_lot_recus(uuid) to service_role;
revoke execute on function recus_envoi_lot(uuid,integer) from public, anon, authenticated; grant execute on function recus_envoi_lot(uuid,integer) to service_role;
revoke execute on function recus_fiscaux_verrou_identite() from public, anon, authenticated; grant execute on function recus_fiscaux_verrou_identite() to public; grant execute on function recus_fiscaux_verrou_identite() to anon; grant execute on function recus_fiscaux_verrou_identite() to authenticated; grant execute on function recus_fiscaux_verrou_identite() to service_role;
revoke execute on function recus_fiscaux_versions_immuables() from public, anon, authenticated; grant execute on function recus_fiscaux_versions_immuables() to service_role;
revoke execute on function recus_manquants_lot(uuid,integer) from public, anon, authenticated; grant execute on function recus_manquants_lot(uuid,integer) to service_role;
revoke execute on function reevaluer_attente_lots_envoi_recus() from public, anon, authenticated; grant execute on function reevaluer_attente_lots_envoi_recus() to service_role;
revoke execute on function remove_adherents_tag(uuid,uuid[],text) from public, anon, authenticated; grant execute on function remove_adherents_tag(uuid,uuid[],text) to public; grant execute on function remove_adherents_tag(uuid,uuid[],text) to anon; grant execute on function remove_adherents_tag(uuid,uuid[],text) to authenticated; grant execute on function remove_adherents_tag(uuid,uuid[],text) to service_role;
revoke execute on function remplacer_liens_renouvellement(uuid[]) from public, anon, authenticated; grant execute on function remplacer_liens_renouvellement(uuid[]) to service_role;
revoke execute on function renommer_liste_diffusion(uuid,text,text) from public, anon, authenticated; grant execute on function renommer_liste_diffusion(uuid,text,text) to public; grant execute on function renommer_liste_diffusion(uuid,text,text) to anon; grant execute on function renommer_liste_diffusion(uuid,text,text) to authenticated; grant execute on function renommer_liste_diffusion(uuid,text,text) to service_role;
revoke execute on function renvoyer_acces_portefeuille(uuid,text,boolean) from public, anon, authenticated; grant execute on function renvoyer_acces_portefeuille(uuid,text,boolean) to service_role; grant execute on function renvoyer_acces_portefeuille(uuid,text,boolean) to authenticated;
revoke execute on function reset_adherent_email_invalide() from public, anon, authenticated; grant execute on function reset_adherent_email_invalide() to public; grant execute on function reset_adherent_email_invalide() to anon; grant execute on function reset_adherent_email_invalide() to authenticated; grant execute on function reset_adherent_email_invalide() to service_role;
revoke execute on function reset_profil_email_invalide() from public, anon, authenticated; grant execute on function reset_profil_email_invalide() to service_role;
revoke execute on function resoudre_hash_secret_portefeuille(text) from public, anon, authenticated; grant execute on function resoudre_hash_secret_portefeuille(text) to service_role;
revoke execute on function resoudre_lien_renouvellement(text,text) from public, anon, authenticated; grant execute on function resoudre_lien_renouvellement(text,text) to service_role;
revoke execute on function resoudre_secret_portefeuille(text) from public, anon, authenticated; grant execute on function resoudre_secret_portefeuille(text) to service_role;
revoke execute on function revoquer_liens_renouvellement(uuid[]) from public, anon, authenticated; grant execute on function revoquer_liens_renouvellement(uuid[]) to service_role;
revoke execute on function revoquer_secrets_portefeuille(uuid) from public, anon, authenticated; grant execute on function revoquer_secrets_portefeuille(uuid) to service_role; grant execute on function revoquer_secrets_portefeuille(uuid) to authenticated;
revoke execute on function revoquer_sessions_compte_technique(text) from public, anon, authenticated; grant execute on function revoquer_sessions_compte_technique(text) to service_role;
revoke execute on function rls_auto_enable() from public, anon, authenticated; grant execute on function rls_auto_enable() to public; grant execute on function rls_auto_enable() to anon; grant execute on function rls_auto_enable() to authenticated; grant execute on function rls_auto_enable() to service_role;
revoke execute on function rythme_envoi_recus(uuid) from public, anon, authenticated; grant execute on function rythme_envoi_recus(uuid) to service_role;
revoke execute on function search_adherents(uuid,text,text,integer,integer,text,text,text,text,text,text,text,text) from public, anon, authenticated; grant execute on function search_adherents(uuid,text,text,integer,integer,text,text,text,text,text,text,text,text) to public; grant execute on function search_adherents(uuid,text,text,integer,integer,text,text,text,text,text,text,text,text) to anon; grant execute on function search_adherents(uuid,text,text,integer,integer,text,text,text,text,text,text,text,text) to authenticated; grant execute on function search_adherents(uuid,text,text,integer,integer,text,text,text,text,text,text,text,text) to service_role;
revoke execute on function search_adherents_verification(uuid,text,integer) from public, anon, authenticated; grant execute on function search_adherents_verification(uuid,text,integer) to authenticated; grant execute on function search_adherents_verification(uuid,text,integer) to service_role;
revoke execute on function set_updated_at() from public, anon, authenticated; grant execute on function set_updated_at() to public; grant execute on function set_updated_at() to anon; grant execute on function set_updated_at() to authenticated; grant execute on function set_updated_at() to service_role;
revoke execute on function set_updated_at_adherents() from public, anon, authenticated; grant execute on function set_updated_at_adherents() to public; grant execute on function set_updated_at_adherents() to anon; grant execute on function set_updated_at_adherents() to authenticated; grant execute on function set_updated_at_adherents() to service_role;
revoke execute on function soumettre_demande_inscription(text,text,text,jsonb) from public, anon, authenticated; grant execute on function soumettre_demande_inscription(text,text,text,jsonb) to service_role;
revoke execute on function soumettre_renouvellement(text,text,text,jsonb) from public, anon, authenticated; grant execute on function soumettre_renouvellement(text,text,text,jsonb) to service_role;
revoke execute on function supprimer_liste_diffusion(uuid,text) from public, anon, authenticated; grant execute on function supprimer_liste_diffusion(uuid,text) to public; grant execute on function supprimer_liste_diffusion(uuid,text) to anon; grant execute on function supprimer_liste_diffusion(uuid,text) to authenticated; grant execute on function supprimer_liste_diffusion(uuid,text) to service_role;
revoke execute on function sync_listes_diffusion_from_tags() from public, anon, authenticated; grant execute on function sync_listes_diffusion_from_tags() to public; grant execute on function sync_listes_diffusion_from_tags() to anon; grant execute on function sync_listes_diffusion_from_tags() to authenticated; grant execute on function sync_listes_diffusion_from_tags() to service_role;
revoke execute on function terminer_ligne_lot_recus(uuid,text,text,uuid,boolean,uuid,timestamp with time zone,text,boolean) from public, anon, authenticated; grant execute on function terminer_ligne_lot_recus(uuid,text,text,uuid,boolean,uuid,timestamp with time zone,text,boolean) to service_role;
revoke execute on function valider_renouvellement(uuid,date,numeric,smallint,date,boolean,boolean,text[],boolean) from public, anon, authenticated; grant execute on function valider_renouvellement(uuid,date,numeric,smallint,date,boolean,boolean,text[],boolean) to authenticated; grant execute on function valider_renouvellement(uuid,date,numeric,smallint,date,boolean,boolean,text[],boolean) to service_role;
revoke execute on function verifier_doublon_adhesion_benevole(uuid,text,text,text) from public, anon, authenticated; grant execute on function verifier_doublon_adhesion_benevole(uuid,text,text,text) to authenticated; grant execute on function verifier_doublon_adhesion_benevole(uuid,text,text,text) to service_role;
revoke execute on function verifier_limite_demande_adhesion(text) from public, anon, authenticated; grant execute on function verifier_limite_demande_adhesion(text) to service_role;
revoke execute on function verifier_limite_reset_mdp(text,text) from public, anon, authenticated; grant execute on function verifier_limite_reset_mdp(text,text) to service_role;
revoke execute on function verifier_limite_simulation_achat(text,text) from public, anon, authenticated; grant execute on function verifier_limite_simulation_achat(text,text) to service_role;
revoke execute on function verifier_limite_verify_pin(text) from public, anon, authenticated; grant execute on function verifier_limite_verify_pin(text) to service_role;
revoke execute on function vider_liste_diffusion(uuid,text) from public, anon, authenticated; grant execute on function vider_liste_diffusion(uuid,text) to public; grant execute on function vider_liste_diffusion(uuid,text) to anon; grant execute on function vider_liste_diffusion(uuid,text) to authenticated; grant execute on function vider_liste_diffusion(uuid,text) to service_role;
