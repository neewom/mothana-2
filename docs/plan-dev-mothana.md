# Plan de développement — Mothana (MVP)

Ce document découpe la construction du MVP en étapes séquentielles, pensées pour être exécutées par Claude Code. Chaque étape est conçue pour être testable indépendamment.

Référence : voir `cadrage-mothana.md` pour la spec fonctionnelle et `schema-mothana.sql` pour le schéma de base de données.

---

## Étape 0 — Initialisation du projet

### 0.a — À faire par l'utilisateur (compte & accès, hors code)

- [ ] Créer le projet Supabase (ou utiliser un projet existant)
- [ ] Exécuter `schema-mothana.sql` dans l'éditeur SQL Supabase
- [ ] Créer le compte admin de démo via Supabase Auth + lier son profil (`profils_organisation`)
- [ ] Récupérer les informations de connexion Supabase :
  - Project/API URL (sans le `/rest/v1/`)
  - Clé Publishable (anon)
  - Clé Secret (service_role) — à transmettre de façon sécurisée, jamais commitée dans le code
- [ ] Fournir ces informations à Claude Code pour la suite

### 0.b — À faire par Claude Code (tout le code)

- [ ] Initialiser le projet frontend : React + TypeScript + Vite
- [ ] Installer et configurer Tailwind CSS
- [ ] Installer le client Supabase JS (`@supabase/supabase-js`) et React Router
- [ ] Créer le fichier `.env` (et `.env.example`) avec `VITE_SUPABASE_URL` et `VITE_SUPABASE_ANON_KEY`
  - Vérifier que `.env` est bien dans `.gitignore`
- [ ] Configurer le client Supabase dans le code (ex: `src/lib/supabaseClient.ts`)
- [ ] Mettre en place React Router avec les routes principales (squelette)
- [ ] Vérifier que le projet démarre (`npm run dev`) et que la connexion à Supabase fonctionne (ex: requête de test sur `organisations`)

**Résultat attendu** : projet qui démarre, connecté à Supabase, routes vides en place.

---

## Étape 1 — Authentification & page d'accueil

- [ ] Page d'accueil avec choix "Admin" / "Bénévole"
- [ ] Flux Admin : formulaire email/mot de passe via Supabase Auth
- [ ] Flux Bénévole : saisie du code PIN
  - [ ] Edge Function de vérification du PIN → retourne un JWT avec `app_metadata.role = 'benevole'` et `app_metadata.organisation_id`
    - Signature effectuée côté Edge Function avec la clé `service_role`, fournie par l'utilisateur en variable d'environnement de l'Edge Function (jamais committée dans le code, jamais exposée au client)
    - Durée de vie du token limitée (ex : quelques heures)
    - Si le token a expiré, l'écran bénévole doit permettre de resaisir le PIN pour en obtenir un nouveau, sans perdre le contexte de saisie en cours
- [ ] Gestion de session (redirection selon le rôle après connexion)
- [ ] Route protégée : redirection vers la page d'accueil si non authentifié
- [ ] Page "Déconnexion"

**Résultat attendu** : un admin peut se connecter et accéder au dashboard (vide pour l'instant) ; un bénévole avec le bon PIN accède à l'écran de saisie (vide pour l'instant).

---

## Étape 2 — Dashboard Dons (cœur du MVP)

- [ ] Layout général (sidebar avec navigation : Dons, Participants, Activités, Reçus fiscaux, Paramètres)
- [ ] Page Dons :
  - [ ] Récupération des dons de l'organisation (via Supabase, RLS appliquée automatiquement)
  - [ ] Affichage des statistiques (total collecté, nombre de dons, don moyen, participants distincts) — calculées côté frontend ou via une vue SQL
  - [ ] Tableau des dons (date, participant, activité, montant, mode de paiement)
  - [ ] Filtres : période (date début/fin + raccourcis 30j/90j/ce mois/cette année), participant, activité, mode de paiement
  - [ ] Panneau de détail d'un don (au clic sur une ligne)
- [ ] Ajout d'un don (modal/panneau) : sélection participant, activité, montant, date, mode de paiement
- [ ] Édition d'un don
- [ ] Suppression d'un don (avec confirmation)

**Résultat attendu** : reproduction fonctionnelle de la maquette, avec données réelles depuis Supabase, CRUD complet.

---

## Étape 3 — Participants

- [ ] Page Participants : liste (nom, prénom, email, téléphone, total des dons)
- [ ] Fiche détail d'un participant :
  - [ ] Informations personnelles
  - [ ] Historique des dons de ce participant
  - [ ] Bouton "Ajouter un don" (réutilise le composant de l'étape 2)
- [ ] Ajout d'un participant (formulaire : nom, prénom, email, téléphone)
  - [ ] Création simultanée de `personnes` + `profils_participant`
- [ ] Édition d'un participant
- [ ] (Optionnel MVP) Suppression d'un participant

**Résultat attendu** : gestion complète des participants, navigable depuis et vers les dons.

---

## Étape 4 — Activités

- [ ] Page Activités : liste simple
- [ ] Ajout / édition d'une activité
- [ ] (Optionnel) Suppression, avec vérification qu'aucun don n'y est rattaché (ou détachement automatique)

**Résultat attendu** : les activités créées ici apparaissent dans les sélecteurs des étapes 2, 3 et 6.

---

## Étape 5 — Écran de saisie bénévole

- [ ] Layout dédié, minimaliste (pas de sidebar admin)
- [ ] Formulaire de saisie de don :
  - [ ] Recherche/sélection d'un participant existant (autocomplete)
  - [ ] OU création rapide d'un nouveau participant (nom, prénom, email optionnel)
  - [ ] Sélection de l'activité, montant, date (par défaut aujourd'hui), mode de paiement
  - [ ] Enregistrement (`created_by_role = 'benevole'`)
- [ ] Confirmation visuelle après enregistrement + remise à zéro du formulaire pour saisie suivante
- [ ] Bouton "Quitter" → retour à la page d'accueil

**Résultat attendu** : un bénévole avec le PIN peut enchaîner des saisies de dons en autonomie, sans accès aux autres données.

---

## Étape 6 — Reçus fiscaux

- [ ] Page Reçus fiscaux :
  - [ ] Sélection d'une année
  - [ ] Liste des participants ayant fait au moins un don sur l'année, avec montant total
  - [ ] Génération d'un reçu (individuel ou en masse) → appel Edge Function
- [ ] Edge Function de génération PDF :
  - [ ] Récupère les dons du participant pour l'année donnée
  - [ ] Applique le template de l'organisation (modèle de reçu)
  - [ ] Génère le PDF, le stocke dans Supabase Storage
  - [ ] Enregistre la ligne dans `recus_fiscaux`
- [ ] Liste des reçus déjà générés, avec lien de téléchargement

**Résultat attendu** : génération de reçus PDF fonctionnelle pour l'organisation de démo, avec son modèle par défaut.

---

## Étape 7 — Paramètres organisation

- [ ] Page Paramètres (admin uniquement) :
  - [ ] Modification du nom de l'organisation
  - [ ] Affichage / régénération du code PIN bénévole
  - [ ] Configuration du modèle de reçu fiscal (a minima : champs éditables type en-tête, mentions légales, logo)

**Résultat attendu** : un admin peut gérer le PIN bénévole et personnaliser les informations apparaissant sur les reçus.

---

## Étape 8 — Finitions & QA

- [ ] Gestion des états de chargement / erreurs sur toutes les pages
- [ ] Responsive (vérification mobile/tablette a minima sur les écrans bénévole et dashboard)
- [ ] Vérification des RLS : tester qu'un bénévole ne peut pas accéder aux endpoints admin (lecture liste dons, participants, etc.)
- [ ] Revue cohérence visuelle avec la maquette de départ
- [ ] Rédaction d'un court guide de déploiement (variables d'env, déploiement frontend, Edge Functions)

---

## Notes pour Claude Code

- Toujours s'appuyer sur les RLS Supabase plutôt que sur des vérifications uniquement côté frontend pour la sécurité.
- Le compte bénévole étant un "JWT custom" (non un vrai utilisateur Supabase Auth), bien tester la compatibilité avec les policies RLS définies dans `schema-mothana.sql` (fonction `current_effective_organisation_id`).
- Réutiliser au maximum les composants entre les écrans (ex : formulaire de don utilisé dans Dashboard, Fiche participant, et Saisie bénévole).
- Respecter la charte visuelle de la maquette fournie (couleurs, typographie, composants) dès l'étape 2.
