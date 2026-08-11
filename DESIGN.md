---
name: Mothana
description: Outil de gestion des dons et adhésions pour associations — sobre, dense, fiable
colors:
  indigo-primary: "#4f46e5"
  indigo-primary-hover: "#4338ca"
  indigo-focus-ring: "#6366f1"
  indigo-tint: "#eef2ff"
  indigo-tint-border: "#e0e7ff"
  slate-canvas: "#f8fafc"
  slate-surface-hover: "#f1f5f9"
  slate-border: "#e2e8f0"
  slate-input-border: "#cbd5e1"
  slate-muted-icon: "#94a3b8"
  slate-secondary-text: "#64748b"
  slate-body-text: "#475569"
  slate-heading-text: "#334155"
  slate-ink: "#0f172a"
  red-tint: "#fef2f2"
  red-border: "#fecaca"
  red-action: "#dc2626"
  red-action-hover: "#b91c1c"
  amber-tint: "#fffbeb"
  amber-badge: "#fef3c7"
  amber-border: "#fde68a"
  amber-border-strong: "#fcd34d"
  amber-text: "#b45309"
  amber-text-strong: "#92400e"
  emerald-tint: "#ecfdf5"
  emerald-text: "#059669"
  emerald-text-strong: "#047857"
typography:
  display:
    fontFamily: "ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.5rem"
    fontWeight: 700
    lineHeight: 1.3
  headline:
    fontFamily: "ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.25rem"
    fontWeight: 600
    lineHeight: 1.4
  body:
    fontFamily: "ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.5
  label:
    fontFamily: "ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 500
    lineHeight: 1.4
rounded:
  sm: "6px"
  md: "8px"
  lg: "12px"
  xl: "16px"
  full: "9999px"
spacing:
  xs: "8px"
  sm: "12px"
  md: "16px"
  lg: "24px"
components:
  button-primary:
    backgroundColor: "{colors.indigo-primary}"
    textColor: "#ffffff"
    rounded: "{rounded.md}"
    padding: "8px 16px"
    typography: "{typography.body}"
  button-primary-hover:
    backgroundColor: "{colors.indigo-primary-hover}"
  button-secondary:
    backgroundColor: "#ffffff"
    textColor: "{colors.slate-heading-text}"
    rounded: "{rounded.md}"
    padding: "8px 16px"
    typography: "{typography.body}"
  button-secondary-hover:
    backgroundColor: "{colors.slate-canvas}"
  button-danger:
    backgroundColor: "{colors.red-action}"
    textColor: "#ffffff"
    rounded: "{rounded.md}"
    padding: "8px 16px"
    typography: "{typography.body}"
  button-danger-hover:
    backgroundColor: "{colors.red-action-hover}"
  input-field:
    backgroundColor: "#ffffff"
    textColor: "{colors.slate-heading-text}"
    rounded: "{rounded.md}"
    padding: "8px 12px"
    typography: "{typography.body}"
  card:
    backgroundColor: "#ffffff"
    rounded: "{rounded.lg}"
    padding: "20px"
---

# Design System: Mothana

## Overview

**Creative North Star: "Le Registre Associatif"**

Mothana s'adresse à des admins d'association, des bénévoles sur le terrain et des super-admins qui gèrent plusieurs organisations — pas à des visiteurs à séduire. L'interface se pense comme un registre : dense, fiable, lisible d'un coup d'œil, où chaque écran privilégie la tâche à accomplir (saisir un don, retrouver un adhérent, générer un reçu fiscal) sur toute forme de démonstration visuelle. La rigueur vient du sujet lui-même — reçus Cerfa, données personnelles, argent — pas d'une esthétique institutionnelle froide : l'indigo dynamique et les surfaces blanches largement aérées gardent l'outil accueillant pour un public de bénévoles associatifs pas toujours technophile.

Le système est aujourd'hui une implémentation Tailwind cohérente mais non factorée : les mêmes motifs (bouton primaire, carte, header de page) sont recopiés composant par composant plutôt qu'extraits en primitives partagées — c'est la dette identifiée à l'issue de la revue UI responsive (PR #57, pattern de header dupliqué cassé sur mobile dans 5 fichiers). Ce DESIGN.md documente le système tel qu'il existe dans le code pour servir de référence commune ; l'extraction en composants réutilisables est un chantier séparé, pas encore fait.

**Key Characteristics:**
- Surfaces plates au repos (bordure fine + `shadow-sm`), aucune décoration gratuite.
- Un seul accent (indigo) tenu strictement au registre actionnable : boutons primaires, liens, focus. Le reste de l'UI est neutre (slate + blanc).
- Sidebar admin sombre (`slate-900`) contrastant avec un contenu clair — repère spatial constant entre navigation et contenu.
- Formes douces et mesurées (`rounded-lg`/`rounded-xl`), jamais anguleuses ni exagérément arrondies.
- Densité d'information élevée assumée (tableaux, listes, formulaires multi-champs) : la hiérarchie vient de la typographie et de l'espacement, pas de l'ornementation.

## Colors

Palette resserrée autour d'un seul accent et d'une échelle de gris neutre ; les couleurs sémantiques (rouge/ambre/émeraude) sont réservées à la signalisation d'état, jamais décoratives.

### Primary
- **Indigo Dynamique** (`#4f46e5`) : boutons d'action primaire, liens actifs, item de navigation sélectionné, anneau de focus (`#6366f1`). Porte l'énergie de l'outil — c'est la seule couleur qui appelle une action.
- **Indigo Tint** (`#eef2ff`) : fonds de badge/bandeau discrets liés à l'accent (ex. rappels contextuels), bordure assortie `#e0e7ff`.

### Neutral
- **Slate Canvas** (`#f8fafc`) : fond de page et fond de champ désactivé.
- **Slate Border** (`#e2e8f0`) : séparateurs de carte, bordures de tableau.
- **Slate Input Border** (`#cbd5e1`) : bordure par défaut des champs de formulaire.
- **Slate Muted Icon** (`#94a3b8`) : icônes secondaires, placeholders.
- **Slate Secondary Text** (`#64748b`) : texte de sous-titre, méta-information (dates, compteurs).
- **Slate Body Text** (`#475569`) : texte de corps courant, labels de formulaire.
- **Slate Heading Text** (`#334155`) : texte de bouton secondaire, valeurs de tableau.
- **Slate Ink** (`#0f172a`) : titres de page, texte à plus fort contraste, fond de la sidebar admin.

### Named Rules (optional, powerful)
**The One Accent Rule.** L'indigo n'apparaît que sur des éléments actionnables ou leur état actif (bouton, lien, focus, item de nav sélectionné). Aucun usage décoratif ou illustratif.

## Typography

**Display/Body/Label Font:** Pile système par défaut de Tailwind (`ui-sans-serif, system-ui, -apple-system, sans-serif`) — pas de police custom chargée.

**Character:** Une seule famille pour tout le système, différenciée uniquement par taille et graisse. Le choix d'une police système (plutôt qu'une police éditoriale) sert la lisibilité en conditions de terrain (saisie bénévole sur mobile) et évite tout coût de chargement.

### Hierarchy
- **Display** (700, 1.5rem/24px, 1.3) : titre de page (`<h1>` en tête de chaque écran admin, ex. "Adhérents", "Dons").
- **Headline** (600, 1.25rem/20px, 1.4) : titre de modale, titre de section repliable.
- **Body** (400–500, 0.875rem/14px, 1.5) : texte courant, libellés de formulaire, contenu de bouton.
- **Label** (500, 0.75rem/12px, 1.4) : badges de statut, texte de tableau dense, sous-libellés.

### Named Rules (optional)
**The PIN Exception Rule.** Le champ de saisie du code PIN bénévole est la seule dérogation volontaire à l'échelle : `text-3xl font-bold tracking-[0.5em]` pour maximiser la lisibilité d'un code court sur un écran tactile en conditions de terrain.

## Layout

Rythme vertical de page en paliers de 24px (`space-y-6`) entre les grands blocs d'un écran (titre, filtres, tableau). À l'intérieur d'une carte, l'en-tête (recherche/filtres/actions) et le pied (pagination) se détachent du corps par une bordure `slate-border` plutôt que par un espace vide, avec un padding horizontal de 24px (`px-6`) et vertical de 12–16px (`py-3`/`py-4`).

Le contenu s'organise en cartes pleine largeur (`rounded-xl border border-slate-200 bg-white shadow-sm`) plutôt qu'en grille de widgets. Les tableaux larges utilisent un scroll horizontal contenu dans la carte (`ScrollShadowX`, PR #57) plutôt qu'une bascule en liste de cartes empilées sur mobile — convention actée pour tout nouveau tableau.

La navigation admin est une sidebar fixe sombre (`bg-slate-900`) sur desktop, qui se rétracte en tiroir sur mobile — le contenu, lui, reste toujours sur fond clair (`slate-canvas`/blanc).

## Elevation & Depth

Système à plat par défaut : les cartes se distinguent du fond par une bordure fine (`border-slate-200`) plus une ombre à peine perceptible (`shadow-sm`), qui sert de garde-fou visuel plutôt que d'effet de profondeur. L'élévation plus marquée est réservée aux éléments qui se superposent réellement au reste de l'interface — c'est un signal structurel (« ceci flotte au-dessus »), jamais un choix esthétique.

### Shadow Vocabulary (if applicable)
- **Repos** (`shadow-sm`) : cartes, panneaux, conteneurs de tableau — quasi imperceptible, marque juste une surface.
- **Notification** (`shadow-lg`) : toast de confirmation flottant en bas d'écran.
- **Superposition** (`shadow-xl`) : modales — le niveau d'ombre le plus fort du système, réservé à ce qui recouvre effectivement le reste de l'écran.

### Named Rules (optional)
**The Structural Shadow Rule.** Le niveau d'ombre encode la position dans la pile d'affichage (surface plate < notification flottante < superposition modale), pas une intention décorative. Ne jamais monter une carte de contenu à `shadow-lg`/`shadow-xl` sans qu'elle superpose réellement autre chose.

## Shapes

Douceur mesurée : les angles sont toujours adoucis, jamais vifs ni exagérément arrondis. Le radius croît avec la taille/l'importance du conteneur plutôt que d'être uniforme : `rounded-lg` (8px) pour les éléments interactifs denses (boutons, champs, petits badges), `rounded-xl` (12px) pour les cartes et panneaux de contenu, `rounded-2xl` (16px) pour les modales et grands panneaux, `rounded-full` pour les pastilles de statut, avatars et indicateurs circulaires. Bordures fines (1px, `slate-200`/`slate-300`) partout où une séparation est nécessaire — jamais de bordure épaisse sauf pour signaler un état d'alerte non ignorable (ex. avertissement de doublon, `border-2 border-amber-300`).

## Components

### Buttons
- **Shape:** `rounded-lg` (8px), jamais d'autre radius sur un bouton.
- **Primary:** fond indigo (`#4f46e5`), texte blanc, `px-4 py-2 text-sm font-medium` (boutons compacts en table : `px-3 py-1.5 text-xs`).
- **Hover / Focus:** hover assombrit vers `#4338ca` ; focus ajoute `ring-2 ring-indigo-500 ring-offset-2` sur les actions de formulaire critiques (validation, suppression).
- **Secondary / Ghost:** fond blanc, bordure `slate-300`, texte `slate-700`, hover `bg-slate-50` — même géométrie et typographie que le primaire, seule la couleur change.
- **Danger:** même forme, fond rouge (`#dc2626`) ou variante outline rouge selon la gravité de l'action.
- **Disabled:** `opacity-60`/`opacity-40` plutôt qu'un changement de couleur — préserve la lisibilité du libellé.

### Chips / Badges
- **Style:** `rounded-full`, fond teinté pâle + texte de la même famille de couleur plus saturé (`bg-emerald-50 text-emerald-700` pour "Actif", `bg-amber-50 text-amber-700` pour "Inactif").
- **State:** encode exclusivement un statut métier (actif/inactif, étape d'une demande d'adhésion) — jamais un badge purement décoratif.

### Cards / Containers
- **Corner Style:** `rounded-xl` (12px) ; `rounded-2xl` (16px) pour les panneaux pleine page (ex. carte de connexion PIN).
- **Background:** blanc sur fond `slate-canvas`.
- **Shadow Strategy:** `shadow-sm` au repos (voir Elevation).
- **Border:** `border border-slate-200`.
- **Internal Padding:** 20–24px (`p-5`/`p-6`), header/footer de carte détaché par une bordure interne plutôt qu'un espace.

### Inputs / Fields
- **Style:** fond blanc, bordure `slate-300`, `rounded-lg`, `px-3 py-2 text-sm`.
- **Focus:** `ring-2 ring-indigo-500`, pas de changement de couleur de bordure — l'anneau de focus est le seul signal.
- **Error / Disabled:** erreur = bordure/texte rouge affiché dès le premier caractère saisi non conforme (pas au blur) ; disabled = fond `slate-50`.

### Navigation
- **Style:** sidebar `bg-slate-900`, item inactif `text-slate-300`, hover `bg-slate-800`, item actif `bg-indigo-600 text-white` — c'est le seul endroit où l'indigo s'applique en fond plein plutôt qu'en accent ponctuel.

### Alert Banners (signature component)
Bandeau pleine largeur en tête de section pour une action requise ou un avertissement bloquant (ex. reçus fiscaux à régénérer, doublon d'adhérent détecté) : fond `amber-50`, bordure `amber-200`/`amber-300`, texte `amber-800`/`900`. Distinct des messages d'erreur simples (`red-50`/`red-700`), réservé aux situations où une action de l'utilisateur est explicitement attendue.

## Do's and Don'ts

### Do:
- **Do** réserver l'indigo aux éléments actionnables (bouton, lien, focus, item de nav actif) — c'est la seule couleur qui doit attirer l'œil vers une action.
- **Do** utiliser le bandeau ambre (`amber-50`/`amber-200`) pour toute alerte qui appelle une action de l'utilisateur, jamais l'indigo standard de la marque pour ce rôle.
- **Do** afficher les erreurs de champ (email, téléphone) dès le premier caractère non conforme, tant qu'il reste non conforme — pas seulement au blur.
- **Do** utiliser `type="tel"` avec filtrage des chiffres pour tout champ téléphone — jamais `type="number"` (perd les zéros initiaux).
- **Do** faire croître le radius avec la taille du conteneur (`rounded-lg` interactif dense → `rounded-2xl` modale) plutôt que d'appliquer un radius uniforme.
- **Do** garder le contenu sur fond clair même quand la sidebar de navigation est sombre — le contraste sidebar/contenu est un repère spatial, pas une invitation à assombrir le reste de l'UI.

### Don't:
- **Don't** dupliquer le pattern de header de page (titre + actions) fichier par fichier — c'est la dette à l'origine de 5 des 6 bugs mobile corrigés en PR #57 ; à factoriser en composant partagé plutôt qu'à recopier une nouvelle fois.
- **Don't** utiliser `title` HTML natif pour une infobulle sur un placeholder — utiliser le composant `Tooltip.tsx` existant.
- **Don't** monter une carte de contenu à `shadow-lg`/`shadow-xl` sans qu'elle superpose réellement un autre élément (voir The Structural Shadow Rule).
- **Don't** utiliser de contrainte HTML native bloquante (`min`/`max` sur un input date) qui peut rendre une valeur inatteignable sur certains pickers mobiles — préférer une validation JS après coup.
