# 2026-10-17 — Session dev (Claude Code dev) : sécurisation du formulaire d'adhésion public

Go utilisateur transmis par le lead tech pour la carte « [M] Sécurité : le formulaire d'adhésion en ligne et son email de confirmation peuvent être détournés » (https://trello.com/c/ZkJmtbR5) — branche `fix/adhesion-publique-securisee` depuis `origin/dev` (805c0cf), PR #254 → `dev`. Second worktree `../mothana-2-claude-dev-secu`, serveur 5176 (accord du lead tech) — à supprimer / arrêter (PID exact) après merge.

## Réalisé
- Edge Function `soumettre-demande-adhesion` (verify_jwt par défaut, appelée en `fetch` avec la clé publique comme `simuler-achat-evenement`) : limite de débit par IP (empreinte HMAC `_shared/rateLimit.ts`, secret existant `PORTEFEUILLE_RATE_LIMIT_KEY`), champ piège → succès apparent sans écriture, organisation résolue depuis le slug, validation complète côté serveur (`validation.ts`, module pur testé par Vitest), insertion en service_role, email de confirmation avec prénom/nom échappés et tag `demande_id`, plafond de 3 confirmations / adresse / 24 h (au-delà : demande enregistrée sans email). Réponses génériques (`DEMANDE_INVALIDE` 400, `TROP_DE_REQUETES` 429 + `Retry-After: 3600`, `SERVICE_INDISPONIBLE` 503).
- Migration `demande_adhesion_soumission_securisee.sql` : scope `demande_adhesion` + `verifier_limite_demande_adhesion` (10 / heure / IP, SECURITY DEFINER, service_role seul), suppression de la policy `demandes_adhesion_insert_public`, du trigger `trg_demandes_adhesion_send_confirmation` et de `notify_send_demande_confirmation` (fin de l'URL de staging en dur). **Staging uniquement.**
- `send-demande-confirmation` supprimée (code + staging) : seul appelant = le trigger supprimé.
- `DemandeAdhesionPage` : appel de la fonction au lieu de l'insert direct, message dédié en cas de 429.
- Déploiements staging : `soumettre-demande-adhesion` déployée, migration appliquée, `send-demande-confirmation` supprimée.
- Vérifié sur staging (clé publique, comme un attaquant) : ancienne fonction avec `record` fabriqué → 404 ; insert anonyme direct → 401 RLS (42501) ; soumission valide → 200 + ligne créée ; champ piège → 200 sans ligne ; invalide → 400 générique ; 11ᵉ soumission / heure → 429 + `Retry-After: 3600`. Navigateur (5176, 375 px) : formulaire → « Demande envoyée », ligne créée (signature réelle 7 Ko, plafond 300 Ko) ; message 429 affiché (réponse simulée) ; admin et super-admin « Consulter » voient la demande, prénom `<a href…>` rendu en texte.

## Décisions
- Seuil 10 / heure / IP (une famille remplissant plusieurs demandes depuis la même connexion passe ; envoi en masse borné).
- Clé HMAC : réutilisation de `PORTEFEUILLE_RATE_LIMIT_KEY` (déjà présente en staging et en prod pour `verify-pin`) → aucun nouveau secret.
- Pas de captcha tiers.

## Données de test laissées sur staging (org démo)
- Demandes « TEST-SECU » (prénom avec lien injecté) et « TEST-SECU-FORM », en attente. Compteurs de limite de mes tests vidés.

## Non vérifié
- Réception réelle de l'email (clé Resend locale limitée à l'envoi) : à vérifier avec une vraie adresse dans le plan de test ; échappement couvert par test unitaire.
- Ratification d'une demande (code et policy update inchangés) : non rejouée pour ne pas créer d'adhérent.

## Promotion (ordre)
1. `supabase functions deploy soumettre-demande-adhesion` (prod) ; vérifier que `PORTEFEUILLE_RATE_LIMIT_KEY` existe en prod (`supabase secrets list`).
2. Merge `dev` → `main` (front) et migration `demande_adhesion_soumission_securisee.sql` au plus près l'un de l'autre (entre les deux, l'ancien formulaire ne peut plus insérer).
3. `supabase functions delete send-demande-confirmation` (prod).

## Blockers
- Aucun.
