# 2026-10-24 — Session dev (Claude Code dev) : batch « Sécurité (audit 2026-10-24) »

Go utilisateur transmis par le lead tech pour 6 cartes (non empilé, PR vers `dev`). Tickets rédigés sur `origin/dev` à 22c5cee. Le batch « Fiabilité & accueil » (#278-#280) attend le test utilisateur.

## Réalisé
- **Carte 1 — Comptes bénévole/vendeur** (https://trello.com/c/B0JcJIKE) — PR #282, ready for review. Architecture validée par le lead tech : aucun secret stocké.
  - `verify-pin` : PIN vérifié (limite de débit conservée), puis session par `auth.admin.generateLink` (magiclink, aucun email) + `verifyOtp` ; réponse inchangée (access, refresh, organisation_id). Compte créé avec un mot de passe aléatoire (32 octets).
  - Migration `comptes_techniques_secret.sql` (staging) : mots de passe des comptes techniques existants remplacés par un aléa bcrypt (motif strict rôle + UUID + `@mothana.internal`, idempotent, à rejouer en prod) ; RPC `revoquer_sessions_compte_technique` (service_role seul).
  - `update-pin` : PIN par `crypto.getRandomValues` (tirage par rejet), compte retrouvé par email via la RPC (plus de `listUsers` paginé), sessions supprimées, mot de passe régénéré. Access token déjà émis : valable jusqu'à son expiration (1 h).
  - `request-email-change` : `auth.getUser(token)` (le JWT n'était pas vérifié) + refus des rôles benevole/vendeur. Carte 5 ne couvrira que create-admin, disable-admin, delete-org-admins.
  - Vérifié (staging) : avant, connexion directe avec le PIN = 200 ; après = 400. verify-pin bénévole et vendeur OK (mêmes clés, bons claims) ; rotation → refresh de l'ancienne session 400, ancien PIN 401, nouveau PIN 200, nouveau PIN en mot de passe direct 400 ; email-change bénévole 403 ; connexion bénévole UI OK. Tests SQL `comptes_techniques_secret.sql` OK. PIN bénévole de l'org démo restauré après le test de rotation.
- **Carte 2 — RLS bénévole, secrets, reçus** (https://trello.com/c/aSKiYaaa) : recensement fait (Explore), stratégie validée par le lead tech — table `organisation_secrets` (RLS sans policy, RPC DEFINER), déploiement en 3 temps, reçus en lecture seule sans trigger d'immutabilité, RLS bénévole dédiée, retrait de `id` de `get_organisation_public`, découpage en 2 PR (a : secrets/reçus/org/get_organisation_public ; b : RLS bénévole). **En suspens : droits contributeur sur `org_update_admin`** (décision utilisateur attendue via le lead tech).
- **Carte 3 — Aperçus, CSS public, dépendances** (https://trello.com/c/2k6NwryS) — PR #283, ready for review. `sandbox=""` sur les 5 iframes `srcDoc` (la 6e est le PDF généré, laissée sans sandbox) ; `ShadowHtmlBlock` : CSS en `textContent`, HTML assaini inséré en nœuds, `contain: paint` ; `@tiptap/*` 3.32.0 (+ `@tiptap/pm` en dépendance directe, peer requis) et `dompurify` 3.4.17, `overrides` pour la copie de `monaco-editor` (3.2.7). `npm audit` : plus aucune alerte Tiptap/ProseMirror/DOMPurify (11 restantes sur d'autres paquets). Preuve avant/après sur l'org démo (charges `console.log`) : avant, le CSS s'exécutait sur la page publique et l'en-tête dans l'aperçu ; après, rien. Aperçus reçu/carte fidèles, éditeur Tiptap OK. Champs du formulaire de l'org démo remis à vide.

## Reste à faire
- Carte 2 (2 PR, une décision en suspens), cartes 4 à 6.

## Blockers
- Aucun.
