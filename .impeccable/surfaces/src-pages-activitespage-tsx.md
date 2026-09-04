---
version: 1
slug: "src-pages-activitespage-tsx"
primary_target: "src/pages/ActivitesPage.tsx"
related_targets: []
---

## Scope & mode

`src/pages/ActivitesPage.tsx` — Operate. Pilote isolé d'une reconstruction visuelle potentielle de toute l'app (23 autres pages non concernées à ce stade). DESIGN.md racine reste la référence pour le reste de l'app tant que la généralisation n'est pas décidée.

## Audience, job, action, proof

Admin d'association (parfois peu technophile), gère la liste des activités/événements de son organisation. Tâche : scanner rapidement ce qui est actif/à venir vs terminé, créer/modifier/supprimer une activité. Preuve de la valeur d'une activité : compteurs réels de dons et participants rattachés (calculés depuis `dons.activite_id`).

## Constraints

Fonctionnalité 100% préservée (recherche, pagination, CRUD, blocage de suppression si dons rattachés, import CSV via `ImportWizard` inchangé). Aucun statut de workflow inventé — le cachet ne reflète que des faits dérivés des dates réelles (`date_debut`/`date_fin`), jamais une validation manuelle absente du schéma.

## Chosen direction & memorable moment

"Le carnet tamponné × registre" (fusion de deux directions explorées avec l'utilisateur). Canvas papier clair (`paper` #fdfcfa), encre vermillon unique (`stamp` #a8281f — contour = action de marque, plein = danger), Inter pour le texte courant, IBM Plex Mono strict aux données tabulaires (dates, compteurs). Moment mémorable : le cachet postal automatique (taille/poids variant selon le statut réel) qui remplace tout badge de statut inventé — une activité "terminée" porte littéralement la date à laquelle elle s'est refermée, comme une oblitération.

Deux sections distinctes (actives/à venir vs terminées), côte à côte en desktop, empilées en mobile.

## Unresolved / open for rollout decision

- La cérémonie de sélection de direction du skill (concept-seed/serve-question, comps générés) n'a pas pu tourner dans cette session (pas de génération d'image disponible) — la direction a été choisie par allers-retours en chat avec l'utilisateur, pas la cérémonie automatisée standard.
- Tokens (`paper`/`ink`/`stamp`, `font-registre`/`font-registre-mono`) namespacés dans `tailwind.config.cjs` pour ne pas entrer en collision avec la palette par défaut utilisée par les pages non migrées — à consolider dans DESIGN.md racine seulement si la généralisation est décidée.
- Primitives `src/components/ui/{button,dialog,input,label}.tsx` créées pour ce pilote (shadcn standard) — pas encore utilisées ailleurs ; à valider comme base commune avant extraction/rollout sur les 23 autres pages.
- Sidebar/header (`AdminLayout.tsx`) restent dans l'ancien système — non touchés, hors scope pilote.
