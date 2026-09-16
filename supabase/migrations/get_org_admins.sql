-- Ce fichier est à exécuter manuellement dans le Supabase SQL Editor.
-- Il crée une fonction PostgreSQL sécurisée (security definer) qui retourne
-- la liste des comptes (admin + contributeur) d'une organisation, réservée
-- aux super-admins et à l'admin de cette organisation (cf.
-- contributeur_role.sql — un contributeur n'a pas ce droit).

create or replace function get_org_admins(org_id uuid)
returns table(
  utilisateur_id uuid,
  nom_affiche text,
  email text,
  role text,
  created_at timestamptz,
  is_banned boolean
)
language plpgsql
security definer
as $$
begin
  if not (
    (auth.jwt() -> 'app_metadata' ->> 'is_super_admin')::boolean = true
    or (current_user_role() = 'admin' and current_user_organisation_id() = org_id)
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
      (au.banned_until is not null and au.banned_until > now()) as is_banned
    from profils_organisation po
    join auth.users au on au.id = po.utilisateur_id
    where po.organisation_id = org_id
      and po.role in ('admin', 'contributeur')
    order by po.created_at asc;
end;
$$;
