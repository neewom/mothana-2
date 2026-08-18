# Environnement staging Supabase

Mis en place le 2026-08-10. Cadrage complet : [carte Trello](https://trello.com/c/MnIE0A6X).

## Pourquoi

Avant cet environnement, les Edge Functions et migrations SQL étaient déployées/exécutées
directement en prod pour être testées. Deux risques : un bug en cours de test touche les
données réelles des organisations actives, et une PR non mergée peut laisser la prod tourner
avec du code qui ne correspond à aucun commit sur `main`.

## Les deux projets

| | Prod | Staging |
|---|---|---|
| Nom Supabase | Mothana | mothana-staging |
| Ref | `bocqfdhmxmleracrwvbu` | `cxngcmvxktddhyxboyyx` |
| Région | eu-west-1 | eu-west-1 |
| Palier | — | Gratuit |
| Données | Réelles (3 organisations actives) | Synthétiques uniquement, jamais de copie de données réelles |

**Séparation des configs** : `.env` local (`npm run dev`) pointe vers staging. Les variables
d'environnement Vercel (dashboard Vercel, pas ce fichier) restent inchangées vers prod — la
prod déployée n'est jamais affectée par ce qui se passe en local. Le `.env` garde aussi
`PROD_SUPABASE_URL`/`PROD_SUPABASE_ANON_KEY` en référence pour basculer manuellement si besoin.

## Comptes de test sur staging

- Super admin : `SUPER_ADMIN_ID`/`SUPER_ADMIN_PASSWORD` dans `.env`
- Admin de l'organisation de démo ("Association Démo Staging") : `STAGING_DEMO_ADMIN_ID`/`STAGING_DEMO_ADMIN_PASSWORD` dans `.env`

## Mot de passe DB staging

Stocké en clair dans `.env` (`STAGING_SUPABASE_DB_PW`), au même titre que `PROD_SUPABASE_PW`.
Revient sur la décision initiale du 2026-08-10/2026-08-14 (ne jamais le conserver, le
régénérer à chaque fois via l'API Management Supabase) — inversée le 2026-08-19 : la
régénération à la demande (`PATCH /v1/projects/{ref}/database/password`, token CLI récupéré
dans le Keychain macOS) est une action jugée sensible par le classifieur auto-mode et demande
une confirmation explicite à chaque fois, ce qui devenait un frein récurrent pour un usage
courant (migrations, requêtes ponctuelles) sur un projet dont les données sont synthétiques et
dont le mot de passe prod, objectivement plus sensible, était déjà en clair dans le même
fichier. `.env` reste gitignored dans les deux cas.

## Déploiements ciblés

Jamais de `supabase link` global (risque d'oublier de re-basculer entre les deux projets).
Chaque commande cible explicitement le bon projet :

```bash
# Migrations SQL (pas de format horodaté CLI sur ce projet, cf. supabase/migrations/) :
psql "postgresql://postgres:${STAGING_SUPABASE_DB_PW}@db.<ref>.supabase.co:5432/postgres" -v ON_ERROR_STOP=1 -f fichier.sql

# Edge Functions :
supabase functions deploy --project-ref <ref> --use-api   # --use-api : pas de Docker sur cette machine

# Secrets :
supabase secrets set --project-ref <ref> CLE=valeur
```

`psql`/`pg_dump`/`pg_restore` viennent du package Homebrew `libpq` (keg-only, binaires dans
`/opt/homebrew/opt/libpq/bin/`) — installé le 2026-08-10 car `supabase db dump`/`db query -f`
nécessitent Docker (absent sur cette machine) ou échouent sur les fichiers SQL multi-instructions
(limitation du protocole préparé de `supabase db query`, cf. incident ci-dessous).

## Bootstrap initial du schéma (2026-08-10)

Le dossier `supabase/migrations/` ne contient que les évolutions incrémentales depuis le MVP —
rejouer ces 38 fichiers seuls échoue (`relation "organisations" does not exist`), et
`docs/schema-mothana.sql` est documenté comme non exécutable de bout en bout (RLS obsolète,
ordre des tables cassé). La méthode retenue : `pg_dump --schema-only` du schéma `public` de prod
(credentials temporaires obtenus via `supabase db dump --linked --dry-run`, qui affiche la
commande `pg_dump` exacte avec un rôle de connexion éphémère), puis application sur staging via
`psql`. Les buckets Storage (`organisation-assets`, `recus-fiscaux`) et leurs policies RLS ont
été recréés séparément (pas capturés par un dump schema-only, ce sont des lignes de données dans
`storage.buckets`).

Extensions à activer manuellement sur un nouveau projet Supabase (pas dans le dump schema-only
si déjà présentes par défaut mais non activées) : `pg_trgm`, `unaccent` (schéma `extensions`).

## Workflow par sujet nécessitant une migration

1. **Dump de staging** (snapshot avant migration) — voir commande ci-dessous.
2. **Migration appliquée sur staging**, feature testée/validée par l'utilisateur (le `npm run dev`
   local pointe déjà sur staging).
3. **PR mergée** → migration rejouée sur prod (même fichier `.sql`, cible `db.bocqfdhmxmleracrwvbu.supabase.co`),
   dump supprimé — les deux bases s'alignent naturellement, sans synchro périodique.
4. **PR rejetée** → dump restauré sur staging (retour exact à l'état d'avant migration), migration
   abandonnée.

```bash
# Dump (schema + data) de staging avant une migration :
pg_dump "postgresql://postgres:${STAGING_SUPABASE_DB_PW}@db.cxngcmvxktddhyxboyyx.supabase.co:5432/postgres" \
  --schema=public -f dump_avant_<sujet>.sql

# Restore si la PR est rejetée :
psql "postgresql://postgres:${STAGING_SUPABASE_DB_PW}@db.cxngcmvxktddhyxboyyx.supabase.co:5432/postgres" \
  -v ON_ERROR_STOP=1 -f dump_avant_<sujet>.sql
```

Pas de synchro périodique : l'alignement se fait à chaque merge, suffisant tant qu'un seul sujet
à la fois est testé (pratique déjà en place). Cas théorique non traité : deux sujets avec
migration testés en parallèle sur staging — non bloquant, évité par la pratique "un sujet à la
fois".

## Hors scope V1

- Synchro des buckets Storage (fichiers réels, pas seulement leur définition) — pas prévue.
- Contenu exact des données synthétiques au-delà du strict nécessaire pour tester (1 organisation
  de démo pour l'instant) — à enrichir au cas par cas si un sujet le nécessite (ex. gros volumes
  pour retester un bug de perf).
