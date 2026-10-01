# Campagne mailing — détail nominatif des exclus

## Réalisé

- Carte Trello `EofwzM1G` lue et go utilisateur confirmé ; branche `codex/mailing-exclus-nominatifs` créée depuis `origin/dev`, PR #204 ouverte immédiatement en draft vers `dev`, commentaire « Dev en cours » publié sur la carte.
- Le comptage avant envoi distingue désormais quatre groupes mutuellement exclusifs : destinataires valides, email manquant, email invalide et contacts refusés (opt-out).
- Les filtres de statut, liste de diffusion et liste d'exclusion sont appliqués avant la classification, y compris aux opt-out.
- Chaque compteur non vide possède son CTA « Voir la liste » ; la modale nominative affiche la catégorie correspondante et chaque ligne ouvre la fiche adhérent complète, au clic comme au clavier.
- La règle de validation email a été centralisée dans `src/lib/mailingRecipients.ts`, avec quatre tests unitaires couvrant la distinction manquant/invalide, la priorité opt-out et l'exclusivité des groupes.
- Validation locale verte : `tsc -b`, lint ciblé, 55 tests Vitest, build Vite, `git diff --check`, détecteur Impeccable et `graphify update .`.
- Validation fonctionnelle/UX directe obtenue de l'utilisateur sur le port 5174 ; PR #204 passée en ready for review et commentaire « prête pour review » publié sur Trello.

## Reste à faire

- Revue complète par le lead tech, puis corrections éventuelles dans cette même PR.
- Après approbation lead tech et autorisation explicite utilisateur : merge, déplacement Trello vers Done et entrée correspondante dans `docs/journal-avancement.md` dans la même action.

## Blockers

- Aucun blocker. La limitation d'inspection automatisée avec une session admin réelle a été levée par la validation directe de l'utilisateur sur l'environnement 5174.

## Décisions

- Un contact opt-out appartient toujours à la catégorie « contacts refusés », même si son email est vide ou invalide ; cela garantit l'exclusivité des trois motifs de non-envoi.
- Aucun changement dans `send-mailing-brevo` ni dans l'historique `nombre_exclus`, conformément au hors-périmètre du ticket.
- La modale de liste est réutilisée entre les quatre catégories afin de conserver exactement le même comportement d'ouverture de fiche adhérent.
