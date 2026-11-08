-- Page publique de renouvellement d'adhésion (épique Renouvellement, carte 2/3, 2026-10-30).
-- L'adhérent ouvre /adhesion/<slug>/renouveler#<secret> (lien de liens_renouvellement, carte 1/3) :
--   - lire_lien_renouvellement : état du lien et données préremplies (Edge Function
--     lire-renouvellement-adhesion) ;
--   - soumettre_renouvellement : crée la demande de renouvellement rattachée à l'adhérent et marque
--     le lien utilisé, en une transaction (Edge Function soumettre-renouvellement-adhesion).
-- Modèle de sécurité du porte-monnaie (lire_portefeuille_par_secret_hash) : seule l'empreinte
-- SHA-256 du secret arrive au serveur, RPC réservées à service_role, limites par IP (empreinte HMAC)
-- et par lien (empreinte du secret), aucune distinction inconnu / révoqué / utilisé.
--
-- États d'un lien (resoudre_lien_renouvellement), dans cet ordre :
--   lien_invalide  : inconnu, autre organisation que le slug, organisation archivée, révoqué ;
--   deja_renouvele : une adhésion de l'adhérent a été créée après l'envoi du lien (date_fin renvoyée) ;
--   deja_envoye    : une demande de renouvellement de l'adhérent est en attente ;
--   lien_invalide  : lien déjà utilisé (demande traitée sans nouvelle adhésion, ex. refusée) ;
--   lien_expire    : 90 jours écoulés ;
--   valide.
begin;

-- 1. Demandes : type et adhérent visé (renseigné pour un renouvellement uniquement ;
-- adherent_id reste l'adhérent rattaché à la ratification, carte 3/3).
alter table public.demandes_adhesion
  add column if not exists type text not null default 'adhesion',
  add column if not exists adherent_vise_id uuid references public.adherents(id) on delete set null;

alter table public.demandes_adhesion drop constraint if exists demandes_adhesion_type_check;
alter table public.demandes_adhesion
  add constraint demandes_adhesion_type_check check (type in ('adhesion', 'renouvellement'));

-- Une adhésion simple ne vise aucun adhérent (un renouvellement peut perdre le sien si
-- l'adhérent est supprimé : on delete set null).
alter table public.demandes_adhesion drop constraint if exists demandes_adhesion_adherent_vise_check;
alter table public.demandes_adhesion
  add constraint demandes_adhesion_adherent_vise_check check (type = 'renouvellement' or adherent_vise_id is null);

-- Une seule demande de renouvellement en attente par adhérent.
create unique index if not exists uq_demandes_adhesion_renouvellement_en_attente
  on public.demandes_adhesion(adherent_vise_id)
  where type = 'renouvellement' and statut = 'en_attente';

-- L'adhérent visé appartient à l'organisation de la demande (modifiable par un admin via RLS).
create or replace function public.demandes_adhesion_verifier_adherent_vise()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.adherent_vise_id is not null and not coalesce(exists (
    select 1 from public.adherents a where a.id = new.adherent_vise_id and a.organisation_id = new.organisation_id
  ), false) then
    raise exception 'Adhérent hors organisation' using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_demandes_adhesion_adherent_vise on public.demandes_adhesion;
create trigger trg_demandes_adhesion_adherent_vise
  before insert or update of adherent_vise_id, organisation_id on public.demandes_adhesion
  for each row execute function public.demandes_adhesion_verifier_adherent_vise();

revoke all on function public.demandes_adhesion_verifier_adherent_vise() from public, anon, authenticated;

-- 2. Limites de débit : table déjà utilisée par le porte-monnaie, verify-pin, la demande
-- d'adhésion, la réinitialisation de mot de passe et l'achat simulé (scopes conservés).
alter table public.acces_portefeuille_rate_limits
  drop constraint if exists acces_portefeuille_rate_limits_scope_check;

alter table public.acces_portefeuille_rate_limits
  add constraint acces_portefeuille_rate_limits_scope_check
  check (scope in ('etat', 'pdf', 'verify_pin', 'demande_adhesion', 'reset_mdp_ip', 'reset_mdp_email',
                   'simulation_achat_ip', 'simulation_achat_email',
                   'renouvellement_lecture_ip', 'renouvellement_lecture_lien',
                   'renouvellement_envoi_ip', 'renouvellement_envoi_lien'));

-- Compte un appel (IP et lien) et dit si une limite est dépassée. Interne : appelée par les deux
-- RPC ci-dessous seulement. Le lien est compté par l'empreinte reçue, connue ou non.
create or replace function public.limite_renouvellement_depassee(
  p_ip_hash text,
  p_secret_hash text,
  p_scope_ip text,
  p_scope_lien text,
  p_max_ip integer,
  p_max_lien integer,
  p_fenetre interval
)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
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
$$;

-- 3. État d'un lien (interne, sans limite de débit).
create or replace function public.resoudre_lien_renouvellement(p_secret_hash text, p_slug text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
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
$$;

-- 4. Lecture par la page publique : organisation (champs publics du formulaire, comme
-- get_organisation_public) et, pour un lien valide seulement, coordonnées de l'adhérent
-- (jamais la date de naissance).
create or replace function public.lire_lien_renouvellement(p_secret_hash text, p_ip_hash text, p_slug text)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
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
$$;

-- 5. Soumission : la demande (déjà validée par l'Edge Function avec la validation du formulaire
-- d'adhésion) est enregistrée en renouvellement de l'adhérent du lien, et le lien est marqué
-- utilisé, dans la même transaction. Date de naissance jamais reprise du client.
create or replace function public.soumettre_renouvellement(
  p_secret_hash text,
  p_ip_hash text,
  p_slug text,
  p_demande jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
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
$$;

revoke all on function public.limite_renouvellement_depassee(text, text, text, text, integer, integer, interval) from public, anon, authenticated;
revoke all on function public.resoudre_lien_renouvellement(text, text) from public, anon, authenticated;
revoke all on function public.lire_lien_renouvellement(text, text, text) from public, anon, authenticated;
revoke all on function public.soumettre_renouvellement(text, text, text, jsonb) from public, anon, authenticated;
grant execute on function public.limite_renouvellement_depassee(text, text, text, text, integer, integer, interval) to service_role;
grant execute on function public.resoudre_lien_renouvellement(text, text) to service_role;
grant execute on function public.lire_lien_renouvellement(text, text, text) to service_role;
grant execute on function public.soumettre_renouvellement(text, text, text, jsonb) to service_role;

commit;
