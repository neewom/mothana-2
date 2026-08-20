# Environnement de recette

Mis en place le 2026-08-15. Cadrage complet : [carte Trello](https://trello.com/c/CQpEP4it).

## Pourquoi

Distinct du staging technique (`docs/environnement-staging.md`, usage interne dev/agent, jamais
exposé publiquement) : la recette permet à un client de tester une fonctionnalité dans des
conditions réelles avant sa mise en prod définitive, sans attendre un merge direct sur `main`.

## Infra

Pas de nouveau projet Supabase ni de nouveau projet Vercel — réutilise l'existant :

| | |
|---|---|
| Supabase | `mothana-staging` (même projet que le staging technique) |
| Vercel | Même projet que la prod, déploiement suivant la branche `dev` |
| URL publique | https://test.samakan.fr |
| URL Vercel auto-générée | `mothana-git-dev-*.vercel.app` (coexiste, usage interne) |

**Isolation des données** : une organisation Supabase dédiée par client (RLS déjà en place, pas
d'infra supplémentaire) — "Association Démo Staging" reste réservée aux audits/tests de l'agent,
chaque client de recette a la sienne (ex. "Wat Velouvanaram Test"). Pattern pensé pour être
réutilisé à chaque nouveau client Mothana, pas limité à Wat Velouvanaram.

## Configuration Vercel

**Variables d'environnement** : `VITE_SUPABASE_URL` et `VITE_SUPABASE_ANON_KEY` ont deux valeurs
dans Vercel — la valeur par défaut (scope "Production and Preview", pointe vers prod) et une
valeur scopée "Preview + Custom Preview Branch = `dev`" qui la surcharge, pointant vers staging.
Aucune des deux valeurs n'a besoin d'être modifiée pour ajouter/retirer cette config : les deux
coexistent, Vercel résout la plus spécifique selon la branche du déploiement.

**Domaine** : `test.samakan.fr` ajouté dans Settings → Domains, assigné explicitement à la branche
`dev` (pas Production). Enregistrement DNS chez OVH (zone DNS de `samakan.fr`) : `CNAME test →`
la valeur fournie par Vercel au moment de l'ajout du domaine (spécifique à chaque projet, pas une
valeur générique fixe).

**⚠️ Piège rencontré et résolu** : la protection "Vercel Authentication" (Settings → Deployment
Protection, mode "Standard Protection" par défaut) bloque tout visiteur non connecté à Vercel sur
les déploiements Preview — y compris un domaine personnalisé comme `test.samakan.fr`, puisque
"Standard Protection" n'exempte que les domaines personnalisés attachés à **Production**, pas à
Preview. Désactivé ("Require Log In" → off) pour ce projet : l'app reste protégée par son propre
login Supabase, cette protection Vercel n'était qu'une couche infra en plus, pas la vraie barrière
de sécurité.

**Point de vigilance permanent** : la variable d'environnement scopée est rattachée au *nom* de la
branche `dev`. Si cette branche est un jour supprimée/recréée/renommée, la recette basculerait
silencieusement sur les identifiants **prod** sans erreur visible — tant qu'elle reste stable et
permanente, pas de risque.

## Workflow git

Change le workflow habituel (auparavant : PR de feature mergée directement sur `main`) :

1. **Branches de feature** : partent de `dev`, PR **vers `dev`** (pas `main`). Chaque merge dans
   `dev` déploie automatiquement sur la recette.
2. **Validation** : le client (ou l'utilisateur) teste sur `test.samakan.fr`.
3. **Promotion vers prod** : une fois validé, via une **PR GitHub `dev` → `main`** (pas de merge
   git direct — bloqué par le classifier auto-mode de Claude Code sur des actions jugées sensibles
   sur `main`), sur confirmation explicite de l'utilisateur pour démarrer la promotion. `gh pr
   create` (base `main`, head `dev`) puis `gh pr merge --merge` (commit de fusion, jamais
   `--squash`/`--rebase`, pour garder l'équivalent `--no-ff` et une trace lisible dans
   l'historique). Pas de re-review de contenu à ce stade (déjà validé au merge feature→dev) — ce
   merge est uniquement le déclencheur de la promotion prod. Exception scopée à cette PR de
   promotion précise : une fois la promotion démarrée sur confirmation explicite, l'agent peut
   créer **et** merger cette PR sans redemander (ne s'applique pas aux PR de feature classiques).

   > ⚠️⚠️⚠️ **NE JAMAIS supprimer la branche `dev` au merge de cette PR** ⚠️⚠️⚠️
   > `gh pr merge` propose par défaut de supprimer la branche source — c'est le bon réflexe pour
   > une branche de feature jetable, mais **catastrophique** ici : `dev` est **permanente**, pas
   > une branche de feature. La recette (`test.samakan.fr`) et les variables d'environnement
   > Vercel scopées "Preview + Custom Preview Branch = dev" y sont rattachées par son *nom* (voir
   > "Point de vigilance permanent" plus bas). La supprimer ferait basculer la recette
   > **silencieusement** sur les identifiants **prod**, sans erreur visible ni alerte. Toujours
   > passer `--delete-branch=false` explicitement, ou décocher l'option si le flux est interactif.
   > ⚠️⚠️⚠️ NE JAMAIS SUPPRIMER `dev` ⚠️⚠️⚠️
4. **Promotion par feature, pas par lot** — cohérent avec le rythme "un sujet à la fois" déjà en
   place sur ce projet, évite qu'une feature validée reste bloquée en prod à cause d'une autre pas
   encore approuvée dans le même lot.
5. **Cas rare : hotfix direct sur `main`** — si ça arrive malgré tout, remerger `main` dans `dev`
   immédiatement après, pour que la recette ne régresse pas ce correctif à la prochaine promotion.

**Plus d'exception pour la documentation pure** (`CLAUDE.md`, résumés de session) depuis le
2026-08-21 : l'exception initiale (commit direct sur `main` + resync immédiat sur `dev`, ajoutée
le 2026-08-17) demandait une discipline manuelle qui s'est révélée source de dérive entre les deux
branches sur plusieurs sessions. `CLAUDE.md` s'édite désormais comme n'importe quel fichier, sur
`dev`, et suit le flux normal de promotion vers `main` — sans conséquence puisqu'il n'y a ni
migration ni déploiement déclenché par son contenu.

## Migrations Supabase

La logique déjà en place dans `docs/environnement-staging.md` ("PR mergée → migration rejouée sur
prod") s'applique maintenant précisément à la PR/merge **`dev` → `main`**, pas au merge
feature→`dev` :

- **Feature → `dev`** : la migration est déjà appliquée sur `mothana-staging` au moment du dev
  (comme aujourd'hui) — la recette voit le nouveau schéma automatiquement puisqu'elle partage la
  même base, aucune étape supplémentaire.
- **`dev` → `main` (promotion)** : dump de sauvegarde **prod**, migration rejouée sur prod,
  déploiement Edge Function si besoin — même geste que pour toute migration prod déjà pratiquée,
  rattaché explicitement à ce moment de promotion.
- **Feature rejetée en recette** (jamais promue) : la prod n'a jamais été touchée, pas de rollback
  nécessaire — la base staging reste synthétique et jetable si besoin de revenir en arrière dessus.

## Risques connus (acceptés)

- **Base staging partagée** entre tests agent et sessions client : collision peu probable mais
  possible (ex. données de test visibles pendant qu'un client évalue une fonctionnalité) —
  atténué par l'isolation par organisation, pas éliminé.
- **Aucune distinction visuelle** dans l'UI entre recette et prod (même identité, mêmes libellés)
  — carte Trello séparée pour une bannière dédiée, pas encore développée :
  https://trello.com/c/hSogRI1Y
