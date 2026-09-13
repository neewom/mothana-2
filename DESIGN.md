---
name: Mothana
description: Outil de gestion des dons et adhésions pour associations — sobre, dense, fiable
colors:
  paper: "#fdfcfa"
  paper-border: "#e8e4dc"
  paper-border-muted: "#eee9e0"
  ink: "#241f19"
  ink-muted: "#5c5347"
  ink-faint: "#726860"
  stamp: "#a8281f"
  warning: "#b45309"
  warning-tint: "#fffbeb"
  warning-border: "#fde68a"
  success: "#3f6b4a"
  success-tint: "#f2f6f3"
  success-border: "#c9dbcd"
typography:
  display:
    fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.5rem"
    fontWeight: 700
    lineHeight: 1.3
  headline:
    fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.125rem"
    fontWeight: 600
    lineHeight: 1.4
  body:
    fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.5
  label:
    fontFamily: "IBM Plex Mono, ui-monospace, monospace"
    fontSize: "0.75rem"
    fontWeight: 500
    lineHeight: 1.4
rounded:
  sm: "6px"
  full: "9999px"
spacing:
  xs: "8px"
  sm: "12px"
  md: "16px"
  lg: "24px"
components:
  button-default:
    backgroundColor: "transparent"
    borderColor: "{colors.stamp}"
    textColor: "{colors.stamp}"
    rounded: "{rounded.sm}"
    padding: "0 14px"
    typography: "{typography.body}"
  button-destructive:
    backgroundColor: "{colors.stamp}"
    textColor: "#ffffff"
    rounded: "{rounded.sm}"
    padding: "0 14px"
    typography: "{typography.body}"
  button-secondary:
    backgroundColor: "#ffffff"
    borderColor: "{colors.paper-border}"
    textColor: "{colors.ink-muted}"
    rounded: "{rounded.sm}"
    padding: "0 14px"
    typography: "{typography.body}"
  input-field:
    backgroundColor: "#ffffff"
    borderColor: "{colors.paper-border}"
    textColor: "{colors.ink}"
    rounded: "{rounded.sm}"
    padding: "8px 12px"
    typography: "{typography.body}"
  card:
    backgroundColor: "#ffffff"
    borderColor: "{colors.paper-border}"
    rounded: "{rounded.sm}"
    padding: "20px"
---

# Design System: Mothana

## Overview

**Creative North Star: "Le Carnet tamponné x registre"**

Mothana s'adresse à des admins d'association, des bénévoles sur le terrain et des super-admins qui gèrent plusieurs organisations — pas à des visiteurs à séduire. L'interface se pense comme un registre associatif tenu à la main : dense, fiable, lisible d'un coup d'œil, où chaque écran privilégie la tâche à accomplir (saisir un don, retrouver un adhérent, générer un reçu fiscal) sur toute forme de démonstration visuelle. Le papier crème, l'encre bordeaux (« cachet ») et la police monospace pour les données tabulaires évoquent un registre papier tamponné, sans tomber dans le pastiche : les surfaces restent nettes, la densité d'information élevée, et l'accent (le « cachet ») reste réservé au strict registre actionnable.

**Historique** : ce système remplace une première itération (indigo/`rounded-lg`, encore documentée dans les versions précédentes de ce fichier). La migration a eu lieu page par page sur environ 25 PR (pilote sur `ActivitesPage`, généralisation validée ensuite), toutes les pages admin/bénévole/super-admin/publiques étant désormais sur ce système. Historique détaillé : `docs/journal-avancement.md` (entrées "Rollout shadcn/ui").

**Dette connue — composants partagés non migrés ("seams")** : quelques composants transverses, ouverts depuis des pages déjà migrées, sont restés sur l'ancien système (ancien wrapper `Modal.tsx`, inputs et boutons indigo/slate) faute d'être rattachés à une seule page du rollout : `AdhesionModal`, `AssignerListeModal`, `CartesAdherentPdfPreviewModal`, `ImportWizard`, `ParticipantModal`, `ParticipantAutocomplete`, `AdherentHistoriqueSection`, `TagsInput`. Corriger un bouton isolé dans ces fichiers sans migrer le composant entier (wrapper de modale, champs, typographie) donnerait un résultat bâtard plus incohérent que l'état actuel — la remise à niveau de chacun est un chantier à part entière (même ampleur qu'une page du rollout initial), pas une simple retouche de couleur de bouton.

**Key Characteristics:**
- Surfaces plates au repos (bordure fine `paper-border`, coins à peine adoucis `rounded-sm`), aucune décoration gratuite.
- Un seul accent (« cachet », bordeaux `#a8281f`) tenu strictement au registre actionnable : boutons, liens, focus, item de nav actif. Le reste de l'UI est neutre (papier + encre).
- Sidebar admin sombre (encre `#241f19`) contrastant avec un contenu clair (`paper` crème) — repère spatial constant entre navigation et contenu.
- Deux familles typographiques : `Inter` (registre) pour tout le texte courant, `IBM Plex Mono` (registre-mono) réservée aux données tabulaires denses et aux libellés courts en petites capitales (dates, montants, badges) — jamais pour un titre ou un paragraphe.
- Densité d'information élevée assumée (tableaux, listes, formulaires multi-champs) : la hiérarchie vient de la typographie et de l'espacement, pas de l'ornementation.

## Colors

Palette resserrée autour d'un seul accent (le « cachet ») et d'une échelle neutre papier/encre ; les couleurs sémantiques (ambre/vert) sont réservées à la signalisation d'état, jamais décoratives.

### Primary
- **Stamp** (`#a8281f`) : boutons d'action, liens actifs, item de navigation sélectionné, anneau de focus (`stamp/70`). Porte l'énergie de l'outil — c'est la seule couleur qui appelle une action. Utilisée soit en contour (action de marque), soit en remplissage plein (action destructive) — jamais les deux en même temps sur un même écran pour un rôle différent (voir Buttons).

### Neutral
- **Paper** (`#fdfcfa`) : fond de page.
- **Paper Border** (`#e8e4dc`) : séparateurs de carte, bordures de tableau, bordures de champ par défaut.
- **Paper Border Muted** (`#eee9e0`) : séparateurs internes discrets (lignes de tableau).
- **Ink** (`#241f19`) : titres de page, texte à plus fort contraste, fond de la sidebar admin.
- **Ink Muted** (`#5c5347`) : texte de bouton secondaire, valeurs de tableau, corps de texte courant.
- **Ink Faint** (`#726860`) : icônes secondaires, placeholders, méta-information (dates, compteurs). Resserré depuis un `#8a8175` initial qui ne tenait pas le contraste AA (3,8:1 sur blanc) — `#726860` tient 5,4:1.

### Semantic
- **Warning** (`#b45309`, tint `#fffbeb`, bordure `#fde68a`) : doublon détecté, action requise non bloquante.
- **Success** (`#3f6b4a`, tint `#f2f6f3`, bordure `#c9dbcd`) : ratification, statut actif/à jour.

### Named Rules (optional, powerful)
**The One Accent Rule.** Le « cachet » n'apparaît que sur des éléments actionnables ou leur état actif (bouton, lien, focus, item de nav sélectionné). Aucun usage décoratif ou illustratif. Les couleurs sémantiques (warning/success) ne remplacent jamais le cachet sur une action neutre — elles signalent exclusivement un état métier.

## Typography

**Registre (Inter) :** texte courant, titres, labels de formulaire, contenu de bouton — la quasi-totalité de l'UI.

**Registre Mono (IBM Plex Mono) :** réservée aux données tabulaires denses (valeurs de tableau, dates, montants) et aux petits libellés en majuscules (badges, en-têtes de colonne, sous-libellés `text-[11px] uppercase tracking-wide`) — jamais pour un titre ou un paragraphe de contenu.

**Character:** deux familles système/Google Fonts (aucun coût de licence), différenciées par usage (prose vs donnée) plutôt que par graisse seule — sert la lisibilité en conditions de terrain (saisie bénévole sur mobile).

### Hierarchy
- **Display** (700, 1.5rem/24px, 1.3, Inter) : titre de page (`<h1>` en tête de chaque écran admin, ex. "Adhérents", "Dons").
- **Headline** (600, 1.125rem/18px, 1.4, Inter) : titre de modale, titre de section repliable.
- **Body** (400–500, 0.875rem/14px, 1.5, Inter) : texte courant, libellés de formulaire, contenu de bouton.
- **Label** (500, 0.75rem/12px, 1.4, IBM Plex Mono) : badges de statut, texte de tableau dense, sous-libellés en majuscules.
- **Micro-label** (500, 11px, 1.4, IBM Plex Mono) : signal secondaire à côté d'une donnée principale (pastille "Doublon possible"/"Email invalide", aide de champ sous un input, message d'erreur court) — un cran sous `Label`, jamais pour un contenu principal. Confirmé intentionnel par l'utilisateur (2026-09-14) après plusieurs occurrences (~47) déjà cohérentes dans le code.

### Named Rules (optional)
**The PIN Exception Rule.** Le champ de saisie du code PIN bénévole est la seule dérogation volontaire à l'échelle : `text-3xl font-bold tracking-[0.5em] font-registre-mono` pour maximiser la lisibilité d'un code court sur un écran tactile en conditions de terrain.

## Layout

Rythme vertical de page en paliers de 24px (`space-y-6`) entre les grands blocs d'un écran (titre, filtres, tableau). À l'intérieur d'une carte, l'en-tête (recherche/filtres/actions) et le pied (pagination) se détachent du corps par une bordure `paper-border` plutôt que par un espace vide, avec un padding horizontal de 24px (`px-6`) et vertical de 12–16px (`py-3`/`py-4`).

Le contenu s'organise en cartes pleine largeur (`rounded-sm border border-paper-border bg-white`) plutôt qu'en grille de widgets. Les tableaux larges utilisent un scroll horizontal contenu dans la carte (`ScrollShadowX`) plutôt qu'une bascule en liste de cartes empilées sur mobile — convention actée pour tout nouveau tableau, y compris pour les tableaux à une seule colonne de contenu + actions (ex. SuperAdminPage organisations archivées : cellules de tableau standard, jamais de `block`/`table-row` en `md:`).

La navigation admin est une sidebar fixe sombre (`bg-ink`) sur desktop, qui se rétracte en tiroir sur mobile — le contenu, lui, reste toujours sur fond clair (`paper`/blanc).

## Elevation & Depth

Système à plat par défaut : les cartes se distinguent du fond par une bordure fine (`border-paper-border`) sans ombre portée dans la majorité des cas. L'élévation plus marquée est réservée aux éléments qui se superposent réellement au reste de l'interface — c'est un signal structurel (« ceci flotte au-dessus »), jamais un choix esthétique.

### Shadow Vocabulary (if applicable)
- **Repos** (aucune ombre, bordure seule) : cartes, panneaux, conteneurs de tableau.
- **Superposition** (`shadow-lg`) : modales (`DialogContent`) — l'ombre la plus marquée du système, réservée à ce qui recouvre effectivement le reste de l'écran.

### Named Rules (optional)
**The Structural Shadow Rule.** Le niveau d'ombre encode la position dans la pile d'affichage (surface plate < superposition modale), pas une intention décorative. Ne jamais ajouter d'ombre à une carte de contenu qui ne superpose réellement rien.

## Shapes

Radius unique et discret (`rounded-sm`, 6px) sur l'ensemble des éléments interactifs et conteneurs (boutons, champs, cartes, modales, badges), à l'exception des pastilles/badges de statut en `rounded-full`. Contrairement à l'ancien système (radius croissant avec la taille du conteneur), la direction "carnet tamponné" tient un radius quasi plat partout — c'est la bordure fine (1px, `paper-border`) et l'espacement qui structurent, pas l'arrondi. Bordure épaisse (`border-2`) réservée à un état d'alerte non ignorable (ex. avertissement de doublon).

## Components

### Buttons
- **Shape:** `rounded-sm` (6px), jamais d'autre radius sur un bouton.
- **Convention volontaire :** le contour (outline) porte l'action de marque, le remplissage plein porte le danger — les deux partagent la même encre (stamp) sans ambiguïté grâce au poids visuel, pas besoin d'une deuxième couleur rouge.
- **`default`** (action principale, ex. "Enregistrer", "Ajouter") : contour `border-stamp`, texte `text-stamp`, fond transparent, hover `bg-stamp/[0.06]`.
- **`secondary`** (action neutre, ex. "Annuler") : fond blanc, bordure `paper-border`, texte `ink-muted`, hover `bg-paper`.
- **`ghost`** (action tertiaire/icône, faible poids visuel) : pas de bordure, texte `ink-muted`, hover `bg-paper-border/40`.
- **`destructive`** (confirmation finale d'une action irréversible, ex. bouton de confirmation dans une modale de suppression) : fond plein `bg-stamp`, texte blanc, hover `bg-stamp/90`. Réservé à la confirmation finale, jamais au déclencheur initial d'une ligne de tableau.
- **`success`** (action positive, ex. "Ratifier") : même logique outline que `default`, contour/texte `success` — encre sémantique réservée à la signalisation d'état plutôt qu'à la marque.
- **`danger`** (CTA de ligne à conséquence négative mais non-finale, ex. "Archiver", "Refuser", déclencheur "Supprimer" avant confirmation) : même gabarit que `secondary` (bordure + fond blanc) mais texte `stamp` dès le repos, pas seulement au survol (sinon aucun signal sur tactile).
- **Size:** `default` (`h-9 px-3.5`), `sm` (`h-8 px-3 text-xs`, boutons compacts en table), `icon` (`h-9 w-9`, carré).
- **Focus:** `ring-2 ring-stamp/70 ring-offset-1` sur toutes les variantes, pas seulement les actions critiques.
- **Disabled:** `opacity-50` plutôt qu'un changement de couleur — préserve la lisibilité du libellé.

### Chips / Badges
- **Style:** `rounded-full`, `font-registre-mono text-[11px]`, fond teinté pâle + texte de la même famille de couleur (`success-tint`/`success`, `warning-tint`/`warning`).
- **Variants:** `neutral` (classement sans urgence, ex. actif/archivé simple filtre), `success`/`warning` (vrai signal opérationnel, ex. adhésion expirée, doublon détecté), `stamp` (statut lié à la marque, ex. compte désactivé).
- **State:** encode exclusivement un statut métier — jamais un badge purement décoratif.

### Cards / Containers
- **Corner Style:** `rounded-sm` (6px), uniforme avec le reste du système.
- **Background:** blanc sur fond `paper` (crème).
- **Shadow Strategy:** aucune au repos (voir Elevation) — bordure seule.
- **Border:** `border border-paper-border`.
- **Internal Padding:** 20–24px (`p-5`/`p-6`), header/footer de carte détaché par une bordure interne plutôt qu'un espace.

### Inputs / Fields
- **Style:** fond blanc, bordure `paper-border`, `rounded-sm`, `px-3 py-2 text-sm`.
- **Focus:** `ring-2 ring-stamp/70`, pas de changement de couleur de bordure — l'anneau de focus est le seul signal.
- **Error / Disabled:** erreur = bordure/texte `stamp` affiché dès le premier caractère saisi non conforme (pas au blur) ; disabled = `opacity-50`.

### Navigation
- **Style:** sidebar `bg-ink`, item inactif `text-paper/70` (ou équivalent atténué), hover discret, item actif `bg-stamp text-white` — c'est le seul endroit où le cachet s'applique en fond plein plutôt qu'en accent ponctuel.

### Alert Banners (signature component)
Bandeau pleine largeur en tête de section pour une action requise ou un avertissement bloquant (ex. reçus fiscaux à régénérer, doublon d'adhérent détecté) : fond `warning-tint`, bordure `warning-border`, texte `warning`/`warning` foncé. Distinct des messages d'erreur simples (fond `stamp/[0.04]`, texte `stamp`), réservé aux situations où une action de l'utilisateur est explicitement attendue.

## Do's and Don'ts

### Do:
- **Do** réserver le cachet (stamp) aux éléments actionnables (bouton, lien, focus, item de nav actif) — c'est la seule couleur qui doit attirer l'œil vers une action.
- **Do** utiliser le bandeau ambre (`warning-tint`/`warning-border`) pour toute alerte qui appelle une action de l'utilisateur, jamais le cachet standard de la marque pour ce rôle.
- **Do** afficher les erreurs de champ (email, téléphone) dès le premier caractère non conforme, tant qu'il reste non conforme — pas seulement au blur.
- **Do** utiliser `type="tel"` avec filtrage des chiffres pour tout champ téléphone — jamais `type="number"` (perd les zéros initiaux).
- **Do** utiliser `ScrollShadowX` pour tout tableau susceptible de déborder horizontalement, y compris les tableaux à une seule colonne de contenu (nom + actions) — jamais de bascule en cartes empilées mobile (`block`/`table-row`).
- **Do** garder le contenu sur fond clair même quand la sidebar de navigation est sombre — le contraste sidebar/contenu est un repère spatial, pas une invitation à assombrir le reste de l'UI.
- **Do**, avant de corriger un bouton isolé dans un composant partagé, vérifier si le composant entier est déjà migré vers ce système — sinon, traiter la migration comme un chantier à part (voir la liste des seams ci-dessus), pas une retouche ponctuelle.

### Don't:
- **Don't** mélanger un bouton `Button` (stamp/`rounded-sm`) dans un composant par ailleurs resté sur l'ancien système (indigo/`rounded-lg`) — le résultat bâtard est plus incohérent que l'état actuel ; migrer le composant entier ou ne pas le toucher.
- **Don't** utiliser `title` HTML natif pour une infobulle sur un placeholder — utiliser le composant `Tooltip.tsx` existant.
- **Don't** ajouter d'ombre à une carte de contenu sans qu'elle superpose réellement un autre élément (voir The Structural Shadow Rule).
- **Don't** utiliser de contrainte HTML native bloquante (`min`/`max` sur un input date) qui peut rendre une valeur inatteignable sur certains pickers mobiles — préférer une validation JS après coup.
- **Don't** utiliser `variant="destructive"` (fond plein) comme déclencheur initial d'une action de ligne — réservé à la confirmation finale dans une modale ; le déclencheur utilise `variant="danger"` (contour).
