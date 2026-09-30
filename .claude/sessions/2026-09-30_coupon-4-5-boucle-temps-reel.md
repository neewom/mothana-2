# Coupon 4/5 — boucle temps réel (phase b)

## Réalisé

- Branche `codex/coupon-4-5-boucle-temps-reel` créée depuis `origin/dev`, PR #196 ouverte immédiatement en draft vers `dev`, puis commentaire « Dev en cours » publié sur les deux cartes Trello.
- `paymentTransport.ts` réutilisé sans modification côté acheteur et vendeur : Broadcast comme signal de réveil, relecture autoritaire, polling de secours, suspension/reprise sur visibilité et réseau.
- Page acheteur : canal public égal au `secret_hash`, affichage de la demande en attente (montant, solde avant/après), actions Accepter/Refuser et messages de résultat.
- Écran vendeur : canal public dérivé du `demande_id`, lecture RLS automatique de la demande, conservation d’un bouton d’actualisation manuelle en repli.
- Nouvelle Edge Function `decider-portefeuille-paiement` : valide l’entrée, résout le portefeuille via `resoudre_hash_secret_portefeuille`, appelle `decider_demande_paiement` en `service_role`, puis émet un signal vide vers le vendeur. Aucun `portefeuille_id` client n’est accepté et aucun secret n’est journalisé.
- Migration `portefeuille_boucle_temps_reel.sql` : révision monotone en microsecondes dans l’état acheteur et trigger `realtime.send` à payload vide vers les secrets actifs lors des mutations de demande. Il s’agit de Broadcast, pas de Postgres Changes.
- Migration appliquée sur `mothana-staging`; fonctions `get-portefeuille`, `generate-portefeuille-qr-pdf` et `decider-portefeuille-paiement` déployées.
- Parcours staging validé dans deux sessions navigateur sur le portefeuille `C4DE5A6B7C` : demande visible automatiquement côté acheteur, acceptation visible automatiquement côté vendeur, refus idem, demande récupérée après rechargement acheteur, annulation vendeur retirée automatiquement côté acheteur. Le secret temporaire créé pour le test a été révoqué et le refus d’accès après révocation vérifié.
- Validation locale : `npm run build`, 43 tests Vitest, lint ciblé, `deno check`, `git diff --check`, détecteur Impeccable et `graphify update .` réussis. Audit staging des privilèges : les RPC de résolution/décision restent absentes pour `anon` et `authenticated`.

## Reste à faire

- L’utilisateur teste la PR draft sur les deux téléphones réels, notamment après coupure réseau ou verrouillage d’un écran. Le serveur Codex tourne sur le port 5174.
- Après validation fonctionnelle utilisateur : passer la PR #196 en « ready for review », publier « prête pour review » sur les deux cartes et laisser le lead tech effectuer l’unique revue complète.
- Après merge seulement : déplacer les deux cartes vers Done et ajouter l’entrée correspondante dans `docs/journal-avancement.md` dans la même action.

## Blockers

- Aucun blocker de code ou de staging. Le scénario matériel réel coupure/verrouillage nécessite l’utilisateur et ses deux téléphones.

## Décisions

- Aucun changement à `paymentTransport.ts` et aucun Postgres Changes.
- Le vendeur ne reçoit jamais le `secret_hash` : la création émet le réveil acheteur depuis un trigger serveur qui lit les secrets actifs.
- Canal acheteur strictement égal au `secret_hash`; canal vendeur `coupon-payment:<demande_id>`; payloads Broadcast toujours vides.
- Révision acheteur calculée sur les timestamps portefeuille/événement/mouvements/demandes, y compris le passage temporel à l’expiration ; révision vendeur dérivée de `updated_at` et de `expire_le` pour rester strictement monotone.
