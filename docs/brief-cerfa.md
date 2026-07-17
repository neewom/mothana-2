# Brief — Refonte Reçus Fiscaux (Cerfa)

Ce document décrit l'ensemble des développements à réaliser pour rendre la génération de reçus fiscaux conforme et production-ready. À lire en complément de `regles-recus-fiscaux.md`.

---

## 1. Migrations SQL (à exécuter dans l'ordre)

### 1.1 Adresse de l'organisation
```sql
alter table organisations
  add column if not exists adresse text,
  add column if not exists code_postal text,
  add column if not exists ville text,
  add column if not exists pays text default 'France';
```

### 1.2 Champs Cerfa dans modele_recu_pdf (JSONB)
Les champs suivants s'ajoutent dans le JSONB existant `modele_recu_pdf` — pas de migration SQL nécessaire, uniquement des nouveaux champs dans le formulaire Paramètres :
- `rna` (text) — numéro RNA format W + 9 chiffres
- `siren` (text) — numéro SIREN (optionnel si RNA renseigné)
- `objet_social` (text) — objet social de l'association
- `mention_legale` (text) — pré-remplie avec "Organisme d'intérêt général éligible au mécénat – article 200 du CGI"
- `numero_recu_depart` (integer) — numéro du premier reçu (défaut : 1)

### 1.3 Table templates_recu
```sql
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

alter table templates_recu enable row level security;

create policy "templates_recu_org" on templates_recu
  for all using (organisation_id = current_effective_organisation_id());
```

### 1.4 Évolution de recus_fiscaux
```sql
alter table recus_fiscaux
  add column if not exists numero_ordre text,
  add column if not exists type_cerfa text check (type_cerfa in ('11580', '16216')),
  add column if not exists template_id uuid references templates_recu(id) on delete set null,
  add column if not exists snapshot_donateur jsonb,
  add column if not exists snapshot_organisation jsonb,
  add column if not exists email_envoye_at timestamptz;
```

### 1.5 Séquences de numérotation par organisation
```sql
-- Fonction pour obtenir le prochain numéro de reçu (atomique, sans doublon)
create or replace function next_numero_recu(org_id uuid, annee integer)
returns text as $$
declare
  seq_name text;
  next_val bigint;
  depart integer;
begin
  seq_name := 'recu_seq_' || replace(org_id::text, '-', '_') || '_' || annee;

  -- Créer la séquence si elle n'existe pas encore pour cette année
  if not exists (select 1 from pg_sequences where schemaname = 'public' and sequencename = seq_name) then
    -- Récupérer le numéro de départ configuré dans l'organisation
    select coalesce((modele_recu_pdf->>'numero_recu_depart')::integer, 1)
    into depart
    from organisations where id = org_id;

    execute format('create sequence public.%I start %s', seq_name, depart);
  end if;

  execute format('select nextval(%L)', 'public.' || seq_name) into next_val;
  return annee || '-' || lpad(next_val::text, 3, '0');
end;
$$ language plpgsql security definer;
```

---

## 2. Refonte génération PDF : pdf-lib → HTML/CSS + Puppeteer

### 2.1 Principe
- Abandonner `pdf-lib` (positionnement x/y rigide, non éditable)
- Adopter **HTML/CSS avec placeholders** comme format de template
- Conversion HTML → PDF via **Puppeteer** dans l'Edge Function
- Prévisualisation **iframe** côté client (gratuite, instantanée)
- Éditeur **Monaco** pour modifications manuelles par le super-admin

### 2.2 Format des placeholders dans les templates HTML
```
{{organisation_nom}}
{{organisation_adresse}}
{{organisation_code_postal}}
{{organisation_ville}}
{{organisation_rna}}
{{organisation_siren}}
{{organisation_objet_social}}
{{organisation_mention_legale}}
{{donateur_civilite}}        — libellé formaté selon les règles métier
{{donateur_nom_complet}}     — calculé selon civilité (voir §4)
{{donateur_adresse}}
{{donateur_code_postal}}
{{donateur_ville}}
{{don_montant_chiffres}}     — ex: "150,00 €"
{{don_montant_lettres}}      — ex: "cent cinquante euros"
{{don_annee}}
{{recu_numero_ordre}}        — ex: "2026-042"
{{recu_date_generation}}
{{type_reduction}}           — "66%" ou "75%" selon l'organisation
```

### 2.3 Edge Function generate-recu — nouveau flux
1. Recevoir `{ profil_participant_id, organisation_id, annee }`
2. Valider organisation (champs obligatoires Cerfa) → erreur si incomplet
3. Valider participant (champs obligatoires selon civilité) → erreur si incomplet
4. Déterminer `type_cerfa` selon civilité (voir regles-recus-fiscaux.md §1)
5. Récupérer le template actif pour ce `type_cerfa` et cette organisation
6. Calculer `numero_ordre` via `next_numero_recu()` (seulement si nouveau reçu — conservé si regénération)
7. Construire `snapshot_donateur` et `snapshot_organisation` (état des données au moment de la génération)
8. Injecter les placeholders dans le HTML
9. Convertir HTML → PDF via Puppeteer
10. Uploader le PDF dans Supabase Storage (`recus-fiscaux/{org_id}/{annee}/{numero_ordre}.pdf`)
11. Upsert dans `recus_fiscaux` avec tous les nouveaux champs

### 2.4 Puppeteer dans Supabase Edge Function
Puppeteer est trop lourd pour une Edge Function standard. Options :
- **Option recommandée** : service externe [Gotenberg](https://gotenberg.dev) (open source, auto-hébergeable, API REST HTML→PDF)
- Alternative : [htmlpdf.api](https://htmlpdf.api) (SaaS, simple mais payant)
- Alternative : [Browserless](https://browserless.io) (Puppeteer managé)

Gotenberg peut être déployé sur un petit VPS ou sur Railway/Render (~5$/mois).

---

## 3. Templates HTML par défaut

Créer deux templates HTML conformes Cerfa à insérer en seed pour chaque nouvelle organisation :

### Template 11580 (particuliers)
Doit contenir :
- En-tête organisation (nom, adresse, RNA/SIREN)
- Titre : "Reçu au titre des dons à certains organismes d'intérêt général"
- Numéro d'ordre (en haut à droite)
- Identité du donateur (civilité + nom complet + adresse)
- Montant en chiffres ET en toutes lettres
- Nature du don (numéraire / nature)
- Absence de contrepartie
- Mention légale d'éligibilité (article 200 CGI)
- Date et signature (bloc prévu)

### Template 16216 (entreprises/personnes morales)
Même structure avec adaptation pour personnes morales (raison sociale, pas de civilité personnelle, réduction IS 60%).

---

## 4. Règles de formatage du nom du donateur sur le reçu

| Civilité | Format affiché | Exemple |
|---|---|---|
| 1 (Monsieur) | "M. Prénom NOM" | "M. Jean DUPONT" |
| 2 (Madame) | "Mme Prénom NOM" | "Mme Marie DUPONT" |
| 3 (Mademoiselle) | "Mlle Prénom NOM" | "Mlle Sophie DUPONT" |
| 4 (Foyer) — avec nom2/prenom2 | "M. Prénom NOM et Mme Prénom2 NOM2" | "M. Jean DUPONT et Mme Marie MARTIN" |
| 4 (Foyer) — sans nom2/prenom2 | "M. et Mme Prénom NOM" | "M. et Mme Jean DUPONT" |
| 5 (Société) | NOM (raison sociale seule) | "SAS DUPONT INDUSTRIE" |
| 6 (Association) | NOM (raison sociale seule) | "ASSOCIATION CULTURELLE LAOSTE" |
| 7 (Famille) | ⛔ Bloquant | — |
| NULL | ⛔ Bloquant | — |

---

## 5. Paramètres organisation — nouveaux champs

Enrichir la page Paramètres avec une nouvelle section "Informations fiscales" :

**Champs à ajouter au formulaire :**
- Adresse (colonne directe `organisations.adresse`)
- Code postal (`organisations.code_postal`)
- Ville (`organisations.ville`)
- Pays (`organisations.pays`, défaut "France")
- Numéro RNA (`modele_recu_pdf.rna`)
- Numéro SIREN (`modele_recu_pdf.siren`, optionnel)
- Objet social (`modele_recu_pdf.objet_social`)
- Mention légale (`modele_recu_pdf.mention_legale`, pré-remplie)
- Numéro du premier reçu (`modele_recu_pdf.numero_recu_depart`, défaut 1)

**Affichage informatif (obligations légales) :**
> ⚠️ L'association doit conserver une copie de chaque reçu émis pendant 6 ans.
> Depuis le 1er janvier 2021, l'association doit déclarer annuellement le montant total des dons et le nombre de reçus émis (article 222 bis du CGI).
> Une association qui émet des reçus sans y être habilitée s'expose à une amende égale à 66% des sommes inscrites.

---

## 6. Page Reçus fiscaux — évolutions UI

### Validation organisation
Si les champs obligatoires Cerfa ne sont pas tous renseignés dans les Paramètres → bannière en haut de page :
> "Complétez les paramètres de votre organisation pour pouvoir générer des reçus fiscaux" + lien vers Paramètres

### Validation participant (par ligne)
Afficher une icône d'avertissement ⚠️ sur les lignes dont le reçu ne peut pas être généré, avec tooltip listant les champs manquants.

### Nouveaux éléments
- Colonne "N° reçu" dans la liste des reçus générés
- Colonne "Type" (11580 / 16216)
- Filtres : année, type Cerfa, statut (généré / non généré)
- Bouton "Regénérer" sur un reçu existant (avec message de confirmation)

---

## 7. Gestion des templates (page dédiée dans Paramètres)

- Liste des templates par type (11580 / 16216)
- Indicateur "Actif" / "Archivé"
- Actions : Activer, Prévisualiser, Archiver, Supprimer (uniquement si jamais utilisé)
- Créer un nouveau template (éditeur Monaco + prévisualisation iframe)

---

## 8. Ordre d'implémentation recommandé

1. Migrations SQL (§1)
2. Nouveaux champs Paramètres organisation (§5)
3. Templates HTML par défaut en seed (§3)
4. Refonte Edge Function generate-recu (§2) avec Gotenberg
5. Évolutions UI page Reçus fiscaux (§6)
6. Page gestion des templates dans Paramètres (§7)

---

## 9. Points à vérifier / décisions en suspens

- [ ] Choix définitif du service HTML→PDF : Gotenberg (recommandé) vs autre
- [ ] Les 4 champs actuels de `modele_recu_pdf` à identifier dans le code avant migration
- [ ] Numéro de départ des reçus pour Wat Velouvanaram (à demander à l'association)
- [ ] Taux de réduction (66% standard) — à rendre configurable par organisation si certaines ont droit au 75%
