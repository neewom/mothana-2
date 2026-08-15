# Session du 2026-08-13 — Campagnes mailing Brevo : cadrage étendu + démarrage dev

## Réalisé

### Cadrage complémentaire de la carte "Campagnes de mailing d'information aux adhérents via Brevo"
- Ajout de la pièce jointe au cadrage : document statique (PDF/image, 10 Mo max), même fichier pour tous les destinataires — explicitement distinct de la pièce jointe personnalisée par destinataire (ex. reçu fiscal), qui reste sur sa propre carte [Priorité 4 — Envoi email des reçus fiscaux](https://trello.com/c/Do9GVjOt) (Resend, pas encore cadrée). Chevauchement identifié et tranché : pas de fusion.
- Prérequis externe levé : l'admin de Wat Velouvanaram a créé son compte Brevo et l'utilise déjà manuellement pour d'autres campagnes.
- **Extension importante du cadrage, actée avec l'utilisateur** :
  - Clé API Brevo **par organisation** (pas un secret partagé plateforme) — cohérent avec le pattern multi-tenant déjà en place (chaque org a ses propres paramètres Cerfa/carte adhérent). Nouvelles colonnes `organisations.brevo_api_key` / `brevo_expediteur_nom` / `brevo_expediteur_email`.
  - Emplacement de la configuration : nouvelle sous-page dédiée dans le module **Adhérents** (pas Paramètres) — `/admin/adherents/mailing`, sur demande explicite de l'utilisateur (la fonctionnalité ne concerne que les adhérents).
  - Composition : éditeur enrichi (TipTap) plutôt que texte simple.
  - Historique minimal conservé (date, sujet, nb destinataires, nb exclus) — nouvelle table dédiée `campagnes_mailing`, pas de réutilisation de `journal_modifications` (modèle existant trop typé autour des diffs de champs adhérent).
- **Discussion multi-fournisseur (Mailchimp etc.)** : l'utilisateur a interrogé la possibilité de proposer plusieurs interfaces selon le fournisseur choisi. Décision : non pour l'instant — Brevo uniquement, pas d'abstraction ni d'UI multi-fournisseur tant qu'aucune organisation ne le demande concrètement (modèles trop différents entre fournisseurs : Brevo = envoi transactionnel direct, Mailchimp = audiences/campagnes — une abstraction conçue à l'aveugle serait mal alignée sur le vrai besoin).
- **Correction de conception importante** (question pertinente de l'utilisateur) : le plan initial proposait une boucle d'appels API individuels par destinataire — remis en question à raison. Recherche faite sur la doc Brevo : le mode batch natif (`/v3/smtp/email`, paramètre `messageVersions`) permet jusqu'à 1000 destinataires personnalisés en un seul appel HTTP, chacun avec son propre `to` (pas d'exposition entre destinataires). Ce mode élimine le risque de timeout Edge Function (~150s) qu'aurait posé une boucle de 300+ appels séquentiels. Plan corrigé en conséquence.

### Démarrage du développement
- Confirmation explicite de l'utilisateur pour démarrer le dev (prérequis Brevo levé).
- Exploration du code existant : pattern `organisations` + RLS (`current_effective_organisation_id()`), pattern `ParametresSection`, Edge Function `generate-recu` (vérification admin + service role), nav sidebar `AdminLayout.tsx` (groupes avec sous-items), `AdherentsPage.tsx` (sélection multiple déjà existante).
- Branche créée : `feature/campagnes-mailing-brevo`.
- 2 migrations SQL écrites (**pas encore appliquées**, en attente de test sur staging) :
  - `supabase/migrations/organisations_brevo_integration.sql` — colonnes `brevo_api_key`/`brevo_expediteur_nom`/`brevo_expediteur_email` sur `organisations`.
  - `supabase/migrations/campagnes_mailing.sql` — nouvelle table historique, RLS select-only pour l'admin de l'org (écriture réservée à l'Edge Function via service role, pas de policy INSERT client).

### Stratégie de test clarifiée
- Décision : tester sur l'environnement staging (`mothana-staging`) plutôt qu'en prod direct, car il s'agit aussi de tester un envoi réel via l'API Brevo (pas seulement du SQL).
- Recommandation donnée et actée : créer un **compte Brevo personnel de test** (plan Free, 300 emails/jour) plutôt que d'utiliser le compte réel de l'association pendant le dev — découple complètement le développement du compte de production, pas de risque de consommer son quota ou de polluer ses statistiques.
- Explications données sur la vérification d'expéditeur Brevo : vérification simple par code à 6 chiffres (aucun domaine nécessaire, suffisant pour un compte de test perso) vs authentification de domaine complète (DNS, SPF/DKIM, nécessaire en prod pour la délivrabilité et les exigences Gmail/Yahoo/Microsoft — sujet pour l'admin de l'association plus tard, pas bloquant pour développer).

## Reste à faire (prochaine session)

1. **Utilisateur** : créer son compte Brevo de test personnel (plan Free) + vérifier un expéditeur (adresse email perso, code à 6 chiffres).
2. Appliquer les 2 migrations sur staging (confirmation à redemander, pas encore fait nulle part).
3. Construire l'Edge Function `send-mailing-brevo` (mode batch `messageVersions`, vérification admin, chargement config Brevo de l'org, filtre adhérents avec email, écriture historique).
4. Ajouter la dépendance TipTap (`@tiptap/react` + `@tiptap/starter-kit` ou équivalent).
5. Construire `CampagneMailingPage.tsx` (bloc config Brevo, composition sujet + éditeur enrichi, upload pièce jointe, filtre destinataires + compteur, historique) + nav/route (`AdminLayout.tsx`, `App.tsx`).
6. Tester le flux complet via Playwright sur l'instance dev existante (localhost:5173, jamais tuer le processus), avec le compte Brevo de test.
7. Une fois validé sur staging : appliquer les migrations en prod, déployer l'Edge Function (`supabase functions deploy send-mailing-brevo`, jamais automatique), ouvrir la PR.
8. Communiquer à l'admin de Wat Velouvanaram qu'il doit renseigner sa vraie clé Brevo + expéditeur dans la nouvelle page une fois en prod.

Suivi détaillé dans la todo list de session (tasks #2 à #9) : #2 in_progress (migrations écrites, pas appliquées), #3-#9 pending.

## Blockers

- Aucun blocker technique. En attente que l'utilisateur crée son compte Brevo de test personnel avant de pouvoir tester réellement l'envoi.

## Décisions

- Clé Brevo par organisation (pas globale) — cohérent avec le pattern multi-tenant existant, évite que l'opérateur de la plateforme porte la réputation d'envoi de toutes les organisations.
- Configuration Brevo positionnée dans le module Adhérents (pas Paramètres), sur demande explicite de l'utilisateur.
- Envoi via le mode batch Brevo (`messageVersions`), jamais de boucle d'appels individuels — décision technique corrigée en cours de session suite à une question pertinente de l'utilisateur.
- Pas d'abstraction multi-fournisseur (Mailchimp etc.) tant qu'aucune organisation ne le demande concrètement — modèles d'intégration trop différents entre fournisseurs pour concevoir une interface commune à l'aveugle.
- Compte Brevo de test personnel distinct du compte réel de l'association, pour le développement.
- Migrations à tester sur staging avant application en prod.
