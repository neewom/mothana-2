# Promotion PR #151-156 : déblocage mode auto + backend prod

**Statut : terminé.** Les 6 promotions `dev` → `main` mergées aujourd'hui (#145 à #150) ont désormais leur backend prod complètement appliqué.

## Réalisé

- **Blocker levé** : la connexion directe à la base prod (`psql`/`pg_dump`) était bloquée par le classifier de sécurité de Claude Code sous le mode auto/autonome — comportement attendu, pas une erreur technique. Désactiver le mode auto a débloqué la connexion (confirmations normales à la place d'un blocage systématique). Vérifié via un dump complet réussi (5,5 Mo) avant de poursuivre.
- **Promotion #150 (Campagne courrier)** : migration `campagnes_courrier.sql` rejouée sur prod, Edge Function `generate-campagne-courrier` déployée. Vérifié (table + policy RLS présentes).
- **État des lieux des 5 autres promotions déjà mergées côté code** (#145-149) : `dev`/`main` alignés côté code, mais backend prod pas encore fait pour #147/#148/#149 (#145/#146 sont front only, rien à faire). Vérifié par requêtes directes sur la base prod + `supabase functions list`.
- **Promotions #147/#148/#149 complétées côté backend prod** :
  - Dump de sécurité pris avant le lot.
  - Migrations rejouées dans l'ordre de dépendance : `mailing_templates.sql` → `bounce_detection_adherents.sql` → `demande_adhesion_confirmation_webhook.sql` → `search_adherents_email_invalide.sql` (la RPC dépend de la colonne posée juste avant).
  - `demande_adhesion_confirmation_webhook.sql` contient en dur l'URL + clé publishable **staging** (documenté dans le fichier comme geste manuel à la promotion) : substitution vers les valeurs prod faite dans une copie temporaire (`/tmp`, jamais commitée), fichier source du dépôt inchangé.
  - Edge Functions déployées sur prod : `send-demande-confirmation`, `resend-bounce-webhook` (`--no-verify-jwt`), `brevo-bounce-webhook` (`--no-verify-jwt`), `register-brevo-webhook`, `create-admin` et `request-password-reset` (redéployées pour le helper Resend partagé `_shared/resend.ts`).
  - Tout vérifié après coup : tables/colonnes/trigger/RPC en base, `verify_jwt` de chaque fonction comparé au staging (identique).
  - CLI relinkée sur `mothana-staging` à la fin, dumps temporaires supprimés.
- Journal d'avancement mis à jour (`docs/journal-avancement.md`) : entrée "Campagne courrier" + entrée "Promotion PR #151-156" détaillant le blocage/déblocage et le détail des migrations/déploiements.

## Reste à faire

- **Action utilisateur, pas CLI** : pour toute organisation prod utilisant déjà Brevo, resauvegarder la clé API dans la modale de configuration Brevo pour déclencher l'enregistrement du webhook `brevo-bounce-webhook` côté Brevo (`register-brevo-webhook` ne s'exécute qu'à la sauvegarde, pas rétroactivement pour les configs déjà en place).
- Rien d'autre en attente côté promotion : `dev`/`main` alignés côté code et backend prod à jour sur les 6 promotions.

## Blockers

Aucun restant.

## Décisions

- Le classifier auto-mode de Claude Code bloque la connexion directe à une base de données de production quand le mode auto/autonome est actif — désactiver ce mode permet de repasser par une confirmation utilisateur normale plutôt qu'un blocage pur. À garder en tête pour les prochaines promotions nécessitant des migrations prod (mémoire persistante à jour).
