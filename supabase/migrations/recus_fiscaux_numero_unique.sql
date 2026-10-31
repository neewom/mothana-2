-- Migration: recus_fiscaux_numero_unique.sql
-- 2026-10-31 (PR #320, format du numéro de reçu ; couvre aussi https://trello.com/c/oQFyp7f7).
-- Un numéro de reçu (numero_ordre) est unique dans une organisation : il sert aussi de nom au PDF
-- dans le Storage (<organisation>/<année>/<numéro>.pdf). Deux formats mélangés dans une même année
-- (séquence 2026-001 et « année + numéro de donateur » 2026-1) pourraient sinon produire deux
-- reçus au même numéro. L'Edge Function generate-recu renvoie un 409 lisible sur cette violation.
-- Les reçus sans numéro (numero_ordre NULL) ne sont pas concernés (index partiel).
-- Doublons existants : la migration échoue explicitement, sans rien créer (à corriger d'abord,
-- en désactivant le trigger recus_fiscaux_verrou_identite le temps de l'opération).
begin;

do $$
declare v_doublons text;
begin
  select string_agg(organisation_id || ' / ' || numero_ordre || ' (' || n || ' reçus)', ', ')
    into v_doublons
    from (
      select organisation_id, numero_ordre, count(*) as n
        from public.recus_fiscaux
       where numero_ordre is not null
       group by organisation_id, numero_ordre
      having count(*) > 1
    ) d;
  if v_doublons is not null then
    raise exception 'recus_fiscaux_numero_unique : numéros de reçu en doublon, à corriger avant la migration : %', v_doublons;
  end if;
end;
$$;

create unique index if not exists recus_fiscaux_organisation_numero_ordre_key
  on public.recus_fiscaux (organisation_id, numero_ordre)
  where numero_ordre is not null;

commit;
