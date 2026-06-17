# Cadrage projet — Mothana (Gestion des dons)

## 1. Vue d'ensemble

Mothana est une application de gestion des dons pour des associations à but non lucratif. L'objectif de ce MVP est de fournir une plateforme permettant à une association de :

- Suivre les dons reçus (montant, date, participant, activité associée, mode de paiement)
- Gérer ses participants (donateurs, acheteurs de coupons, etc.)
- Générer des reçus fiscaux annuels personnalisés
- Permettre une saisie rapide des dons par des bénévoles de confiance, via un accès simplifié

**Architecture multi-organisation dès la conception** : bien qu'une seule association utilise l'application au démarrage, le modèle de données et les règles de sécurité (RLS) sont conçus pour supporter plusieurs organisations de façon totalement isolée (segmentation des données par organisation).

---

## 2. Stack technique

### Frontend
- **React** + **TypeScript** + **Vite**
- **Tailwind CSS** (cohérent avec le design existant, style shadcn/ui)
- **React Router** pour la navigation

### Backend & Données
- **Supabase**
  - **PostgreSQL** managé pour la base de données
  - **Auth** pour les comptes admin (email/mot de passe)
  - **Row Level Security (RLS)** pour la segmentation multi-organisation et les permissions par rôle
  - **Storage** pour les fichiers PDF des reçus fiscaux
  - **Edge Functions** pour la génération des PDF de reçus fiscaux

### Hébergement
- Non décidé à ce stade (Vercel/Netlify pour le frontend envisageable, Supabase pour le backend)

---

## 3. Modèle d'authentification

Deux modes d'accès distincts, choisis depuis une **page d'accueil unique** :

### 3.1 Accès Admin
- Authentification classique via **Supabase Auth** (email + mot de passe)
- Donne accès au dashboard complet et aux différents CRUD (dons, participants, activités, paramètres, reçus fiscaux)
- Rôle : `admin`

### 3.2 Accès Bénévole
- Authentification via un **code PIN unique** (généré par l'organisation, régénérable depuis les paramètres admin)
- Le code PIN est **unique globalement** (toutes organisations confondues) — il permet donc d'identifier directement l'organisation sans étape de sélection supplémentaire
- Donne accès uniquement à un **écran de saisie de dons simplifié**
- Rôle : `benevole` (accès restreint, compte technique partagé — non nominatif)

---

## 4. Schéma de base de données

### `organisations`
| Champ | Type | Description |
|---|---|---|
| id | uuid (PK) | Identifiant unique |
| nom | text | Nom de l'association |
| modele_recu_pdf | text / jsonb | Référence ou configuration du modèle de reçu fiscal |
| code_pin_benevole | text (unique) | Code PIN d'accès bénévole, unique globalement |
| created_at | timestamp | Date de création |

### `utilisateurs_app`
Comptes admin, gérés via Supabase Auth (table `auth.users` étendue).

| Champ | Type | Description |
|---|---|---|
| id | uuid (PK) | Identifiant (= auth.users.id) |
| email | text | Email de connexion |
| created_at | timestamp | Date de création |

### `profils_organisation`
Lien entre un compte admin et une organisation (structure many-to-many prête pour le futur, un seul profil actif par utilisateur pour le MVP).

| Champ | Type | Description |
|---|---|---|
| id | uuid (PK) | Identifiant unique |
| utilisateur_id | uuid (FK → utilisateurs_app) | Compte admin associé |
| organisation_id | uuid (FK → organisations) | Organisation associée |
| nom_affiche | text | Nom affiché dans l'interface |
| role | text (enum: `admin`) | Rôle de l'utilisateur dans cette organisation |
| created_at | timestamp | Date de création |

### `personnes`
Identité globale d'une personne (donateur, acheteur de coupons, etc.), indépendante des organisations.

| Champ | Type | Description |
|---|---|---|
| id | uuid (PK) | Identifiant unique |
| nom | text | Nom |
| prenom | text | Prénom |
| email | text | Email (optionnel) |
| telephone | text | Téléphone (optionnel) |
| created_at | timestamp | Date de création |

### `profils_participant`
Profil d'une personne au sein d'une organisation spécifique (une même personne peut avoir un profil dans plusieurs organisations).

| Champ | Type | Description |
|---|---|---|
| id | uuid (PK) | Identifiant unique |
| personne_id | uuid (FK → personnes) | Personne associée |
| organisation_id | uuid (FK → organisations) | Organisation associée |
| notes | text | Informations complémentaires spécifiques à l'organisation (optionnel) |
| created_at | timestamp | Date de création |

### `activites`
Catégories/événements auxquels les dons peuvent être associés (ex: "Nouvel An Lao 2025").

| Champ | Type | Description |
|---|---|---|
| id | uuid (PK) | Identifiant unique |
| organisation_id | uuid (FK → organisations) | Organisation associée |
| nom | text | Nom de l'activité |
| created_at | timestamp | Date de création |

### `dons`
| Champ | Type | Description |
|---|---|---|
| id | uuid (PK) | Identifiant unique |
| profil_participant_id | uuid (FK → profils_participant) | Participant concerné |
| organisation_id | uuid (FK → organisations) | Dénormalisé pour simplifier les RLS et les requêtes |
| activite_id | uuid (FK → activites, nullable) | Activité associée (optionnel) |
| montant | numeric | Montant du don |
| date | date | Date du don |
| mode_paiement | text (enum: `virement`, `cheque`, `especes`) | Mode de règlement |
| created_at | timestamp | Date de création de l'enregistrement |
| created_by_role | text (enum: `admin`, `benevole`) | Traçabilité de la saisie |

### `recus_fiscaux`
Reçus fiscaux annuels, agrégeant les dons d'un participant pour une année donnée.

| Champ | Type | Description |
|---|---|---|
| id | uuid (PK) | Identifiant unique |
| profil_participant_id | uuid (FK → profils_participant) | Participant concerné |
| organisation_id | uuid (FK → organisations) | Dénormalisé pour simplifier les RLS |
| annee | integer | Année concernée |
| montant_total | numeric | Total des dons de l'année pour ce participant |
| fichier_url | text | URL du PDF généré (Supabase Storage) |
| date_generation | timestamp | Date de génération du reçu |

---

## 5. Écrans du MVP

### 5.1 Page d'accueil / Connexion
- Choix entre "Admin" et "Bénévole"
- Admin → formulaire email/mot de passe (Supabase Auth)
- Bénévole → saisie d'un code PIN

### 5.2 Dashboard Dons (admin)
- Reprend la maquette existante :
  - Statistiques : total collecté, nombre de dons, don moyen, participants distincts
  - Filtres : période, participant, activité, mode de paiement
  - Liste des dons avec panneau de détail
  - Ajout / édition / suppression d'un don (modal ou panneau)

### 5.3 Participants (admin)
- Liste des participants (profils_participant + infos personnes)
- Fiche détail d'un participant : informations + historique des dons
- Ajout / édition d'un participant
- Possibilité de saisir un don directement depuis la fiche participant

### 5.4 Activités (admin)
- Liste des activités de l'organisation
- Ajout / édition d'une activité

### 5.5 Reçus fiscaux (admin)
- Génération de reçus fiscaux annuels (par participant, ou génération en masse pour une année donnée)
- Liste des reçus déjà générés, avec téléchargement

### 5.6 Paramètres organisation (admin)
- Nom de l'association
- Modèle de reçu fiscal (configuration/template)
- Gestion du code PIN bénévole (génération / régénération)

### 5.7 Écran de saisie bénévole
- Accès via code PIN uniquement
- Formulaire simplifié :
  - Sélection d'un participant existant OU création rapide d'un nouveau participant
  - Saisie d'un don (montant, date, activité, mode de paiement)
- Pas d'accès aux statistiques, à la liste des dons, ni aux autres écrans

---

## 6. Règles de sécurité (RLS) — principes

- Toutes les tables liées à une organisation (`profils_participant`, `activites`, `dons`, `recus_fiscaux`, `profils_organisation`) sont filtrées par `organisation_id`
- **Rôle `admin`** : accès complet en lecture/écriture aux données de son organisation uniquement
- **Rôle `benevole`** (via code PIN, session technique) :
  - Lecture/écriture restreinte à la création de `dons` et `profils_participant`/`personnes` pour son organisation
  - Aucun accès en lecture aux statistiques, listes complètes, reçus fiscaux ou paramètres
- Aucune donnée d'une organisation ne doit être accessible à une autre organisation, à aucun niveau

---

## 7. Hors périmètre MVP (pistes futures)

- Multi-profils utilisateurs (un admin sur plusieurs organisations)
- Rôles supplémentaires / permissions fines
- Export comptable global
- Notifications automatiques (ex: relance, remerciement participant)
- Tableau de bord multi-organisation (vue consolidée)
