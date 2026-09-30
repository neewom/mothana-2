# Session 2026-09-30 — Coupon 3 : protocole 2 téléphones, clôture

Reprise du blocage matériel de la carte 3 (spike temps réel), en pause depuis le 2026-09-27.

## Réalisé

### Infrastructure de test
- `cloudflared` installé, tunnel HTTPS éphémère lancé vers le worktree Codex (`codex/coupon-3-spike-temps-reel`) pour donner accès aux 2 téléphones sans installer Tailscale sur l'appareil emprunté.
- SQL du spike (`supabase/spikes/coupon_transport.sql` + tests) appliqué sur staging, secret `COUPON_SPIKE_ENABLED=true` posé, Edge Function `coupon-transport-spike` déployée.
- **Bug d'infra trouvé et corrigé** : servir via `npm run dev` (HMR) à travers le tunnel gratuit `trycloudflare.com` provoquait des rechargements complets intempestifs de la page (perte d'état) dès que la connexion WebSocket HMR se coupait — comportement connu du client Vite dev (reload automatique à la reconnexion). Corrigé en servant un build de production (`vite preview`, sans client HMR) à la place. Ajout ponctuel de `server.allowedHosts: true` dans `vite.config.ts` du worktree (jamais committé) pour contourner le blocage Vite sur le hostname du tunnel — même limitation que documentée pour le hostname Tailscale.

### Protocole 2 vrais téléphones exécuté
- Vendeur : Galaxy S24 Ultra / Orange 5G. Acheteur : Galaxy S24+ / Bouygues 5G.
- **Scénario 1 (happy path)** dans les deux modes (Broadcast puis Polling) : 25 demandes/rôle (20 acceptées + 5 refusées), aucune perte/doublon de révision. `write-http-round-trip` comparable entre les deux modes sur réseau mobile réel (médianes 430-490 ms) — contrairement à l'écart Mac (666 vs 1255 ms).
- **Scénario 2 (coupure réseau acheteur)** : mode avion posé avant l'envoi de la demande (ordre simplifié, validé comme équivalent au protocole), coupure réelle de 62 s, `read:resume` retrouve la demande correctement.
- **Scénario 5 (verrouillage >90 s)** : 108 s de verrouillage réel, expiration automatique correcte côté serveur (révision +2), aucune acceptation tardive.
- **Scénario 6 (Wi-Fi → mobile)** : plusieurs cycles fallback/reconnect sur ~24 s, aucune régression d'état.
- **Scénario 7 (fermer/rouvrir le lien)** : comportement correct sur le principe, mais a vidé le journal en mémoire du vendeur pour les scénarios 2/3/5/6 (comportement attendu — le journal n'est jamais persisté, seulement en mémoire JS de la page).
- **Scénario 3 (coupure réseau vendeur)** et **scénario 4 (verrouillage 30 s)** : non confirmés côté vendeur (log perdu) / jamais isolés. Décision explicite de ne pas les rejouer — même mécanisme générique (`paymentTransport.ts`) déjà validé deux fois sous d'autres durées, risque jugé faible.
- Question annexe traitée : l'audit des vraies transactions (`demandes_paiement`/`mouvements_portefeuille`) existe déjà nativement (une ligne par demande, jamais réécrite ; ledger append-only) — rien à ajouter côté production, contrairement au banc du spike qui n'a volontairement pas cet historique.

### Clôture
- `docs/spikes/coupon-3-transport.md` mis à jour avec les résultats réels et la décision finale (candidat confirmé : Broadcast + repli polling).
- Secret `COUPON_SPIKE_ENABLED` redésactivé sur staging.
- Conflit avec `dev` résolu sur la branche du spike (fichiers de suivi uniquement — `AGENTS.md`, journal, session du 22/09 — aucun conflit de code, `dev` avait avancé avec les cartes 4/5/10 depuis le 22 septembre).
- **Revue lead tech** de la PR #192 (jamais faite depuis sa livraison le 22/09) : `tsc -b`, 39 tests Vitest, lint ciblé, `deno check` verts ; `paymentTransport.ts` relu en détail (aucun bug) ; sécurité confirmée (grants `service_role`-only, Edge Function verrouillée staging+flag+super-admin, aucun import du spike en production). Aucun bloquant, posté en commentaire PR.
- PR #192 mergée sur `dev` (commit `b67cf4d`) sur autorisation explicite. Routine post-merge faite : `dev` synchronisée, carte 3 déplacée en Done (description enrichie de la note de clôture), `docs/journal-avancement.md` et `AGENTS.md` mis à jour (commit `5a67014`).

### Incident git annexe
- Push refusé par GitHub (`GH007`, email privé protégé). Résolu en committant avec l'email noreply GitHub (`8076017+neewom@users.noreply.github.com`) via variables d'environnement (jamais via `git config`, règle stricte sans exception même sur demande explicite). L'utilisateur a ensuite mis à jour son `git config --global user.email` lui-même vers cette même adresse — vérifié effectif sur les 3 répertoires (checkout principal + 2 worktrees).

## Reste à faire
- Cadrer la carte 11 (dashboard admin événement) — plus aucune dépendance bloquante.
- Cadrer la carte Backlog sur l'accès distinct du vendeur événementiel.
- Démarrer les phases (b) des cartes 4/5 (boucle temps réel bout en bout) maintenant que le candidat de transport est confirmé — nécessite un nouveau cadrage avant dev.
- Carte 6 (paiement) toujours en attente côté utilisateur (Stripe, avis juridique).
- **Écart repéré en session, non traité** : la carte "Priorité 5 — Export comptable enrichi" (item 6 du backlog condensé `AGENTS.md`) est en réalité dans la liste Trello **Backlog**, pas Todo comme le backlog condensé le laisse penser — à corriger ou à confirmer intentionnel au prochain point de check.

## Blockers
Aucun.

## Décisions
- Candidat de transport définitif pour le porte-monnaie événementiel : Broadcast (signal de changement) + relecture serveur, avec repli polling.
- Servir un build de production (`vite preview`) plutôt que le serveur de dev pour tout test via tunnel externe — le client HMR provoque des rechargements complets à travers un tunnel instable.
- Ordre simplifié pour le scénario de coupure réseau : couper le réseau avant l'action plutôt qu'immédiatement après, plus simple à exécuter en solo et validant la même garantie de réconciliation.
