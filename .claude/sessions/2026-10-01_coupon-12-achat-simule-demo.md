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

## Reste à faire

- Le lead tech effectue l’unique revue complète ; intégrer ses éventuels retours.
- Après merge seulement : déplacer la carte vers Done et ajouter l’entrée correspondante dans `docs/journal-avancement.md` dans la même action.
- Pour la démo du 2026-10-02 : activer explicitement `SIMULATION_PAIEMENT_ACTIVE=true` juste avant, puis remettre `false` immédiatement après.

## Blockers

- Aucun.

## Décisions

- Une seule Edge Function orchestre création, activation, génération PDF et email afin de garder un seul point protégé par le kill-switch.
- Le switch n’accepte que la chaîne exacte `true` ; toute autre valeur, y compris l’absence ou `false`, bloque avant lecture du payload.
- L’URL portefeuille transmise par le client est limitée aux domaines Samakan/recette et aux hôtes locaux connus du serveur de démo.
- En reprise idempotente d’une commande déjà activée, aucun nouveau secret n’est créé et l’API reste factuelle : elle ne prétend pas que l’email a forcément été envoyé.
