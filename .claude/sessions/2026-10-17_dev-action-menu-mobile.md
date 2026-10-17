# 2026-10-17 — Session dev (Claude Code dev) : menu « Listes » hors écran en mobile

Go utilisateur transmis par le lead tech pour la carte « [S] Mobile : le menu « Listes » des Adhérents sort de l'écran » (https://trello.com/c/0GKHh9qb) — bug prod prioritaire, branche `fix/action-menu-mobile-debordement` depuis `origin/dev` (6ac8d3d), PR #245 → `dev`.

## Réalisé
- `ui/action-menu` : à l'ouverture (`useLayoutEffect`, avant affichage), mesure du bouton et de la largeur du menu ; `align` reste la préférence, l'autre côté est pris seulement si la préférence sort de la fenêtre (marge 8 px) et que l'autre tient. Recalcul au redimensionnement pendant que le menu est ouvert.
- Vérifié (Playwright, Adhérents, 5174) : 375 px → menu 43..235 (ouvert à gauche, bouton 43..136) ; 768 px → 527..719 et 1 400 px → 1159..1351 (alignés à droite comme avant) ; flèches, Échap (focus rendu au bouton), clic extérieur OK ; redimensionnement 1 400 → 375 menu ouvert → bascule ; clic sur une entrée à 375 px ouvre bien la fenêtre.

## Reste à faire
- Revue lead tech, test utilisateur, merge, promotion rapide.

## Blockers
- Aucun.
