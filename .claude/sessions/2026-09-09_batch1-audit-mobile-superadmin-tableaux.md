# Batch 1 (Audit mobile + Super-admin tableaux) — retours QA et clôture

## Réalisé

**Batch 1 — 2 cartes, PR #145 puis #146, toutes deux mergées sur `dev`** :
- **Audit mobile : masquer les colonnes redondantes avec la vue détail** (PR #145) : `hidden md:table-cell` sur Activité/Mode (DonsPage.tsx) et Civilité (ParticipantsPage.tsx), déjà visibles dans le `DetailPanel` respectif — redondantes sur mobile.
- **Super-admin : simplifier les tableaux d'organisations + revoir l'en-tête mobile** (PR #146) : retrait des 3 cartes stats globales (compte actives déplacé dans le libellé de l'onglet), table Actives réduite à 1 colonne sans en-tête (date de création + bouton Consulter déplacés dans la modale), table Archivées allégée.
- Après cette 2ᵉ carte, **décision actée avec l'utilisateur** : par défaut, chaque carte d'un batch repart de `dev` directement (pas empilée), sauf dépendance fonctionnelle réelle entre les cartes — corrigé après coup sur PR #146 (`rebase --onto dev` + force-push) car les 2 cartes de ce batch ne partageaient aucun fichier.

**Nouvelle pratique généralisée : retours de QA via listes Trello dédiées "Pr \<numéro\>"** — l'utilisateur crée une liste par PR pendant ses tests (une carte par retour, pas de description), l'agent la traite en un seul passage groupé (pas de dictée au fil de l'eau dans le chat) quand il en a l'occasion. Validé comme le bon calcul coût/latence pour de la QA après coup (pas pour un bug bloquant, qui reste à signaler tout de suite). Mémoire persistante créée ([[feedback_pr_review_trello_lists]]), routine Trello mise à jour.

**Retours de QA appliqués** :
- Liste "Pr 145" : pièces jointes du side panel de don passées en lecture seule (nouveau prop `canAdd` sur `DonFichiers`, `false` uniquement dans `DonsPage.tsx`) ; colonne "Total dons" masquée sous `md` sur ParticipantsPage (déjà visible dans le détail).
- Liste "Pr 146" (2 passages) : bouton Consulter réaligné avec le bouton fermer (mesure bounding box Playwright, `-mt-2`) ; thead retiré de l'onglet Archivées (texte "Archivée le" inline) ; comptes admin désactivés masqués par défaut + toggle pour les révéler ; PIN retiré des lignes archivées (remplacé par la date d'archivage) ; lignes archivées rendues lisibles sur mobile (`block`/`flex-wrap`, débordaient hors écran avant) ; nettoyage hors-sujet demandé explicitement : tailles de police en dur (`text-[11px]`/`text-[10px]`, dette préexistante repérée par le hook impeccable) remontées à `text-xs` (palier DESIGN.md) dans `ParticipantsPage.tsx` et `DonFichiers.tsx`.

**Conflit de rebase rencontré et résolu sur PR #146** : rebasée sur `dev` avant que PR #145 (même fichiers `DonFichiers.tsx`/`ParticipantsPage.tsx`) soit mergée ; le nettoyage typographique ultérieur sur ces mêmes fichiers a divergé de la version mergée de #145 (prop `canAdd` vs `text-xs` sur la même ligne de `DonFichiers.tsx`). Résolu par rebase sur `dev` à jour, fusion manuelle conservant les deux changements, force-push — `mergeable: MERGEABLE` confirmé après coup.

**Trello / journal** : cartes "Audit mobile" et "Super-admin tableaux" déplacées en Done, liste "Batch 1" archivée (vide), listes "Pr 145"/"Pr 146" archivées une fois traitées. `docs/journal-avancement.md` à jour pour les deux PR.

## Reste à faire

- 3 nouvelles cartes détectées en Backlog, pas encore cadrées :
  - "Revoir tous les CTA pour appliquer le design adapté pour chacun" (pas de description)
  - "Appliquer la méthodologie des tableaux à tous les tableaux" — généraliser le principe "masquer sur mobile ce qui est redondant avec le détail" à tous les tableaux de Mothana
  - "Renommer Participants en Donateurs" — cohérence de vocabulaire (features segmentées Dons/Adhérents)
- Backlog Trello général toujours en attente pour le reste (doc utilisateur, agents.md, mire de connexion, OCR, etc.)

## Blockers

Aucun.

## Décisions

- Batch dev : ne plus empiler les branches par défaut, seulement en cas de dépendance fonctionnelle réelle entre les cartes (corrige la pratique du 2026-09-07/08).
- Retours de QA post-PR : listes Trello dédiées "Pr \<numéro\>", traitées en un seul passage groupé — généralisé à toutes les futures PR.
- Dette de style (tailles hors palier DESIGN.md) : corrigée à la demande explicite, même hors sujet, dans la PR en cours plutôt que reportée.
