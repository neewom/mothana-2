# Batch 2 (Campagnes mailing) — modèles réutilisables + détection bounces

**Statut : terminé.** PR #147 et #148 mergées sur `dev`, cartes Trello en Done, liste "Batch — Campagnes mailing" archivée. Session étalée sur 2 jours (cadrage/dev le 2026-09-09, retours de test + debug bounces le 2026-09-10).

## Réalisé

**Batch — Campagnes mailing, 2 cartes, go donné en une fois (enchaînement sans attendre le merge entre elles, cf. règle batch dev)** :

- **Modèles réutilisables pour les campagnes mailing** (PR #147, mergée) : table `mailing_templates`, RLS complète avec bypass super-admin. UI dans `CampagneMailingPage` : bouton "Modèles (N)" ouvrant une modale de gestion (charger/renommer/supprimer) — remplace un `<select>` initial abandonné après retour utilisateur (état persistant trompeur avec le brouillon localStorage). 2 bugs mobile trouvés et corrigés en testant (`flex-wrap` manquant, bouton `variant="ghost"` illisible comme CTA).

- **Détection d'emails adhérents invalides (bounces)** (PR #148, mergée) : abandon du double opt-in actif au profit d'une détection passive.
  - Confirmation de réception (nouvelle demande d'adhésion) → trigger DB (`pg_net`, `supabase_functions.http_request` indisponible sur ce projet) → edge function `send-demande-confirmation` → email Resend avec tag `demande_id`.
  - Bounce Resend → `resend-bounce-webhook` (signature Svix vérifiée à la main via Web Crypto) → `demandes_adhesion.email_bounced_at`.
  - Bounce Brevo (campagnes mailing) → `brevo-bounce-webhook` → `adherents.email_invalide_at`, auto-enregistré côté Brevo par `register-brevo-webhook` à chaque sauvegarde de la clé API (idempotent, corrige aussi les événements d'un webhook déjà existant).
  - Copié à la ratification, remis à `null` si le courriel est corrigé.
  - Helper Resend partagé (`_shared/resend.ts`), `create-admin`/`request-password-reset` migrés dessus.
  - Badges "Email invalide" (DemandesAdhesionPage, AdherentModal).
  - **Dashboard, ajouté après coup sur retour utilisateur** : bannière d'action (remplace un premier compteur chiffré jugé pas assez visible) ouvrant une modale qui nomme les adhérents concernés — clic direct vers la fiche en édition (`AdherentModal` réutilisé tel quel, requête directe `select('*')` plutôt que de retoucher encore la RPC `search_adherents`).

**Saga des noms d'événements Brevo — 3 itérations, toutes trouvées en testant en conditions réelles** :
1. Cadrage initial : `invalid_email` → rejeté par l'API Brevo (`invalid_parameter`, événement invalide pour un webhook transactionnel). Corrigé en `invalid`.
2. Test réel sur un domaine sans aucun DNS/MX (`@exemple.fr`) : webhook à 0 tentatives après plusieurs minutes. Hypothèse : `blocked`. Ajouté, webhook mis à jour (register-brevo-webhook rendu idempotent aussi sur les événements, pas seulement sur l'existence).
3. Toujours 0 tentatives avec `blocked` activé (confirmé par screenshot utilisateur de la page Surveillance Brevo). Vérité trouvée via le **journal Transactionnel Brevo** (pas la page webhook) : l'événement réel est `error`. Ajouté, testé en conditions réelles (3 nouveaux envois) → bounce détecté en 2-5 secondes.
   - Leçon retenue : la page "Surveillance" du webhook (compteur tentatives) dit si Brevo a appelé ou non, mais pas pourquoi — le journal Transactionnel (par email) montre l'événement réel appliqué à un envoi précis. Aller voir ce 2e endroit dès le premier doute plutôt qu'itérer par hypothèses.

**5 bugs trouvés et corrigés en testant (PR #148)** :
1. RPC `search_adherents` : signature réellement en place différente de celle supposée (`adherents_tags.sql` avait ajouté `p_tag`/`p_exclude_tag` après coup) — 1ère tentative de migration ciblait l'ancienne signature (5 params), créait un overload fantôme au lieu de remplacer la bonne. `email_invalide_at` jamais transmis à `AdherentModal` malgré la colonne posée en base.
2. `register-brevo-webhook` : l'API Brevo renvoie `document_not_found` (pas une liste vide) quand le compte n'a encore aucun webhook — traité comme erreur au départ.
3-4. Événements Brevo, cf. saga ci-dessus.
5. `brevo-bounce-webhook`/`resend-bounce-webhook` déployées sans `--no-verify-jwt` au départ — la vérification JWT par défaut bloquait tout appel entrant (services externes, pas d'utilisateur Supabase authentifié).

## Limitation connue (non bloquante, décision utilisateur)

Le volet Resend (demande d'adhésion) n'a pas pu être validé avec un **vrai** bounce en conditions réelles. Le domaine de test (`@exemple.fr`, sans aucun DNS) semble déclencher des tentatives de livraison différée indéfinies côté Resend ("Delivery Delayed" observé 1h10 après l'envoi, jamais de bounce constaté même après ~7h) plutôt qu'un échec rapide comme Brevo. Le mécanisme de réception (signature Svix, mise à jour `email_bounced_at`) a été validé indépendamment avec un payload auto-signé avec le vrai secret (`RESEND_WEBHOOK_SECRET`) — fonctionnel de bout en bout, mais jamais confirmé sur un vrai bounce Resend. Décision explicite de l'utilisateur : ne pas creuser davantage maintenant, recheck/déboguer au besoin avec un cas réel (domaine valide, boîte inexistante) — noté sur la carte Trello.

## Décisions

- Carte "Modèles réutilisables" : gestion (renommer/supprimer) et chargement fusionnés dans une seule modale, pas de select persistant.
- Carte "Détection bounces" : `pg_net` utilisé directement plutôt que `supabase_functions.http_request` (Database Webhooks jamais activé côté dashboard sur ce projet).
- URL + clé publishable du projet staging codées en dur dans la migration du trigger DB (documenté en commentaire) : à adapter à la valeur prod au moment de la promotion `dev` → `main`.
- Dashboard : bannière + modale nommant les adhérents plutôt qu'un lien filtré vers la liste (aurait nécessité une 3e retouche de la RPC `search_adherents` dans la même session — jugé plus risqué que nécessaire).
