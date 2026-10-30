-- Tests du verrou d'identité des reçus fiscaux (recus_fiscaux_immutabilite.sql) — staging uniquement :
--   npx supabase db query --linked -f supabase/tests/recus_fiscaux_immutabilite.sql
-- Bloc terminé par une exception : rien n'est conservé. Dépend de l'org « Association Démo
-- Staging » (au moins deux participants) et d'une seconde organisation quelconque.
-- Les écritures simulent generate-recu (service_role) : insert … on conflict (profil_participant_id,
-- annee) do update set … ; année 1900 pour ne croiser aucun reçu réel.
do $$
declare
  v_demo uuid; v_autre_org uuid; v_p1 uuid; v_p2 uuid; v_id uuid; v_id_null uuid;
  v_num text; v_montant numeric; r text := '';
begin
  select id into v_demo from public.organisations where nom = 'Association Démo Staging';
  select id into v_autre_org from public.organisations where id <> v_demo order by created_at limit 1;
  select id into v_p1 from public.profils_participant where organisation_id = v_demo order by id limit 1;
  select id into v_p2 from public.profils_participant where organisation_id = v_demo and id <> v_p1 order by id limit 1;

  execute 'set local role service_role';

  -- 1. Première génération (numéro attribué)
  insert into public.recus_fiscaux as rf (profil_participant_id, organisation_id, annee, montant_total,
      fichier_url, date_generation, numero_ordre, type_cerfa)
    values (v_p1, v_demo, 1900, 100, 'test/1900.pdf', now(), '1900-001', '11580')
    on conflict (profil_participant_id, annee) do update set montant_total = excluded.montant_total
    returning id into v_id;
  r := r || '1.generation=ok';

  -- 2. Régénération à l'identique (même numéro, même montant) : acceptée
  begin
    insert into public.recus_fiscaux (profil_participant_id, organisation_id, annee, montant_total,
        fichier_url, date_generation, numero_ordre, type_cerfa)
      values (v_p1, v_demo, 1900, 100, 'test/1900.pdf', now(), '1900-001', '11580')
      on conflict (profil_participant_id, annee) do update set
        organisation_id = excluded.organisation_id, montant_total = excluded.montant_total,
        fichier_url = excluded.fichier_url, date_generation = excluded.date_generation,
        numero_ordre = excluded.numero_ordre, type_cerfa = excluded.type_cerfa;
    r := r || ' | 2.regen_identique=accepte';
  exception when check_violation then r := r || ' | 2.regen_identique=REFUSE(KO)';
  end;

  -- 3. Régénération au même numéro avec un nouveau montant : acceptée
  begin
    insert into public.recus_fiscaux (profil_participant_id, organisation_id, annee, montant_total,
        fichier_url, date_generation, numero_ordre, type_cerfa, email_envoye_at)
      values (v_p1, v_demo, 1900, 250, 'test/1900-v2.pdf', now(), '1900-001', '16216', null)
      on conflict (profil_participant_id, annee) do update set
        organisation_id = excluded.organisation_id, montant_total = excluded.montant_total,
        fichier_url = excluded.fichier_url, date_generation = excluded.date_generation,
        numero_ordre = excluded.numero_ordre, type_cerfa = excluded.type_cerfa;
    select numero_ordre, montant_total into v_num, v_montant from public.recus_fiscaux where id = v_id;
    r := r || ' | 3.regen_nouveau_montant=accepte(' || v_num || ',' || v_montant || ')';
  exception when check_violation then r := r || ' | 3.regen_nouveau_montant=REFUSE(KO)';
  end;

  -- 4. Mise à jour d'email_envoye_at (send-recu-email) : acceptée
  begin
    update public.recus_fiscaux set email_envoye_at = now() where id = v_id;
    r := r || ' | 4.email_envoye_at=accepte';
  exception when check_violation then r := r || ' | 4.email_envoye_at=REFUSE(KO)';
  end;

  -- 5. Premier remplissage d'un numero_ordre NULL : accepté
  insert into public.recus_fiscaux (profil_participant_id, organisation_id, annee, montant_total, numero_ordre)
    values (v_p2, v_demo, 1900, 10, null) returning id into v_id_null;
  begin
    insert into public.recus_fiscaux (profil_participant_id, organisation_id, annee, montant_total, numero_ordre)
      values (v_p2, v_demo, 1900, 10, '1900-002')
      on conflict (profil_participant_id, annee) do update set
        montant_total = excluded.montant_total, numero_ordre = excluded.numero_ordre;
    r := r || ' | 5.remplissage_numero_null=accepte';
  exception when check_violation then r := r || ' | 5.remplissage_numero_null=REFUSE(KO)';
  end;

  -- 6. Changement de numéro (upsert avec un autre numéro) : refusé
  begin
    insert into public.recus_fiscaux (profil_participant_id, organisation_id, annee, montant_total, numero_ordre)
      values (v_p1, v_demo, 1900, 250, '1900-099')
      on conflict (profil_participant_id, annee) do update set numero_ordre = excluded.numero_ordre;
    r := r || ' | 6.changement_numero=ACCEPTE(KO)';
  exception when check_violation then r := r || ' | 6.changement_numero=refuse';
  end;

  -- 7. Effacement du numéro (NULL) : refusé
  begin
    update public.recus_fiscaux set numero_ordre = null where id = v_id;
    r := r || ' | 7.numero_null=ACCEPTE(KO)';
  exception when check_violation then r := r || ' | 7.numero_null=refuse';
  end;

  -- 8. Changement d'organisation : refusé
  begin
    update public.recus_fiscaux set organisation_id = v_autre_org where id = v_id;
    r := r || ' | 8.changement_org=ACCEPTE(KO)';
  exception when check_violation then r := r || ' | 8.changement_org=refuse';
  end;

  -- 9. Changement de participant : refusé
  begin
    update public.recus_fiscaux set profil_participant_id = v_p2, annee = 1901 where id = v_id;
    r := r || ' | 9.changement_participant=ACCEPTE(KO)';
  exception when check_violation then r := r || ' | 9.changement_participant=refuse';
  end;

  -- 10. Changement d'année : refusé
  begin
    update public.recus_fiscaux set annee = 1901 where id = v_id;
    r := r || ' | 10.changement_annee=ACCEPTE(KO)';
  exception when check_violation then r := r || ' | 10.changement_annee=refuse';
  end;

  -- 11. Suppression (cascades participant / organisation) : non concernée
  begin
    delete from public.recus_fiscaux where id in (v_id, v_id_null);
    r := r || ' | 11.suppression=accepte';
  exception when others then r := r || ' | 11.suppression=REFUSE(KO) ' || sqlerrm;
  end;

  raise exception 'RESULTATS: %', r;
end;
$$;
