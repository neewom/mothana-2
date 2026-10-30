-- Validation d'une demande de renouvellement par l'admin (épique Renouvellement, carte 3/3,
-- 2026-10-30). Une demande de renouvellement (type = 'renouvellement', carte 2/3) ne crée jamais
-- d'adhérent : sa validation enregistre, en une seule transaction,
--   - la réactivation de l'adhérent visé s'il est archivé (confirmée à l'écran : p_reactiver) ;
--   - les coordonnées cochées par l'admin (p_champs), reprises de la demande — jamais la date
--     de naissance, que la page publique ne saisit pas ;
--   - une adhésion renouvellement = true (date de fin posée par trg_adhesions_poser_date_fin
--     selon la règle de l'organisation, #265) ;
--   - la demande passée à 'ratifiee', rattachée à l'adhérent (adherent_id) ;
--   - les entrées du journal (réactivation, modification, ratification), comme les écrans.
-- Security invoker : la RLS (admin/contributeur de l'organisation, bypass super-admin) borne
-- chaque lecture et écriture ; la garde explicite écarte toute autre session (bénévole : NULL).
begin;

create or replace function public.valider_renouvellement(
  p_demande_id uuid,
  p_date_debut date,
  p_montant_cotisation numeric,
  p_mode_paiement smallint,
  p_date_paiement_cotisation date,
  p_droit_vote_ag boolean,
  p_bulletin_signe boolean,
  p_champs text[],
  p_reactiver boolean
)
returns jsonb
language plpgsql
set search_path = public, pg_temp
as $$
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
$$;

revoke all on function public.valider_renouvellement(uuid, date, numeric, smallint, date, boolean, boolean, text[], boolean) from public, anon;
grant execute on function public.valider_renouvellement(uuid, date, numeric, smallint, date, boolean, boolean, text[], boolean) to authenticated, service_role;

commit;
