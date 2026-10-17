# 2026-10-17 — Session dev (Claude Code dev) : filtre « Email invalide » sur Adhérents

Go utilisateur transmis par le lead tech pour la carte « [S] Adhérents : filtrer ceux dont l'email est invalide » (https://trello.com/c/s0UdoRn8) — carte unique, prioritaire, branche `feat/adherents-filtre-email-invalide` depuis `origin/dev` (51472e3), PR #242 → `dev`. #241 (animations) reste en draft en attente des retours utilisateur.

## Réalisé
- Définition en place de `search_adherents` relevée sur staging (`pg_get_functiondef`) : une seule surcharge (11 paramètres), `SECURITY INVOKER`, identique à `search_adherents_filtres_email_localisation.sql`.
- Migration `search_adherents_filtre_email_invalide.sql` (CREATE OR REPLACE, même signature) : `p_email_filter = 'invalide'` → `a.email_invalide_at is not null`. **Appliquée sur staging uniquement** ; toujours une seule surcharge après application.
- `EmailFilter` + `EMAIL_FILTRE_LABELS` déplacés dans `lib/adherentsFiltres.ts` (option du tiroir et pastille générées depuis la même table), tests unitaires mis à jour.
- Vérifié sur 5174 (Playwright, org démo) : 30 actifs → 2 avec « Email invalide » ; avec « Hors liste » 0, avec « Liste » 2, archivés 0 ; pastille affichée ; tout sélectionner → « Ajouter à une liste » → liste proposée dans la campagne courrier ; mode « Consulter » super-admin OK.

## Décisions
- La remise à null à la correction de l'email est faite par le trigger de `bounce_detection_adherents.sql` (pas par `AdherentModal`, l. 280 = création) : couvre toute modification du courriel.

## Données de test laissées sur staging (org démo)
- Liste « Test email invalide 2026-10-17 » (2 adhérents : LATSAVONG Phet, VONGSA Amphone).

## Reste à faire
- Revue lead tech, test utilisateur, merge. Promotion prod : migration `search_adherents_filtre_email_invalide.sql`.

## Blockers
- Aucun.
