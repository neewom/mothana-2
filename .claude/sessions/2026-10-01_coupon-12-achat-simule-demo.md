# Coupon 12 — achat public simulé pour démo MVP

## Réalisé

- Carte Trello S2WPkJp7 lue et go utilisateur confirmé ; branche `codex/coupon-12-achat-simule-demo` créée depuis `origin/dev`, PR #197 ouverte immédiatement en draft vers `dev`, commentaire « Dev en cours » publié sur la carte.
- Nouvelle route publique `/e/:organisationSlug/:evenementSlug` et page mobile-first : chargement par `get_evenement_public`, choix d’un palier, email, récapitulatif de paiement fictif clairement signalé, confirmation et accès direct au portefeuille.
- Nouvelle Edge Function `simuler-achat-evenement` : kill-switch strict `SIMULATION_PAIEMENT_ACTIVE === 'true'`, validation d’entrée, appels `service_role` aux RPC existantes `creer_commande_en_attente` puis `activer_commande`, référence `simulation:...`, aucune modification des RPC.
- Email transactionnel Resend avec lien `/p#<secret>` et PDF QR joint. Le helper partagé `resend.ts` accepte désormais des pièces jointes ; `portefeuilleQrPdf.ts` est réutilisé sans modification.
- Fonction déployée sur `mothana-staging` avec `--no-verify-jwt`. Refus `SIMULATION_DESACTIVEE` vérifié switch absent puis switch à `false`. Activation temporaire uniquement pendant le test, puis désactivation confirmée par appel live.
- Parcours complet validé sur le serveur Codex 5174 et staging avec l’événement `association-demo-staging/coupon-4-demo` : achat fictif 5 €, commande `payee` et référence `simulation:...`, email accepté par Resend vers `delivered@resend.dev` avec payload PDF joint, portefeuille visible immédiatement à 5 €.
- Continuité vendeur temps réel validée avec deux sessions navigateur : demande 2 € depuis l’espace bénévole, réception automatique côté portefeuille, acceptation acheteur, résultat vendeur « Décision reçue automatiquement », solde final 3 € et deux mouvements visibles.
- Validation locale : build (`tsc -b` + Vite), 48 tests Vitest, lint ciblé, `deno check`, `git diff --check`, `graphify update .` et détecteur Impeccable verts ; inspection navigateur de la page publique effectuée.
- Commit final poussé ; PR #197 passée en « ready for review » et commentaire « Prête pour review » publié sur Trello.
- **Revue lead tech** (worktree de revue, port 5175, branche checkoutée en détaché) : code relu intégralement, aucun bloquant (validation d'entrée complète, secret jamais loggé, lien portefeuille en fragment jamais transmis au serveur, RPC existantes réutilisées sans modification).
- **Test bout en bout rejoué par le lead tech sur staging** (kill-switch réactivé temporairement, puis redésactivé et vérifié par appel live en 503) : achat 20 € sur `association-demo-staging/coupon-4-demo`, email reçu avec PDF, lien portefeuille menant à un solde correct, desktop + mobile (375px), zéro erreur console.
- **Bug trouvé en testant** : un email factice non routable (`@example.com`) fait échouer Resend (502) *après* que le crédit a déjà été appliqué côté serveur — portefeuille crédité mais inaccessible, aucun recours admin pour réémettre le secret. Avec une vraie adresse, parcours rejoué sans accroc. Décision utilisateur : consigne opérationnelle pour la démo (toujours utiliser une adresse joignable), pas de correctif de code vu le délai.
- PR #197 approuvée (commentaire posté sur la PR et sur Trello), mergée sur `dev` sur go explicite de l'utilisateur (2026-10-01). Carte Trello déplacée en Done, entrée ajoutée dans `docs/journal-avancement.md` dans la même action.
- **Correctif du bug email** (2026-10-01, PR #198 mergée) : sur demande explicite de l'utilisateur après décision de laisser le mode simulation actif au-delà de la seule démo (exposition prolongée, pas juste une fenêtre de quelques minutes). `simuler-achat-evenement` : génération PDF + envoi email passés en best-effort après le crédit (qui est la seule chose qui compte pour la réponse) ; le lien portefeuille est désormais toujours renvoyé dès que le crédit est acquis, avec `email_envoye: false` sinon. Écran d'achat affiche le lien avec un avertissement (tone warning) plutôt qu'un message d'erreur bloquant. Codes `EMAIL_NON_ENVOYE`/`GENERATION_PDF_IMPOSSIBLE` retirés (inatteignables). Validé : `tsc -b`, 48 tests, lint ciblé, `deno check` verts ; redéployé sur staging, kill-switch réactivé temporairement puis redésactivé (vérifié par appel live en 503) ; cas `@example.com` rejoué avec succès (lien + avertissement affichés). Mergée sur go explicite. Journal et backlog `AGENTS.md` mis à jour dans la même action.

## Reste à faire

- Pour la démo du 2026-10-02 : activer explicitement `SIMULATION_PAIEMENT_ACTIVE=true` juste avant, puis remettre `false` immédiatement après (le bug email n'est plus bloquant mais la consigne « vraie adresse » reste la meilleure pratique).
- Carte 11 (dashboard admin) : cadrage entamé avant la carte 12, mis en pause, à reprendre.

## Blockers

- Aucun.

## Décisions

- Une seule Edge Function orchestre création, activation, génération PDF et email afin de garder un seul point protégé par le kill-switch.
- Le switch n’accepte que la chaîne exacte `true` ; toute autre valeur, y compris l’absence ou `false`, bloque avant lecture du payload.
- L’URL portefeuille transmise par le client est limitée aux domaines Samakan/recette et aux hôtes locaux connus du serveur de démo.
- En reprise idempotente d’une commande déjà activée, aucun nouveau secret n’est créé et l’API reste factuelle : elle ne prétend pas que l’email a forcément été envoyé.
