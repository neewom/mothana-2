# Session du 2026-08-15 (suite) — Environnement de recette (test.samakan.fr)

Suite directe de `2026-08-15_campagnes-mailing-brevo-finalisation-et-prod.md` (même session, nouveau sujet après clôture de Brevo).

## Réalisé

### Cadrage
- Nouvelle carte Trello détectée en début de sujet ("Mettre en place un environnement de test/recette"), cadrée avec l'utilisateur : distinct du staging technique (usage interne dev/agent) — la recette permet au **client** de tester une fonctionnalité avant sa mise en prod définitive.
- Décisions actées : pattern réutilisable dès maintenant (pas limité à Wat Velouvanaram), réutilise le projet Supabase `mothana-staging` existant (pas de 3e projet), isolation des données par **organisation dédiée par client** (RLS déjà en place) plutôt que par infra séparée, réutilise le projet Vercel existant (pas de nouveau projet).

### Mise en place (guidage pas à pas de l'utilisateur, je n'ai pas d'accès Vercel/OVH direct)
- Branche `dev` créée et permanente (nouveau modèle git, détaillé ci-dessous).
- Vercel : nouvelles variables d'environnement `VITE_SUPABASE_URL`/`VITE_SUPABASE_ANON_KEY` scopées "Preview + Custom Preview Branch = dev" (surchargent la valeur par défaut Production+Preview qui pointait vers prod) — découverte en cours de route que Vercel supporte plusieurs valeurs pour une même clé, chacune avec son propre scope.
- Domaine `test.samakan.fr` (CNAME chez OVH) assigné à la branche `dev` dans Vercel.
- **Piège trouvé et résolu** : la protection "Vercel Authentication" (Standard Protection) bloque par défaut les domaines personnalisés attachés à Preview (elle n'exempte que les domaines de Production) — désactivée pour ce projet. L'app reste protégée par son propre login Supabase.
- Testé et vérifié de bout en bout via Playwright : connexion admin + chargement dashboard sur `https://test.samakan.fr` avec les données "Association Démo Staging", confirmé connecté à `mothana-staging` (pas prod).
- Organisation "Wat Velouvanaram Test" créée par l'utilisateur sur staging (isolée RLS de "Association Démo Staging").

### Nouveau workflow git (dev → main)
- Discussion approfondie avec l'utilisateur sur l'articulation : les PR de features ciblent désormais `dev` (pas `main`). Chaque merge dans `dev` déploie sur la recette.
- Promotion vers prod : merge direct `dev` → `main` (`--no-ff` pour garder un commit de fusion traceable), **une feature à la fois** (pas de lot, cohérent avec le rythme "un sujet à la fois" déjà en place), sur confirmation explicite — pas de re-review de contenu à ce stade (déjà validé au merge feature→dev), c'est uniquement le déclencheur de la promotion prod.
- Migrations Supabase + déploiement Edge Function rattachés à ce moment de promotion (`dev`→`main`), pas au merge feature→`dev` — le staging/recette voit déjà le nouveau schéma via la base partagée.
- Cas rare (hotfix direct sur `main`) : remerger `main` dans `dev` immédiatement après.
- Commits de documentation pure (`CLAUDE.md`, résumés de session) restent une exception assumée, toujours directs sur `main`.

### Documentation
- Nouveau `docs/environnement-recette.md` (miroir de `docs/environnement-staging.md`).
- `CLAUDE.md` mis à jour (section Git — workflow + État d'avancement).
- Carte Trello complétée avec le détail complet, déplacée en Done.
- Nouvelle carte Trello créée pour une idée annexe : bandeau visuel distinguant recette/prod dans l'UI (pas cadrée, https://trello.com/c/hSogRI1Y).

## Reste à faire

Rien côté infra recette — opérationnelle. La bannière visuelle recette/prod reste à cadrer si l'utilisateur le souhaite un jour (carte Trello dédiée).

## Blockers

Aucun.

## Décisions

- Isolation des données recette par organisation dédiée par client (pas par infra séparée) — tire parti de l'architecture multi-organisation RLS déjà en place.
- Promotion `dev`→`main` par feature, pas par lot.
- Point de vigilance permanent noté dans `docs/environnement-recette.md` : la variable d'env Vercel est rattachée au *nom* de la branche `dev` — si la branche est supprimée/recréée/renommée un jour, la recette basculerait silencieusement sur les identifiants prod sans erreur visible.
