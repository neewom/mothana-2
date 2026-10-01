# Coupon 13 — accès vendeur distinct de l'espace bénévole

## Réalisé

- Carte Trello RgdeUQja lue et go utilisateur confirmé ; branche `codex/coupon-13-acces-vendeur-distinct` créée depuis `origin/dev`, PR #199 ouverte immédiatement en draft vers `dev`, commentaire « Dev en cours » publié sur la carte.
- Migration staging appliquée : colonne nullable `organisations.code_pin_vendeur_evenement`, helper `current_vendeur_organisation_id()`, et extension strictement limitée aux 4 points cadrés (`evenements_benevole_select`, `demandes_paiement_benevole_select`, `creer_demande_paiement`, `annuler_demande_paiement`).
- Edge Functions `verify-pin` et `update-pin` étendues avec un rôle explicite `vendeur` et une valeur par défaut `benevole` pour la compatibilité ; compte technique `vendeur-{org_id}@mothana.internal` et self-heal des metadata vérifiés sur staging.
- Frontend ajouté : `/login/vendeur`, état Auth `vendeur`, route protégée `/vendeur`, écran réutilisant uniquement `BenevoleEvenement`, lien depuis l'accueil et section de génération du PIN dans les paramètres lorsque le module événements est actif.
- Test SQL transactionnel staging vert : le vendeur peut lire son événement, créer/annuler une demande de paiement et lire ses demandes ; il ne peut ni lire ni écrire `dons`, `profils_participant`, `adherents` ou `adhesions`, et les RPC d'import dons/adhérents le refusent.
- Test réel sur 5174 : génération du PIN via `update-pin`, connexion vendeur, écran événement seul, accès direct à `/benevole` renvoyé vers `/vendeur`. Avec le JWT vendeur réel : 1 événement visible, 0 don, 0 donateur, 0 adhérent, 0 adhésion ; `import_upsert_dons` répond `Unauthorized`.
- Validation locale : `tsc -b`, lint ciblé, `deno check`, 48 tests Vitest, `git diff --check`, `graphify update .`, contrôle Impeccable et inspection visuelle desktop/mobile verts.

## Reste à faire

- Arbitrer le blocker sécurité ci-dessous avec le lead tech avant de passer la PR en « ready for review ».
- Après arbitrage : ajuster le test/périmètre si nécessaire, relancer les validations, pousser le commit final, passer la PR en review et publier le commentaire Trello « Prête pour review ».
- Après merge seulement : déplacer la carte vers Done et ajouter l'entrée correspondante dans `docs/journal-avancement.md` dans la même action.

## Blockers

- Deux RPC préexistantes hors des 4 points autorisés, `next_participant_id_externe(uuid)` et `next_adherent_id_externe(uuid)`, sont `security definer`, sans garde d'organisation, et accordées à tout rôle PostgreSQL `authenticated`. Un JWT vendeur peut donc les appeler pour lire/faire avancer une séquence dons/adhésions. Point signalé sur la PR #199 ; aucune modification hors périmètre effectuée sans arbitrage.

## Décisions

- Le rôle vendeur reste volontairement absent de `current_effective_organisation_id()` : l'exclusion des tables dons/adhésions repose sur les policies existantes, sans modifier leur périmètre.
- Les valeurs de rôle des Edge Functions sont limitées à `benevole` et `vendeur` avant tout choix dynamique de colonne.
- Le PIN vendeur est généré uniquement via `update-pin`, jamais saisi manuellement ; la section n'est visible que si `fonctionnalites_activees.evenements` est actif.
- La PR reste en draft tant que le critère de sécurité non négociable n'est pas intégralement démontré.
