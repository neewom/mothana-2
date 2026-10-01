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

- Merge sur go explicite de l'utilisateur.
- Après merge seulement : déplacer la carte vers Done et ajouter l'entrée correspondante dans `docs/journal-avancement.md` dans la même action.

## Blockers

- Résolu. Deux RPC préexistantes hors des 4 points autorisés, `next_participant_id_externe(uuid)` et `next_adherent_id_externe(uuid)`, étaient `security definer`, sans garde d'organisation, et accordées à tout rôle PostgreSQL `authenticated`. Un JWT vendeur pouvait donc les appeler pour faire avancer une séquence dons/adhésions de n'importe quelle organisation. Point signalé par Codex sur la PR #199 sans modification hors périmètre ; arbitré et corrigé par le lead tech dans la même PR (migration `next_id_externe_organisation_guard.sql`, garde identique à `creer_credit_manuel` : admin de l'organisation ciblée ou super-admin). Validé par 3 tests SQL transactionnels sur staging (admin propre organisation OK, admin autre organisation refusé, vendeur refusé) — aucune régression sur le chemin légitime (`AdherentModal.tsx`/`ParticipantModal.tsx`, admin-only).

## Revue lead tech

- Code relu intégralement (migration, 2 Edge Functions, contexte Auth, routes, écran vendeur, section paramètres) : propre, exactement le périmètre cadré respecté en dehors du blocker ci-dessus.
- `tsc -b`, 48 tests Vitest, lint ciblé, `deno check` verts (après ajout du correctif).
- Validation staging par le lead tech : connexion vendeur réelle (PIN généré par Codex pendant son propre test) sur le worktree de revue (port 5175) → écran isolé « Encaisser sur un portefeuille » uniquement, aucune trace dons/adhésion, zéro erreur console.
- Suggestion non bloquante postée sur la PR : contrairement au bénévole, une expiration de session vendeur ne préserve pas l'état (pas d'overlay de ressaisie PIN) — impact faible, pas de blocage.
- PR #199 approuvée, prête à merger.

## Décisions

- Le rôle vendeur reste volontairement absent de `current_effective_organisation_id()` : l'exclusion des tables dons/adhésions repose sur les policies existantes, sans modifier leur périmètre.
- Les valeurs de rôle des Edge Functions sont limitées à `benevole` et `vendeur` avant tout choix dynamique de colonne.
- Le PIN vendeur est généré uniquement via `update-pin`, jamais saisi manuellement ; la section n'est visible que si `fonctionnalites_activees.evenements` est actif.
- La PR reste en draft tant que le critère de sécurité non négociable n'est pas intégralement démontré.
