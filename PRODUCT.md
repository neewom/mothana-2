# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

- **Admin d'organisation** : utilisateur principal, quotidien. Gère les dons, participants, activités, adhérents et reçus fiscaux de son association via un dashboard (`/admin`). Authentification email/mot de passe Supabase.
- **Bénévole** : accès simplifié par code PIN (`/login/benevole`), saisie rapide de dons sur le terrain (événements, tablette/téléphone), accès volontairement restreint (pas de fiche complète des personnes).
- **Super-admin (Mothana)** : gère l'ensemble des organisations clientes depuis `/super-admin` (création, paramétrage, mode "Consulter" pour dépanner une organisation).
- **Adhérent / donateur (visiteur public)** : ne se connecte pas à l'app — interagit via des formulaires publics personnalisés par organisation (demande d'adhésion, bientôt connexion) accessibles par une URL dédiée (`/adhesion/{slug}`).

## Product Purpose

Mothana est une plateforme de gestion des dons et adhésions pour des associations à but non lucratif (loi 1901) : suivi des dons, gestion des participants/adhérents, génération de reçus fiscaux Cerfa personnalisés, saisie rapide par des bénévoles de confiance sur le terrain. Architecture multi-organisation dès la conception (RLS Supabase, isolation totale des données par organisation), même si une seule association est cliente au démarrage.

## Positioning

Les plateformes de dons en ligne grand public (ex. HelloAsso) ne génèrent pas de reçu fiscal Cerfa pour un don reçu hors-ligne (espèces, chèque, virement) saisi manuellement — Mothana couvre précisément ce créneau : édition et génération automatisée (Gotenberg) du reçu fiscal pour tout don, quel que soit son canal d'encaissement, avec des templates personnalisables par organisation.

## Operating Context

- Saisie bénévole typiquement en conditions de terrain (événement associatif, tablette ou smartphone), session courte via PIN.
- Gestion admin au quotidien depuis un ordinateur ou mobile (revue UI responsive dédiée, PR #57).
- Formulaires publics par organisation (adhésion, bientôt connexion) consultés par des visiteurs externes non technophiles, sur mobile comme desktop.
- Environnement staging Supabase séparé de la prod (`docs/environnement-staging.md`), avec une organisation de démo dotée de données de test réalistes pour les audits UI.

## Capabilities and Constraints

- Suivi des dons (montant, date, participant, activité, mode de paiement), gestion des participants, activités, adhérents (module V1 livré).
- Génération de reçus fiscaux Cerfa via templates HTML/CSS éditables (éditeur Monaco), rendu PDF via Gotenberg (self-hosted, pas pdf-lib).
- Export comptable (CSV dons, tableau de bord `/admin/comptabilite`, récapitulatif déclaratif article 222 bis CGI) ; rapprochement chèques/virements non cadré.
- Import CSV pour dons/participants/adhérents/activités.
- Personnalisation par organisation déjà en place pour les **pages publiques** (en-tête/pied de page/CSS du formulaire d'adhésion, logo via bucket `organisation-assets`) — même mécanique prévue pour l'écran de connexion (carte Trello cadrée, pas encore développée).
- Le **dashboard admin interne** (`/admin`, `/super-admin`) reste à l'identité visuelle unifiée Mothana, non personnalisable par organisation — décision confirmée à l'init impeccable (2026-08-11) : seules les surfaces orientées visiteur externe se personnalisent.
- Pas de norme d'accessibilité formelle imposée (pas de RGAA/WCAG contractuel) ; bonnes pratiques standard suffisent.
- Terminologie métier notable : "reçu fiscal" (Cerfa), "adhérent" (distinct de "participant"/donateur), "profil bénévole" (compte technique `benevole-{org_id}@mothana.internal`).

## Brand Commitments

Nom du produit : Mothana. Aucune identité visuelle formalisée à date (pas de charte graphique dédiée) — l'UI actuelle (Tailwind, composants React) constitue l'implémentation incumbente à documenter plutôt qu'à considérer comme une contrainte de marque figée.

## Evidence on Hand

- `docs/cadrage-mothana.md` — spec fonctionnelle complète (source de vérité produit).
- `docs/schema-mothana.sql` — schéma SQL de référence.
- `docs/regles-recus-fiscaux.md`, `docs/brief-cerfa.md` — règles métier reçus fiscaux.
- Organisation de démo "Association Démo Staging" (staging) avec données réalistes (participants, dons, adhérents, demandes d'adhésion à tous les statuts) — utilisable comme jeu de données pour prévisualiser tout audit/refonte visuelle.
- PR #57 (revue UI responsive admin, mergée 2026-08-11) : 6 corrections de débordement mobile, pattern de header dupliqué identifié comme dette récurrente (5 fichiers) — voir `docs/journal-avancement.md`.

## Product Principles

1. La segmentation multi-organisation (RLS) est absolue : aucune fuite de données entre associations, y compris dans les surfaces personnalisables.
2. Le bénévole doit pouvoir saisir un don en quelques secondes sur le terrain — priorité à la rapidité et à la tolérance aux conditions d'usage (mobile, connexion imparfaite) sur cet écran précis.
3. Le reçu fiscal est un document légal (Cerfa) : la fidélité au modèle officiel et l'exactitude des données prévalent sur la créativité visuelle pour ce type de surface.
4. La personnalisation par organisation reste cantonnée aux surfaces visiteur externe ; l'outil de travail admin reste cohérent et unifié pour ne pas fragmenter l'expérience de gestion.

## Accessibility & Inclusion

Pas de norme formelle requise. Public volontaire parfois peu technophile (bénévoles associatifs, adhérents) — lisibilité et simplicité restent des critères de qualité, sans contrainte réglementaire à documenter.
