-- =========================================================
-- MOTHANA - Schéma de base de données (Supabase / PostgreSQL)
-- =========================================================
-- Ce script crée :
--   1. Les tables principales
--   2. Les triggers utilitaires (updated_at)
--   3. L'activation de RLS + policies
--   4. Un jeu de données de démo (seed)
-- =========================================================
-- Mise à jour 2026-08-09 : ce fichier était le script de conception
-- d'origine (MVP), jamais tenu à jour au fil des ~40 migrations ad hoc
-- exécutées depuis (supabase/migrations/, appliquées à la main via
-- `supabase db query --linked`, pas de format horodaté CLI). Colonnes
-- ajoutées depuis inlinées directement dans les CREATE TABLE ci-dessous
-- (organisations, recus_fiscaux) ; nouvelles tables regroupées section 4.
-- ⚠️ La section 2 (RLS) ci-dessous reflète les policies **d'origine** des
-- 7 tables historiques : elles ont depuis été réécrites pour la
-- performance (rls_auth_initplan_perf.sql) et étendues avec un bypass
-- super-admin (super_admin_rls.sql), non répercuté ici pour éviter de
-- reproduire le même problème de dérive — se référer directement aux
-- fichiers de migration pour le texte exact des policies en prod.
-- ⚠️ Ce fichier n'est plus exécutable tel quel de bout en bout (la table
-- recus_fiscaux référence templates_recu, définie section 4 plus bas) :
-- c'est un document de référence sur l'état du schéma, pas un script
-- d'installation — la prod a été construite par migrations incrémentales.
-- =========================================================

-- ---------------------------------------------------------
-- EXTENSIONS
-- ---------------------------------------------------------
create extension if not exists "uuid-ossp";

-- ---------------------------------------------------------
-- FONCTION UTILITAIRE : updated_at automatique
-- ---------------------------------------------------------
create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

-- =========================================================
-- 1. TABLES
-- =========================================================

-- ---------------------------------------------------------
-- organisations
-- ---------------------------------------------------------
create table organisations (
  id uuid primary key default uuid_generate_v4(),
  nom text not null,
  modele_recu_pdf jsonb default '{}'::jsonb, -- rna/siren/objet_social/mention_legale/numero_recu_depart/taux_reduction/president_nom/president_titre (pas de colonnes dédiées, cf. organisations_adresse_fiscale.sql)
  code_pin_benevole text unique,
  -- Adresse fiscale structurée (organisations_adresse_fiscale.sql, refonte Cerfa §1.1)
  adresse text,
  code_postal text,
  ville text,
  pays text default 'France',
  -- Formulaire public de demande d'adhésion (organisations_slug_statuts.sql, formulaire_adhesion_header_footer.sql, formulaire_adhesion_message_succes.sql)
  slug text unique not null,
  statuts_url text,
  formulaire_adhesion_header_html text,
  formulaire_adhesion_footer_html text,
  formulaire_adhesion_css text,
  formulaire_adhesion_message_succes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger trg_organisations_updated_at
before update on organisations
for each row execute function set_updated_at();

-- ---------------------------------------------------------
-- profils_organisation (admins liés à une organisation)
-- ---------------------------------------------------------
create table profils_organisation (
  id uuid primary key default uuid_generate_v4(),
  utilisateur_id uuid not null references auth.users(id) on delete cascade,
  organisation_id uuid not null references organisations(id) on delete cascade,
  nom_affiche text,
  role text not null default 'admin' check (role in ('admin')),
  created_at timestamptz not null default now(),
  unique (utilisateur_id, organisation_id)
);

-- ---------------------------------------------------------
-- personnes (identité globale d'un participant)
-- ---------------------------------------------------------
create table personnes (
  id uuid primary key default uuid_generate_v4(),
  nom text not null,
  prenom text,
  email text,
  telephone text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger trg_personnes_updated_at
before update on personnes
for each row execute function set_updated_at();

-- ---------------------------------------------------------
-- profils_participant (profil d'une personne dans une organisation)
-- ---------------------------------------------------------
create table profils_participant (
  id uuid primary key default uuid_generate_v4(),
  personne_id uuid not null references personnes(id) on delete cascade,
  organisation_id uuid not null references organisations(id) on delete cascade,
  notes text,
  created_at timestamptz not null default now(),
  unique (personne_id, organisation_id)
);

-- ---------------------------------------------------------
-- activites
-- ---------------------------------------------------------
create table activites (
  id uuid primary key default uuid_generate_v4(),
  organisation_id uuid not null references organisations(id) on delete cascade,
  nom text not null,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------
-- dons
-- ---------------------------------------------------------
create table dons (
  id uuid primary key default uuid_generate_v4(),
  profil_participant_id uuid not null references profils_participant(id) on delete cascade,
  organisation_id uuid not null references organisations(id) on delete cascade,
  activite_id uuid references activites(id) on delete set null,
  montant numeric(10,2) not null check (montant > 0),
  date date not null default current_date,
  mode_paiement text not null check (mode_paiement in ('virement', 'cheque', 'especes')),
  created_by_role text not null default 'admin' check (created_by_role in ('admin', 'benevole')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger trg_dons_updated_at
before update on dons
for each row execute function set_updated_at();

create index idx_dons_organisation on dons(organisation_id);
create index idx_dons_profil_participant on dons(profil_participant_id);
create index idx_dons_date on dons(date);

-- ---------------------------------------------------------
-- recus_fiscaux
-- ---------------------------------------------------------
create table recus_fiscaux (
  id uuid primary key default uuid_generate_v4(),
  profil_participant_id uuid not null references profils_participant(id) on delete cascade,
  organisation_id uuid not null references organisations(id) on delete cascade,
  annee integer not null,
  montant_total numeric(10,2) not null,
  fichier_url text,
  date_generation timestamptz not null default now(),
  -- Refonte Cerfa §1.4 (recus_fiscaux_cerfa_fields.sql) : traçabilité, le reçu ne doit pas
  -- changer rétroactivement si le donateur/l'organisation sont modifiés ensuite
  numero_ordre text,
  type_cerfa text check (type_cerfa in ('11580', '16216')),
  template_id uuid references templates_recu(id) on delete set null,
  snapshot_donateur jsonb,
  snapshot_organisation jsonb,
  email_envoye_at timestamptz,
  unique (profil_participant_id, annee)
);

create index idx_recus_organisation on recus_fiscaux(organisation_id);


-- =========================================================
-- 2. ROW LEVEL SECURITY (RLS)
-- =========================================================
-- Principe :
--  - Un admin (auth.users) accède uniquement aux données de SON organisation,
--    déterminée via profils_organisation.
--  - L'accès "bénévole" se fait via un compte technique partagé : on utilise
--    un JWT custom claim "organisation_id" + "role" = 'benevole'
--    (à injecter via une Edge Function de login PIN, voir plan de dev).
--  - On définit une fonction helper pour récupérer l'organisation_id du
--    contexte courant, qu'il s'agisse d'un admin ou d'un bénévole.

-- ---------------------------------------------------------
-- Fonction helper : organisation_id courant (admin)
-- ---------------------------------------------------------
create or replace function current_user_organisation_id()
returns uuid as $$
  select organisation_id
  from profils_organisation
  where utilisateur_id = auth.uid()
  limit 1;
$$ language sql stable security definer;

-- ---------------------------------------------------------
-- Fonction helper : organisation_id courant (bénévole, via JWT claim)
-- ---------------------------------------------------------
create or replace function current_benevole_organisation_id()
returns uuid as $$
  select (auth.jwt() -> 'app_metadata' ->> 'organisation_id')::uuid
  where (auth.jwt() -> 'app_metadata' ->> 'role') = 'benevole';
$$ language sql stable;

-- ---------------------------------------------------------
-- Fonction helper : organisation_id effectif (admin OU bénévole)
-- ---------------------------------------------------------
create or replace function current_effective_organisation_id()
returns uuid as $$
  select coalesce(
    current_user_organisation_id(),
    current_benevole_organisation_id()
  );
$$ language sql stable;

-- ---------------------------------------------------------
-- Activation RLS
-- ---------------------------------------------------------
alter table organisations enable row level security;
alter table profils_organisation enable row level security;
alter table personnes enable row level security;
alter table profils_participant enable row level security;
alter table activites enable row level security;
alter table dons enable row level security;
alter table recus_fiscaux enable row level security;

-- ---------------------------------------------------------
-- organisations : lecture/écriture uniquement sur sa propre organisation
-- ---------------------------------------------------------
create policy "org_select" on organisations
  for select using (id = current_effective_organisation_id());

create policy "org_update_admin" on organisations
  for update using (id = current_user_organisation_id());

-- ---------------------------------------------------------
-- profils_organisation : visible uniquement par les admins de l'organisation
-- ---------------------------------------------------------
create policy "profils_org_select" on profils_organisation
  for select using (organisation_id = current_user_organisation_id());

create policy "profils_org_all_admin" on profils_organisation
  for all using (organisation_id = current_user_organisation_id());

-- ---------------------------------------------------------
-- personnes : accès via profils_participant de l'organisation courante
-- (table sans organisation_id direct -> on passe par une sous-requête)
-- ---------------------------------------------------------
create policy "personnes_select" on personnes
  for select using (
    exists (
      select 1 from profils_participant pp
      where pp.personne_id = personnes.id
        and pp.organisation_id = current_effective_organisation_id()
    )
  );

create policy "personnes_insert" on personnes
  for insert with check (true); -- création libre, le profil associé est restreint par ailleurs

create policy "personnes_update" on personnes
  for update using (
    exists (
      select 1 from profils_participant pp
      where pp.personne_id = personnes.id
        and pp.organisation_id = current_effective_organisation_id()
    )
  );

-- ---------------------------------------------------------
-- profils_participant : segmenté par organisation
-- ---------------------------------------------------------
create policy "profils_participant_select" on profils_participant
  for select using (organisation_id = current_effective_organisation_id());

create policy "profils_participant_insert" on profils_participant
  for insert with check (organisation_id = current_effective_organisation_id());

create policy "profils_participant_update_admin" on profils_participant
  for update using (organisation_id = current_user_organisation_id());

-- ---------------------------------------------------------
-- activites : lecture pour admin + bénévole, écriture admin uniquement
-- ---------------------------------------------------------
create policy "activites_select" on activites
  for select using (organisation_id = current_effective_organisation_id());

create policy "activites_write_admin" on activites
  for all using (organisation_id = current_user_organisation_id());

-- ---------------------------------------------------------
-- dons : lecture admin uniquement (le bénévole ne consulte pas la liste),
-- insertion admin + bénévole, modification/suppression admin uniquement
-- ---------------------------------------------------------
create policy "dons_select_admin" on dons
  for select using (organisation_id = current_user_organisation_id());

create policy "dons_insert" on dons
  for insert with check (organisation_id = current_effective_organisation_id());

create policy "dons_update_admin" on dons
  for update using (organisation_id = current_user_organisation_id());

create policy "dons_delete_admin" on dons
  for delete using (organisation_id = current_user_organisation_id());

-- ---------------------------------------------------------
-- recus_fiscaux : admin uniquement
-- ---------------------------------------------------------
create policy "recus_all_admin" on recus_fiscaux
  for all using (organisation_id = current_user_organisation_id());


-- =========================================================
-- 3. SEED DE DEMO
-- =========================================================
-- Reprend les données visibles dans la maquette (organisation Mothana)

insert into organisations (id, nom, code_pin_benevole)
values ('00000000-0000-0000-0000-000000000001', 'Mothana', '1234');

-- Activités
insert into activites (id, organisation_id, nom) values
  ('00000000-0000-0000-0000-000000000101', '00000000-0000-0000-0000-000000000001', 'Nouvel An Lao 2025'),
  ('00000000-0000-0000-0000-000000000102', '00000000-0000-0000-0000-000000000001', 'Cours de Laotien'),
  ('00000000-0000-0000-0000-000000000103', '00000000-0000-0000-0000-000000000001', 'Repas communautaire');

-- Personnes
insert into personnes (id, nom, prenom) values
  ('00000000-0000-0000-0000-000000000201', 'PHOMMAVONG', 'Bounsong'),
  ('00000000-0000-0000-0000-000000000202', 'KEOVICHITH', 'Chanthanom'),
  ('00000000-0000-0000-0000-000000000203', 'SENGMANY', 'Phonesavanh'),
  ('00000000-0000-0000-0000-000000000204', 'LUANGPHAXAY', 'Dalavanh'),
  ('00000000-0000-0000-0000-000000000205', 'VONGKHAMPHANH', 'Sisouphanh'),
  ('00000000-0000-0000-0000-000000000206', 'BOUNMIXAY', 'Nampheung');

-- Profils participant (rattachement à l'organisation Mothana)
insert into profils_participant (id, personne_id, organisation_id) values
  ('00000000-0000-0000-0000-000000000301', '00000000-0000-0000-0000-000000000201', '00000000-0000-0000-0000-000000000001'),
  ('00000000-0000-0000-0000-000000000302', '00000000-0000-0000-0000-000000000202', '00000000-0000-0000-0000-000000000001'),
  ('00000000-0000-0000-0000-000000000303', '00000000-0000-0000-0000-000000000203', '00000000-0000-0000-0000-000000000001'),
  ('00000000-0000-0000-0000-000000000304', '00000000-0000-0000-0000-000000000204', '00000000-0000-0000-0000-000000000001'),
  ('00000000-0000-0000-0000-000000000305', '00000000-0000-0000-0000-000000000205', '00000000-0000-0000-0000-000000000001'),
  ('00000000-0000-0000-0000-000000000306', '00000000-0000-0000-0000-000000000206', '00000000-0000-0000-0000-000000000001');

-- =========================================================
-- 4. TABLES AJOUTÉES DEPUIS LA V1 (à jour au 2026-08-09)
-- =========================================================
-- Reprises directement des fichiers supabase/migrations/ correspondants.
-- RLS : toutes suivent le pattern `(select current_effective_organisation_id())`
-- + bypass super-admin inline `(((select auth.jwt()) -> 'app_metadata' ->>
-- 'is_super_admin'))::boolean = true` (pas de fonction is_super_admin() dans
-- ce projet), cf. rls_auth_initplan_perf.sql / super_admin_rls.sql.

-- ---------------------------------------------------------
-- templates_recu (refonte Cerfa §1.3) : templates HTML/CSS des reçus
-- fiscaux par organisation et par type (11580 particuliers / 16216 personnes morales)
-- ---------------------------------------------------------
create table templates_recu (
  id uuid primary key default uuid_generate_v4(),
  organisation_id uuid not null references organisations(id) on delete cascade,
  nom text not null,
  type_cerfa text not null check (type_cerfa in ('11580', '16216')),
  html_template text not null,
  css text,
  is_active boolean not null default false,
  is_archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
-- Un seul template actif par type et par organisation
create unique index idx_templates_recu_active
  on templates_recu(organisation_id, type_cerfa)
  where is_active = true and is_archived = false;

-- ---------------------------------------------------------
-- organisation_assets : liste ouverte d'assets (logo, tampon, signature...)
-- par organisation, chacun devient un placeholder {{asset_<identifiant>}}
-- dans les templates de reçus fiscaux et de carte adhérent
-- ---------------------------------------------------------
create table organisation_assets (
  id uuid primary key default uuid_generate_v4(),
  organisation_id uuid not null references organisations(id) on delete cascade,
  identifiant text not null check (identifiant ~ '^[a-z0-9_]+$'),
  libelle text not null,
  url text not null,
  created_at timestamptz not null default now(),
  unique (organisation_id, identifiant)
);

-- ---------------------------------------------------------
-- adherents : population distincte des donateurs (profils_participant),
-- module cadré 2026-08-03, pas de lien direct en base avec les donateurs
-- ---------------------------------------------------------
create table adherents (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references organisations(id) on delete cascade,
  id_externe text,
  civilite smallint not null default 0 check (civilite in (0, 1, 2)), -- 0=non défini, 1=M., 2=Mme — distinct de l'enum civilité (7 valeurs) de `personnes`
  nom text not null,
  prenom text,
  date_naissance date,
  adresse text,
  code_postal text,
  ville text,
  telephone text,
  courriel text,
  statut text not null default 'actif' check (statut in ('actif', 'archive')), -- soft delete
  statuts_acceptes boolean not null default true,
  consent_rgpd boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organisation_id, id_externe)
);

-- ---------------------------------------------------------
-- adhesions : un cycle annuel = une ligne, historisation (pas d'update en
-- place sur l'ancien cycle). RLS via jointure adherent_id -> organisation_id
-- (pas de organisation_id direct sur cette table).
-- ---------------------------------------------------------
create table adhesions (
  id uuid primary key default gen_random_uuid(),
  adherent_id uuid not null references adherents(id) on delete cascade,
  date_debut date not null,
  date_fin date, -- calculée côté app (lib/adhesion.ts computeDateFin, cycle glissant 1 an), jamais NULL en pratique
  montant_cotisation numeric(10, 2),
  date_paiement_cotisation date,
  mode_paiement smallint check (mode_paiement = any (array[1, 2, 3, 4])), -- même enum que dons.mode_paiement (1=Espèces 2=Chèque 3=Prélèvement-virement 4=Autres)
  renouvellement boolean not null default false, -- calculé côté app, jamais saisi
  droit_vote_ag boolean not null default true,
  bulletin_signe boolean not null default true,
  created_at timestamptz not null default now(),
  check (date_fin is null or date_fin >= date_debut)
);

-- ---------------------------------------------------------
-- templates_carte_adherent : gabarit HTML/CSS de la carte adhérent (planche
-- A4, module Adhérents étape 5), même pattern que templates_recu
-- ---------------------------------------------------------
create table templates_carte_adherent (
  id uuid primary key default uuid_generate_v4(),
  organisation_id uuid not null references organisations(id) on delete cascade,
  nom text not null,
  html_template text not null,
  css text,
  is_active boolean not null default false,
  is_archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index idx_templates_carte_adherent_active
  on templates_carte_adherent(organisation_id)
  where is_active = true and is_archived = false;

-- ---------------------------------------------------------
-- demandes_adhesion : soumises via le formulaire public (/adhesion/{slug}),
-- en attente de ratification. Table séparée de adherents/adhesions : une
-- demande ne devient un adhérent réel qu'à la ratification.
-- ---------------------------------------------------------
create table demandes_adhesion (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references organisations(id) on delete cascade,
  civilite smallint not null default 0 check (civilite in (0, 1, 2)),
  nom text not null,
  prenom text,
  date_naissance date,
  adresse text,
  code_postal text,
  ville text,
  telephone text,
  courriel text,
  signature_data_url text not null, -- signature dessinée (canvas), pas de valeur probante eIDAS
  accepte_statuts boolean not null default false check (accepte_statuts = true),
  consent_rgpd boolean not null default false check (consent_rgpd = true),
  statut text not null default 'en_attente' check (statut in ('en_attente', 'ratifiee', 'refusee')),
  decided_at timestamptz,
  decided_by uuid references auth.users(id),
  adherent_id uuid references adherents(id) on delete set null, -- renseigné à la ratification
  motif_refus text, -- saisi par l'admin au refus, usage interne, jamais transmis au demandeur
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------
-- journal_modifications : audit générique append-only (aucune policy
-- UPDATE/DELETE), périmètre de départ = adherents + demandes_adhesion
-- ---------------------------------------------------------
create table journal_modifications (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references organisations(id) on delete cascade,
  table_cible text not null, -- pas de FK générique possible sur plusieurs tables
  ligne_id uuid not null,
  action text not null, -- creation/modification/archivage/reactivation/ratification/refus
  details jsonb,
  auteur_id uuid references auth.users(id),
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------
-- Fonctions RPC clés (définitions complètes dans supabase/migrations/) :
--   get_organisation_public(slug)          -- résolution publique slug -> organisation + assets + formulaire (anon)
--   search_adherents(...)                  -- recherche paginée nom/prénom/email (LIMIT/OFFSET, pas fetchAllRows)
--   next_numero_recu(organisation_id, annee)      -- numérotation atomique reçus fiscaux
--   next_adherent_id_externe(organisation_id)     -- numérotation atomique id_externe adhérent
--   list_journal_modifications(organisation_id, limit, offset)  -- historique paginé
-- ---------------------------------------------------------

-- Dons (basés sur la capture d'écran)
insert into dons (profil_participant_id, organisation_id, activite_id, montant, date, mode_paiement) values
  ('00000000-0000-0000-0000-000000000301', '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000101', 150.00, '2026-06-10', 'virement'),
  ('00000000-0000-0000-0000-000000000302', '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000101', 80.00,  '2026-06-06', 'cheque'),
  ('00000000-0000-0000-0000-000000000303', '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000102', 200.00, '2026-05-24', 'especes'),
  ('00000000-0000-0000-0000-000000000304', '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000103', 50.00,  '2026-05-02', 'virement'),
  ('00000000-0000-0000-0000-000000000305', '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000101', 300.00, '2026-04-18', 'cheque'),
  ('00000000-0000-0000-0000-000000000306', '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000102', 120.00, '2026-03-27', 'virement'),
  ('00000000-0000-0000-0000-000000000301', '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000103', 75.00,  '2026-02-14', 'especes'),
  ('00000000-0000-0000-0000-000000000301', '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000101', 90.00,  '2026-01-15', 'virement');

-- Note : pour créer le compte admin de démo, créer un utilisateur via
-- Supabase Auth (email/mot de passe), puis exécuter :
--
-- insert into profils_organisation (utilisateur_id, organisation_id, nom_affiche, role)
-- values ('<uuid-de-l-utilisateur-cree>', '00000000-0000-0000-0000-000000000001', 'Admin Mothana', 'admin');
