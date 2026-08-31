# Session du 2026-08-31 — Pilote shadcn/ui (ActivitesPage)

## Réalisé

### Merge PR #111 (animation sidepanels mobile)
- Testée et validée par l'utilisateur, mergée sur `dev` (branche feature supprimée). Carte Trello déplacée en Done, résumé ajouté dans `CLAUDE.md`.

### Repensé le cadrage du sujet suivant → devenu un chantier bien plus large
- L'utilisateur a redemandé de repenser le cadrage de "Audit mobile : masquer les colonnes redondantes" avant de démarrer — a exprimé le souhait de migrer vers shadcn/ui (ou Tailwind Plus/AlignUI) pour toute l'app, avec une vraie dimension mobile-first et un rendu plus soigné.
- Analyse de faisabilité/coût faite en chat : aucune fondation shadcn existante (pas de Radix/cva/tailwind-merge), 24 pages, 19 500 lignes, `DESIGN.md` documente une dette non factorée. Recommandation : pilote isolé sur une seule page avant tout rollout, plutôt qu'un big-bang.
- Utilisateur a validé l'approche pilote, demandé de "casser les codes" de `DESIGN.md` actuel (reconstruction, pas évolution incrémentale).

### Sélection de direction créative (skill impeccable, `ActivitesPage.tsx` comme pilote)
- Setup du skill (`context.mjs`), tirage de direction (`concept-seed.mjs --scope direction --mode operate`) sur ma propre liste de 7 pistes ancrées dans l'univers du registre associatif français (grand livre, récépissé officiel, carte tamponnée, agenda mural, programme d'événement, tableau d'affichage, classeur à intercalaires).
- Direction assignée : "Le carnet tamponné" (carte tamponnée). Présentée avec 3 alternatives (mon pick "grand livre du trésorier", challenger "rail chronologique", canon "shadcn conventionnel") — pas de génération d'image disponible dans cette session, donc pas de vraie cérémonie `serve-question`/comps visuels : présentation textuelle via `AskUserQuestion`.
- Utilisateur a demandé des previews HTML réelles des 4 directions — construites à la main (Tailwind CDN), servies via `public/_comps/{a,b,c,d}.html` sur l'instance de dev permanente (jamais de serveur séparé lancé), capturées en mobile+desktop via Playwright.
- 3 itérations de correction sur la direction retenue, toutes issues de retours utilisateur pertinents :
  1. "Le tampon ne correspond pas à la structure d'une activité" → vérifié le vrai schéma TS `Activite` (pas de statut brouillon/confirmée, juste des dates) → le cachet redéfini comme "oblitération" honnête (marque automatique du temps qui passe), jamais un statut de workflow inventé.
  2. "Les fonts tranchent trop, est-ce ergonomique sur toute l'app ?" → règle resserrée : Inter partout pour le texte courant, IBM Plex Mono strictement réservé aux données tabulaires (dates, compteurs) — pas de mono en corps de texte.
  3. "Il faudra mettre les événements terminés dans un tableau à part" → page structurée en 2 sections (actives/à venir vs terminées), côte à côte en desktop, empilées en mobile.
- Direction finale = fusion E, validée ("Go pour la E !").
- Digression utilisateur sur Claude Artifacts / "Claude design" (question d'un ami) — clarifié : Artifacts = fonctionnalité claude.ai web, pas disponible dans Claude Code ; découvert au passage un outil `DesignSync` (claude.ai/design) réel mais bloqué dans cette session (`/design-login` exige un terminal interactif, absent car session "bridge"/`sdk-cli`/enfant d'une couche d'orchestration — confirmé via variables d'env `CLAUDE_CODE_ENVIRONMENT_KIND=bridge` etc.). Pas d'impact sur le chantier, juste une parenthèse exploratoire à la demande de l'utilisateur.

### Construction du pilote réel (PR #112, dev, pas encore mergée)
- Fondation shadcn/ui posée : `src/lib/utils.ts` (cn), `src/components/ui/{button,dialog,input,label}.tsx`, tokens namespacés `paper`/`ink`/`stamp` + polices `registre`/`registre-mono` dans `tailwind.config.cjs` (namespacés pour ne pas impacter les 23 pages non migrées).
- **Bug trouvé et corrigé** : `tailwind.config.js` en ESM (projet `"type": "module"`) empêchait le serveur de dev **permanent** (jamais redémarré) de recharger les nouveaux tokens de couleur — renommé en `.cjs` (CommonJS), Tailwind peut re-require sans redémarrage du process.
- `ActivitesPage.tsx` entièrement reconstruite : cachet honnête, sections actives/terminées, compteurs réels dons/participants par activité (calculés depuis `dons.activite_id`/`profil_participant_id` — nouveauté factuelle absente avant ce chantier). Fonctionnalité 100% préservée (recherche, pagination, CRUD, blocage suppression si dons rattachés, import CSV `ImportWizard` inchangé).
- Testé de bout en bout sur les vraies données de l'organisation de démo staging via Playwright (connexion admin réelle, cycle créer→chercher→modifier/supprimer une activité de test, nettoyée après coup).
- Revue de finition du skill impeccable (2 tours, agent `impeccable-finish-reviewer`) : 1er verdict "fix" (6 points : canvas papier absent, contraste AA insuffisant sur `ink-faint`, anneau de focus invisible, taille du cachet non différenciée par statut, animation d'apparition absente, chrome sidebar/header non migré — accepté comme limite de scope). Corrigés (sauf le point de scope). 2e verdict : 5/6 resolved, 1 partial (contraste sous `opacity-90` sur le bloc "Terminées") + 1 seam mineur (canvas ne couvrait pas toute la hauteur) — corrigés directement (retrait de l'`opacity-90` redondante, `min-h` sur le canvas), pas de 3e tour relancé (2 tours = plafond du skill), résultat présenté à l'utilisateur.
- `DESIGN.md` racine **non modifié** (reste la référence pour les 23 pages non migrées) — nouvelle direction tracée dans une fiche de surface dédiée `.impeccable/surfaces/src-pages-activitespage-tsx.md` (décision explicite demandée à l'utilisateur via `AskUserQuestion`, DESIGN.md existant ne devant jamais être écrasé silencieusement).
- Utilisateur a testé lui-même ("Testé, c'est parfait").
- Branche `feat/pilote-shadcn-activites-carnet-tampon` créée depuis `dev`, commit, push, PR #112 ouverte (`gh pr create`, base `dev`).
- Carte Trello créée (aucune n'existait pour ce sujet, parti d'une reformulation de "Audit mobile colonnes") : "Migration shadcn/ui — reconstruction visuelle mobile-first (pilote ActivitesPage livré, PR #112)", étiquette "cadré" appliquée, placée en tête de Todo.

## Reste à faire

- Attendre validation manuelle + merge de la PR #112 par l'utilisateur (règle standard, jamais merger sans confirmation explicite).
- Une fois mergée : décision Go/No-Go sur la généralisation aux 23 autres pages (rollout page par page si Go), déplacer la carte Trello en Done + ajouter l'entrée "Terminé" dans `CLAUDE.md` (indissociable, à faire dans la même respiration que le merge).
- Carte "Audit mobile : masquer les colonnes redondantes" (item 1 historique du backlog) laissée telle quelle — sujet différent (masquage de colonnes sur le design existant), non traité par ce pilote, toujours pertinent si la migration shadcn n'est finalement pas généralisée.

## Blockers

Aucun.

## Décisions

- Pilote isolé avant rollout (pas de big-bang shadcn sur les 24 pages) — décision utilisateur après présentation faisabilité/coût.
- DESIGN.md racine non réécrit tant que la généralisation n'est pas décidée — fiche de surface dédiée à la place (décision utilisateur via `AskUserQuestion`).
- Cache postal = fait dérivé des dates réelles uniquement, jamais un statut de workflow inventé (contrainte de vérité produit, trouvée en testant avec l'utilisateur).
- Mono strictement réservé aux données tabulaires, jamais en corps de texte (contrainte ergonomique posée par l'utilisateur, généralisable aux pages suivantes si rollout).
