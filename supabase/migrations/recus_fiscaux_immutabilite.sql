-- Migration: recus_fiscaux_immutabilite.sql
-- Cadré 2026-10-30 (audit sécurité 2026-10-24, suite de recus_lecture_seule.sql).
-- Verrouille en base l'identité d'un reçu fiscal émis, pour tous les rôles (service_role compris) :
--   - numero_ordre : définitif une fois attribué (docs/regles-recus-fiscaux.md §4) ; seul le premier
--     remplissage d'une valeur NULL est permis ;
--   - organisation_id, profil_participant_id, annee : jamais modifiés.
-- Restent modifiables (régénération §5, upsert de generate-recu au même numéro) : montant_total,
-- fichier_url, date_generation, template_id, type_cerfa, snapshots, email_envoye_at.
-- Les suppressions (cascades participant / organisation) ne sont pas concernées.
begin;

create or replace function public.recus_fiscaux_verrou_identite()
returns trigger
language plpgsql
set search_path = ''
as $$
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
$$;

drop trigger if exists recus_fiscaux_verrou_identite on public.recus_fiscaux;

create trigger recus_fiscaux_verrou_identite
  before update on public.recus_fiscaux
  for each row
  execute function public.recus_fiscaux_verrou_identite();

commit;
