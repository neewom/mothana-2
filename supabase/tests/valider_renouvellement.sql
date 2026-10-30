-- Tests de la validation d'un renouvellement (valider_renouvellement.sql) — staging uniquement :
--   npx supabase db query --linked -f supabase/tests/valider_renouvellement.sql
-- Bloc terminé par une exception : rien n'est conservé. Dépend de l'org « Association Démo
-- Staging » (compte bénévole, un admin, au moins un adhérent sans demande de renouvellement en attente).
do $$
declare
  v_demo uuid; v_slug text; v_benevole uuid; v_admin uuid; v_adh uuid;
  v_lien text := repeat('9', 64);
  v_demande uuid; v_orpheline uuid; v_avant public.adherents; v_apres public.adherents;
  v_nb_adherents int; v_nb_adhesions int; v_res jsonb; r text := '';
begin
  select id, slug into v_demo, v_slug from public.organisations where nom = 'Association Démo Staging';
  select id into v_benevole from auth.users where email = 'benevole-' || v_demo || '@mothana.internal';
  select po.utilisateur_id into v_admin from public.profils_organisation po
    where po.organisation_id = v_demo and po.role = 'admin' order by po.created_at desc limit 1;
  select a.id into v_adh from public.adherents a
    where a.organisation_id = v_demo
      and not exists (select 1 from public.demandes_adhesion d where d.adherent_vise_id = a.id and d.statut = 'en_attente')
    order by a.created_at limit 1;

  -- Adhérent archivé, lien envoyé hier, demande proposant une autre ville et un autre téléphone.
  update public.adherents set statut = 'archive' where id = v_adh;
  select * into v_avant from public.adherents where id = v_adh;
  insert into public.liens_renouvellement (organisation_id, adherent_id, secret_hash, cree_le)
    values (v_demo, v_adh, v_lien, now() - interval '1 day');
  insert into public.demandes_adhesion (organisation_id, type, adherent_vise_id, statut, civilite, nom, prenom,
      adresse, code_postal, ville, pays, telephone, courriel, signature_data_url, accepte_statuts, consent_rgpd)
    values (v_demo, 'renouvellement', v_adh, 'en_attente', v_avant.civilite, v_avant.nom, v_avant.prenom,
      v_avant.adresse, v_avant.code_postal, 'Ville-Test-Renouvellement', v_avant.pays, '0600000000', v_avant.courriel,
      'data:image/png;base64,AAAA', true, true)
    returning id into v_demande;
  -- Demande dont l'adhérent a été supprimé (adherent_vise_id passé à null).
  insert into public.demandes_adhesion (organisation_id, type, adherent_vise_id, statut, civilite, nom,
      signature_data_url, accepte_statuts, consent_rgpd)
    values (v_demo, 'renouvellement', null, 'en_attente', 0, 'ORPHELINE', 'data:image/png;base64,AAAA', true, true)
    returning id into v_orpheline;
  select count(*) into v_nb_adherents from public.adherents where organisation_id = v_demo;
  select count(*) into v_nb_adhesions from public.adhesions where adherent_id = v_adh;

  -- 1. Session bénévole (aucun profil d'organisation) : refusée
  perform set_config('request.jwt.claims', json_build_object('sub', v_benevole, 'role', 'authenticated',
    'app_metadata', json_build_object('role', 'benevole', 'organisation_id', v_demo))::text, true);
  execute 'set local role authenticated';
  begin
    perform public.valider_renouvellement(v_demande, current_date, null, null, null, true, true, array['ville'], true);
    r := r || '1.benevole=ACCEPTE(KO)';
  exception when insufficient_privilege then r := r || '1.benevole=refuse';
  end;

  -- 2. Admin : adhérent archivé sans confirmation, champ inconnu, adhérent supprimé
  perform set_config('request.jwt.claims', json_build_object('sub', v_admin, 'role', 'authenticated', 'app_metadata', json_build_object())::text, true);
  begin
    perform public.valider_renouvellement(v_demande, current_date, null, null, null, true, true, array['ville'], false);
    r := r || ' | 2.archive_sans_confirmation=ACCEPTE(KO)';
  exception when others then r := r || ' | 2.archive_sans_confirmation=' || sqlerrm;
  end;
  begin
    perform public.valider_renouvellement(v_demande, current_date, null, null, null, true, true, array['date_naissance'], true);
    r := r || ' champ_naissance=ACCEPTE(KO)';
  exception when others then r := r || ' champ_naissance=' || sqlerrm;
  end;
  begin
    perform public.valider_renouvellement(v_orpheline, current_date, null, null, null, true, true, '{}', false);
    r := r || ' orpheline=ACCEPTE(KO)';
  exception when others then r := r || ' orpheline=' || sqlerrm;
  end;

  -- 3. Validation : ville cochée, téléphone décoché, réactivation confirmée
  v_res := public.valider_renouvellement(v_demande, current_date, 20::numeric, 1::smallint, current_date, true, true, array['ville'], true);
  select * into v_apres from public.adherents where id = v_adh;
  r := r || ' | 3.reactive=' || (v_res ->> 'reactive')
    || ' statut=' || v_apres.statut
    || ' ville=' || (v_apres.ville = 'Ville-Test-Renouvellement')
    || ' tel_inchange=' || (v_apres.telephone is not distinct from v_avant.telephone)
    || ' naissance_inchangee=' || (v_apres.date_naissance is not distinct from v_avant.date_naissance)
    || ' diff=' || (select string_agg(k, ',') from jsonb_object_keys(v_res -> 'champs_modifies') k)
    || ' aucun_adherent_cree=' || ((select count(*) from public.adherents where organisation_id = v_demo) = v_nb_adherents)
    || ' adhesion_ajoutee=' || ((select count(*) from public.adhesions where adherent_id = v_adh) = v_nb_adhesions + 1)
    || ' renouvellement=' || (select h.renouvellement from public.adhesions h where h.id = (v_res ->> 'adhesion_id')::uuid)
    || ' date_fin_regle=' || ((v_res ->> 'date_fin')::date = public.calculer_date_fin_adhesion(v_demo, current_date))
    || ' demande=' || (select d.statut || ':' || (d.adherent_id = v_adh) || ':' || (d.decided_by = v_admin)
                       from public.demandes_adhesion d where d.id = v_demande)
    || ' journal=' || (select string_agg(j.action, ',' order by j.action) from public.journal_modifications j
                       where j.ligne_id in (v_adh, v_demande) and j.created_at = now());

  -- 4. Deuxième validation de la même demande : refusée
  begin
    perform public.valider_renouvellement(v_demande, current_date, null, null, null, true, true, '{}', true);
    r := r || ' | 4.double=ACCEPTE(KO)';
  exception when others then r := r || ' | 4.double=' || sqlerrm;
  end;

  -- 5. Page publique : le lien indique « déjà renouvelé »
  execute 'reset role';
  r := r || ' | 5.lien=' || (public.resoudre_lien_renouvellement(v_lien, v_slug) ->> 'etat');

  raise exception 'RESULTATS: %', r;
end;
$$;
