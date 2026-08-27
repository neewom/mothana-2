# Session du 2026-08-28 — Promotion dev → main

## Réalisé

### Promotion dev → main (PR #110)
Sur confirmation explicite ("Oui, lance la promotion"). 4 sujets mergés sur `dev` mais pas encore promus, identifiés en comparant `origin/main..origin/dev` :
- Peuplement automatique d'une organisation de test (PR #106)
- Dons réguliers (PR #107)
- Cerfa : détail des dons de l'année (PR #108)
- Adhérents mobile : CTA "Sélectionner" (PR #109)

`dev` et `main` étaient réalignés côté code depuis la promotion du 2026-08-26 (PR #105) — pas de divergence à gérer, donc promotion faite via une vraie PR GitHub (`gh pr create` base `main`/head `dev`, puis `gh pr merge --merge --delete-branch=false`) plutôt qu'un cherry-pick par sujet. PR #110 créée et mergée sans re-demander (règle actée pour cette étape), `dev` bien conservée.

Post-merge :
- Dump prod pris avant migration (`~/dump_prod_avant_promotion_20260827.sql`, supprimé après succès)
- Migrations rejouées et vérifiées présentes sur prod, dans l'ordre : `activites_super_admin_bypass.sql` puis `dons_reguliers.sql`
- Edge Function `generate-recu` redéployée sur prod
- CLI Supabase relié à `mothana-staging` après coup (basculé temporairement sur prod le temps des migrations)

`CLAUDE.md` mis à jour (4 entrées "Terminé" complétées avec PR #110 promotion prod).

## Reste à faire

Backlog inchangé, prochain en tête (position 1) : "Animation d'ouverture des sidepanels mobile (Dons + Participants)" — déjà cadré, confirmation à redemander avant dev.

## Blockers

Aucun.

## Décisions

- **Promotion en une seule PR GitHub plutôt qu'un cherry-pick par sujet** : possible ici car `dev`/`main` n'avaient pas divergé entretemps (pas d'autre travail commencé sur `main` en parallèle) — le cherry-pick par sujet reste la méthode par défaut si une divergence apparaît.
