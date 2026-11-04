-- Tests de recus_email_brevo.sql — staging uniquement :
--   npx supabase db query --linked -f supabase/tests/recus_email_brevo.sql
-- Bloc terminé par une exception : rien n'est conservé. Dépend de l'org « Association Démo
-- Staging » (au moins un profil participant avec une personne).
do $$
declare v_demo uuid; v_profil uuid; v_personne uuid; v_recu uuid; r text := ''; v_at timestamptz;
begin
  select id into v_demo from public.organisations where nom = 'Association Démo Staging';
  select pp.id, pp.personne_id into v_profil, v_personne from public.profils_participant pp
    where pp.organisation_id = v_demo order by pp.created_at limit 1;

  -- 1. Changer l'email de la personne efface le marquage « email invalide » de ses profils
  update public.profils_participant set email_invalide_at = now(), email_invalide_evenement = 'hard_bounce'
    where id = v_profil;
  update public.personnes set nom = nom where id = v_personne;
  select email_invalide_at into v_at from public.profils_participant where id = v_profil;
  r := r || '1.autre_colonne=' || case when v_at is not null then 'conserve' else 'EFFACE(KO)' end;
  update public.personnes set email = coalesce(email, '') || '.test' where id = v_personne;
  select email_invalide_at into v_at from public.profils_participant where id = v_profil;
  r := r || ' email_change=' || case when v_at is null then 'efface' else 'CONSERVE(KO)' end;

  -- 2. email_canal : brevo / resend acceptés, toute autre valeur refusée
  select id into v_recu from public.recus_fiscaux where organisation_id = v_demo limit 1;
  if v_recu is not null then
    update public.recus_fiscaux set email_canal = 'brevo' where id = v_recu;
    update public.recus_fiscaux set email_canal = 'resend' where id = v_recu;
    begin
      update public.recus_fiscaux set email_canal = 'autre' where id = v_recu;
      r := r || ' | 2.canal_autre=ACCEPTE(KO)';
    exception when check_violation then r := r || ' | 2.canal_autre=refuse';
    end;
  end if;

  raise exception 'RESULTATS: %', r;
end;
$$;
