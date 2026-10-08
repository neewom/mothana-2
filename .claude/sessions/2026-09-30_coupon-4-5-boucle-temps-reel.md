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
- Validation fonctionnelle utilisateur terminée sur les scénarios temps réel, coupure réseau et verrouillage. Clarification actée : après rechargement complet, le vendeur revient au formulaire (la restauration du dernier statut terminé n’est pas dans le ticket) ; la reprise automatique concerne la page restée ouverte après arrière-plan/coupure.
- Ajustement UX après test utilisateur : composant partagé `StatusNotice` pour unifier format et espacements des notifications acheteur/vendeur ; résultats terminaux renforcés (validation verte, refus rouge) et boutons Accepter/Refuser différenciés par leur couleur sémantique. Rendus attente/refus/validation vérifiés sur staging dans deux sessions navigateur.
- Validation visuelle utilisateur reçue ; PR #196 passée de draft à « ready for review » et commentaire « Prête pour review » publié sur les deux cartes Trello.
- Validation locale : `npm run build`, 43 tests Vitest, lint ciblé, `deno check`, `git diff --check`, détecteur Impeccable et `graphify update .` réussis. Audit staging des privilèges : les RPC de résolution/décision restent absentes pour `anon` et `authenticated`.

## Reste à faire

- Le lead tech effectue l’unique revue complète de la PR #196 ; intégrer ses éventuels retours.
- Après merge seulement : déplacer les deux cartes vers Done et ajouter l’entrée correspondante dans `docs/journal-avancement.md` dans la même action.

## Blockers

- Aucun.

## Décisions

- Aucun changement à `paymentTransport.ts` et aucun Postgres Changes.
- Le vendeur ne reçoit jamais le `secret_hash` : la création émet le réveil acheteur depuis un trigger serveur qui lit les secrets actifs.
- Canal acheteur strictement égal au `secret_hash`; canal vendeur `coupon-payment:<demande_id>`; payloads Broadcast toujours vides.
- Révision acheteur calculée sur les timestamps portefeuille/événement/mouvements/demandes, y compris le passage temporel à l’expiration ; révision vendeur dérivée de `updated_at` et de `expire_le` pour rester strictement monotone.
