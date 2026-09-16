-- Nouveau rôle "contributeur" : créé par un admin depuis sa page de
-- paramètres, mêmes droits fonctionnels que l'admin mais aucun droit de
-- gestion des comptes (réservée à l'admin). Le rôle "admin" ne change pas
-- de comportement, toujours créé uniquement par le super-admin.

-- ---------------------------------------------------------
-- 1. Étendre la contrainte de rôle
-- ---------------------------------------------------------
alter table profils_organisation
  drop constraint if exists profils_organisation_role_check;
alter table profils_organisation
  add constraint profils_organisation_role_check
  check (role in ('admin', 'contributeur'));

-- ---------------------------------------------------------
-- 2. Préférence de notification (colonne posée maintenant, logique
--    d'envoi ajoutée par une carte séparée pas encore développée)
-- ---------------------------------------------------------
alter table profils_organisation
  add column if not exists notif_demandes_adhesion boolean not null default true,
  add column if not exists notif_demandes_adhesion_updated_at timestamptz;

comment on column profils_organisation.notif_demandes_adhesion is
  'Opt-out des notifications email de nouvelles demandes d''adhésion — géré depuis /admin/parametres/compte';

-- ---------------------------------------------------------
-- 3. Fermer une faille RLS préexistante
--
-- L'ancienne policy "profils_org_all_admin" (for all, sans WITH CHECK)
-- donnait à tout compte authentifié un accès direct INSERT/UPDATE/DELETE
-- sur n'importe quelle ligne de son organisation via l'API REST. Limité
-- jusqu'ici par la contrainte CHECK à une seule valeur de role possible —
-- désormais qu'il y a deux valeurs, un compte pourrait s'auto-promouvoir
-- 'admin' via un simple .update({role:'admin'}) (escalade de privilège :
-- admin peut gérer des comptes, contributeur non). Vérifié qu'aucun code
-- frontend n'écrit directement sur cette table aujourd'hui (tout passe par
-- les Edge Functions en service_role, qui contournent RLS de toute façon).
-- ---------------------------------------------------------

drop policy if exists "profils_org_all_admin" on profils_organisation;
-- profils_org_select (lecture, org-scopée + bypass super-admin) inchangée.

create policy "profils_org_update_self" on profils_organisation
  for update
  using (utilisateur_id = auth.uid())
  with check (utilisateur_id = auth.uid());

-- Pas de policy INSERT/DELETE pour authenticated : refus par défaut.
-- Toute création/suppression passe par les Edge Functions (service_role,
-- qui contourne RLS et les grants ci-dessous).

-- Restriction colonne : RLS n'a pas de granularité colonne, donc même sur
-- sa propre ligne un compte authentifié ne doit pas pouvoir écrire role/
-- organisation_id. On retire tous les grants UPDATE et on ne redonne que
-- les colonnes réellement éditables en self-service.
revoke update on profils_organisation from authenticated;
grant update (nom_affiche, notif_demandes_adhesion, notif_demandes_adhesion_updated_at)
  on profils_organisation to authenticated;

-- Défense en profondeur : invariants OLD vs NEW qu'aucune policy/grant ne
-- peut exprimer proprement. No-op sous service_role (auth.uid() y est
-- null), n'affecte donc pas les Edge Functions.
create or replace function prevent_profils_organisation_tampering()
returns trigger as $$
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
$$ language plpgsql;

drop trigger if exists trg_profils_organisation_tampering on profils_organisation;
create trigger trg_profils_organisation_tampering
before update on profils_organisation
for each row execute function prevent_profils_organisation_tampering();

-- ---------------------------------------------------------
-- 4. Helper : rôle du compte courant (même pattern que
--    current_user_organisation_id(), utilisé par get_org_admins.sql)
-- ---------------------------------------------------------
create or replace function current_user_role()
returns text as $$
  select role from profils_organisation
  where utilisateur_id = auth.uid()
  limit 1;
$$ language sql stable security definer;
