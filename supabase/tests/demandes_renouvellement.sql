-- Tests de la page publique de renouvellement (demandes_renouvellement.sql) — staging uniquement :
--   npx supabase db query --linked -f supabase/tests/demandes_renouvellement.sql
-- Bloc terminé par une exception : rien n'est conservé. Dépend de l'org « Association Démo
-- Staging » (compte bénévole, un admin, au moins un adhérent sans adhésion créée ces 2 derniers jours).
do $$
declare
  v_demo uuid; v_slug text; v_benevole uuid; v_admin uuid; v_adh uuid; v_adh2 uuid;
  v_ip text := repeat('1', 64);
  v_valide text := repeat('a', 64); v_expire text := repeat('b', 64); v_revoque text := repeat('c', 64);
  v_second text := repeat('d', 64); v_limite text := repeat('e', 64);
  v_res jsonb; v_demande jsonb; v_demande_id uuid; i int; r text := '';
begin
  select id, slug into v_demo, v_slug from public.organisations where nom = 'Association Démo Staging';
  select id into v_benevole from auth.users where email = 'benevole-' || v_demo || '@mothana.internal';
  select po.utilisateur_id into v_admin from public.profils_organisation po
    where po.organisation_id = v_demo and po.role = 'admin' order by po.created_at desc limit 1;
  select a.id into v_adh from public.adherents a
    where a.organisation_id = v_demo
      and not exists (select 1 from public.adhesions h where h.adherent_id = a.id and h.created_at > now() - interval '2 days')
      and not exists (select 1 from public.demandes_adhesion d where d.adherent_vise_id = a.id and d.statut = 'en_attente')
    order by a.created_at limit 1;
  select a.id into v_adh2 from public.adherents a
    where a.organisation_id = v_demo and a.id <> v_adh
      and not exists (select 1 from public.adhesions h where h.adherent_id = a.id and h.created_at > now() - interval '2 days')
    order by a.created_at limit 1;

  -- Liens envoyés hier (created_at d'une adhésion créée dans ce test = now() > cree_le).
  insert into public.liens_renouvellement (organisation_id, adherent_id, secret_hash, cree_le)
    values (v_demo, v_adh, v_valide, now() - interval '1 day');
  insert into public.liens_renouvellement (organisation_id, adherent_id, secret_hash, cree_le, expire_le)
    values (v_demo, v_adh2, v_expire, now() - interval '1 day', now() - interval '1 hour');
  insert into public.liens_renouvellement (organisation_id, adherent_id, secret_hash, cree_le, revoque_le)
    values (v_demo, v_adh2, v_revoque, now() - interval '1 day', now());
  insert into public.liens_renouvellement (organisation_id, adherent_id, secret_hash, cree_le)
    values (v_demo, v_adh, v_second, now() - interval '1 day');
  insert into public.liens_renouvellement (organisation_id, adherent_id, secret_hash, cree_le)
    values (v_demo, v_adh2, v_limite, now() - interval '1 day');

  -- 1. Entrées invalides et lien inconnu
  r := r || '1.hash_invalide=' || (public.lire_lien_renouvellement('pas-un-hash', v_ip, v_slug) ->> 'reason');
  v_res := public.lire_lien_renouvellement(repeat('f', 64), v_ip, v_slug);
  r := r || ' inconnu=' || (v_res ->> 'etat') || ' org=' || (v_res -> 'organisation' ->> 'nom' is not null)
    || ' sans_adherent=' || (v_res -> 'adherent' is null);

  -- 2. Lien valide : coordonnées sans date de naissance
  v_res := public.lire_lien_renouvellement(v_valide, v_ip, v_slug);
  r := r || ' | 2.valide=' || (v_res ->> 'etat') || ' nom=' || (v_res -> 'adherent' ->> 'nom' is not null)
    || ' sans_naissance=' || (not (v_res -> 'adherent') ? 'date_naissance')
    || ' sans_ids=' || (not (v_res ? 'adherent_id') and not (v_res ? 'lien_id'));

  -- 3. Autre slug, expiré, révoqué
  r := r || ' | 3.autre_slug=' || (public.lire_lien_renouvellement(v_valide, v_ip, v_slug || '-x') ->> 'etat');
  r := r || ' expire=' || (public.lire_lien_renouvellement(v_expire, v_ip, v_slug) ->> 'etat');
  r := r || ' revoque=' || (public.lire_lien_renouvellement(v_revoque, v_ip, v_slug) ->> 'etat');

  -- 4. Soumission : demande de renouvellement rattachée, lien utilisé, date de naissance ignorée
  v_demande := jsonb_build_object('civilite', 1, 'nom', 'TEST', 'prenom', 'Renouvellement', 'date_naissance', '1980-01-01',
    'adresse', '1 rue Test', 'code_postal', '75000', 'ville', 'Paris', 'pays', 'France', 'telephone', null,
    'courriel', null, 'signature_data_url', 'data:image/png;base64,AAAA', 'accepte_statuts', true, 'consent_rgpd', true);
  v_res := public.soumettre_renouvellement(v_valide, v_ip, v_slug, v_demande);
  v_demande_id := (v_res ->> 'demande_id')::uuid;
  r := r || ' | 4.envoi=' || (v_res ->> 'ok')
    || ' type=' || (select type || '/' || (adherent_vise_id = v_adh) || '/' || (date_naissance is null) || '/' || statut
                    from public.demandes_adhesion where id = v_demande_id)
    || ' lien_utilise=' || ((select utilise_le from public.liens_renouvellement where secret_hash = v_valide) is not null);

  -- 5. Après envoi : demande déjà envoyée (même lien et autre lien du même adhérent), renvoi refusé
  r := r || ' | 5.relecture=' || (public.lire_lien_renouvellement(v_valide, v_ip, v_slug) ->> 'etat');
  r := r || ' autre_lien=' || (public.lire_lien_renouvellement(v_second, v_ip, v_slug) ->> 'etat');
  v_res := public.soumettre_renouvellement(v_second, v_ip, v_slug, v_demande);
  r := r || ' renvoi=' || (v_res ->> 'ok') || '/' || (v_res ->> 'etat');
  v_res := public.soumettre_renouvellement(v_expire, v_ip, v_slug, v_demande);
  r := r || ' envoi_expire=' || (v_res ->> 'ok') || '/' || (v_res ->> 'etat');

  -- 6. Demande refusée : lien utilisé → invalide ; autre lien encore valide
  update public.demandes_adhesion set statut = 'refusee' where id = v_demande_id;
  r := r || ' | 6.refusee=' || (public.lire_lien_renouvellement(v_valide, v_ip, v_slug) ->> 'etat');
  r := r || ' autre_lien=' || (public.lire_lien_renouvellement(v_second, v_ip, v_slug) ->> 'etat');

  -- 7. Adhésion créée après l'envoi du lien : déjà renouvelé, avec la date de fin
  insert into public.adhesions (adherent_id, date_debut, date_fin, renouvellement)
    values (v_adh, current_date, (current_date + interval '1 year')::date, true);
  v_res := public.lire_lien_renouvellement(v_valide, v_ip, v_slug);
  r := r || ' | 7.renouvele=' || (v_res ->> 'etat') || ' date_fin=' || coalesce(v_res ->> 'date_fin', 'NULL');

  -- 8. Contraintes : adhésion sans adhérent visé, une seule demande en attente par adhérent
  begin
    insert into public.demandes_adhesion (organisation_id, type, adherent_vise_id, nom, code_postal, signature_data_url, accepte_statuts, consent_rgpd)
      values (v_demo, 'adhesion', v_adh, 'X', '75000', 'data:image/png;base64,AAAA', true, true);
    r := r || ' | 8.adhesion_avec_vise=ACCEPTE(KO)';
  exception when check_violation then r := r || ' | 8.adhesion_avec_vise=refuse';
  end;
  insert into public.demandes_adhesion (organisation_id, type, adherent_vise_id, nom, code_postal, signature_data_url, accepte_statuts, consent_rgpd)
    values (v_demo, 'renouvellement', v_adh2, 'X', '75000', 'data:image/png;base64,AAAA', true, true);
  begin
    insert into public.demandes_adhesion (organisation_id, type, adherent_vise_id, nom, code_postal, signature_data_url, accepte_statuts, consent_rgpd)
      values (v_demo, 'renouvellement', v_adh2, 'X', '75000', 'data:image/png;base64,AAAA', true, true);
    r := r || ' deux_en_attente=ACCEPTE(KO)';
  exception when unique_violation then r := r || ' deux_en_attente=refuse';
  end;

  -- 9. Limite par lien : 20 lectures / 10 min (IP différente à chaque fois)
  for i in 1..21 loop
    v_res := public.lire_lien_renouvellement(v_limite, lpad(to_hex(i), 64, '0'), v_slug);
  end loop;
  r := r || ' | 9.limite_lien=' || coalesce(v_res ->> 'reason', v_res ->> 'etat');
  -- Limite par IP : 30 lectures / 10 min (liens inconnus différents)
  for i in 1..31 loop
    v_res := public.lire_lien_renouvellement(lpad(to_hex(i), 64, 'f'), repeat('2', 64), v_slug);
  end loop;
  r := r || ' limite_ip=' || coalesce(v_res ->> 'reason', v_res ->> 'etat');

  -- 10. Session bénévole, admin et anonyme : aucune RPC
  perform set_config('request.jwt.claims', json_build_object('sub', v_benevole, 'role', 'authenticated',
    'app_metadata', json_build_object('role', 'benevole', 'organisation_id', v_demo))::text, true);
  execute 'set local role authenticated';
  begin
    perform public.lire_lien_renouvellement(v_second, v_ip, v_slug);
    r := r || ' | 10.benevole_lire=ACCEPTE(KO)';
  exception when insufficient_privilege then r := r || ' | 10.benevole_lire=refuse';
  end;
  begin
    perform public.soumettre_renouvellement(v_second, v_ip, v_slug, v_demande);
    r := r || ' benevole_soumettre=ACCEPTE(KO)';
  exception when insufficient_privilege then r := r || ' benevole_soumettre=refuse';
  end;
  begin
    perform public.resoudre_lien_renouvellement(v_second, v_slug);
    r := r || ' benevole_resoudre=ACCEPTE(KO)';
  exception when insufficient_privilege then r := r || ' benevole_resoudre=refuse';
  end;
  execute 'reset role';

  perform set_config('request.jwt.claims', json_build_object('sub', v_admin, 'role', 'authenticated', 'app_metadata', json_build_object())::text, true);
  execute 'set local role authenticated';
  begin
    perform public.lire_lien_renouvellement(v_second, v_ip, v_slug);
    r := r || ' admin_lire=ACCEPTE(KO)';
  exception when insufficient_privilege then r := r || ' admin_lire=refuse';
  end;
  execute 'reset role';

  perform set_config('request.jwt.claims', json_build_object('role', 'anon')::text, true);
  execute 'set local role anon';
  begin
    perform public.soumettre_renouvellement(v_second, v_ip, v_slug, v_demande);
    r := r || ' anon_soumettre=ACCEPTE(KO)';
  exception when insufficient_privilege then r := r || ' anon_soumettre=refuse';
  end;
  begin
    perform public.limite_renouvellement_depassee(v_ip, v_second, 'renouvellement_lecture_ip', 'renouvellement_lecture_lien', 1, 1, interval '1 minute');
    r := r || ' anon_limite=ACCEPTE(KO)';
  exception when insufficient_privilege then r := r || ' anon_limite=refuse';
  end;
  execute 'reset role';

  raise exception 'RESULTATS: %', r;
end;
$$;
