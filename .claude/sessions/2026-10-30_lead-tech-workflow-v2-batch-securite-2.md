# Session 2026-10-28 → 2026-10-30 — Lead tech — Workflow v2.1, batch Sécurité 2

## Réalisé
- **Workflow v2 (28/10, PR #301)** : plus de session dev permanente ; le lead tech lance un sous-agent dev par carte (`docs/sous-agent-dev.md`), un à la fois dans `../mothana-2-claude-dev` (5174). Session « Mothana - dev » fermée par l'utilisateur.
- **Workflow v2.1 (29/10, PR #302)** : boucle de relecture par un sous-agent avant la revue du lead tech (`docs/relecteur.md`, `docs/catalogue-bloquants.md`, 8 familles dont « juste en local, faux en usage réel »). Remplace la revue indépendante.
- **Hygiène (PR #303)** : `.codex/` retiré, `scripts/agent-worktree.sh` ne recopie plus `PROD_*` (sauf worktree `review`) ; `PROD_*` retirées du `.env` de `../mothana-2-claude-dev` ; refs `refs/codex` supprimées.
- **Cadrage + dev + revue + merge du « Batch — Sécurité 2 »** : PR #304 à #310 mergées sur `dev` le 30/10 (merge final `9a91943`), détail dans `docs/journal-avancement.md` (PR #311). 6 Edge Functions redéployées sur staging depuis `dev`. 7 cartes en Done, liste archivée.
  - Boucle de relecture : 1 bloquant trouvé (#310, page blanche si Monaco ne charge pas), 1 correction demandée (#307, aperçu admin aligné sur le PDF) ; rien trouvé ensuite en revue ni au test utilisateur.
- **Scan prod en lecture seule** (29/10) : aucune balise `<br>` dans les données ; le seul `<br />` était sur la copie de WAT en staging (remplacé, accord utilisateur).
- **Staging** : kill-switch `SIMULATION_PAIEMENT_ACTIVE` **retiré** le 30/10 (rallumé une minute pour la vérification de bout en bout de #305 : 429 au 6ᵉ appel). Clic de l'utilisateur sur « Réenregistrer les webhooks Brevo » sur staging : sans dégât ; le webhook du compte Brevo réel de WAT pointant vers staging (id 2181809, créé le 12/09) a été **supprimé** avec son accord.
- Backlog ajouté : https://trello.com/c/oQFyp7f7 (erreur d'upsert avalée par `generate-recu`), https://trello.com/c/hRlB2FiJ (reçu rectificatif).
- `AGENTS.md` (PR #311) : champs `test_apres_prod` / `prod_le` du tableau de bord, proposition de `/save` aux états stables.

- **Promotion `dev` → `main` du batch Sécurité 2 (30/10 après-midi, PR #313)** : dump prod `public` (données comprises), 3 migrations appliquées et vérifiées, 6 Edge Functions déployées depuis `39a9a23`, merge avec `dev` conservée, nouveau front live. Journal : PR #314 et #315.
  - #304 : clic Brevo fait en prod par l'utilisateur, WAT « Mis à jour », secret webhook vérifié en base.
  - #306 : `GOTENBERG_USERNAME`/`GOTENBERG_PASSWORD` posés sur staging + prod (identifiant `samakan`, mot de passe gardé par l'utilisateur) ; Railway : 2 variables + `API_ENABLE_BASIC_AUTH=true`. 401 sans identifiant, PDF OK sur staging (vérifié) et en prod (cartes générées par l'utilisateur).
  - #304 et #306 retirées du tableau de bord : plus aucune revue Mothana dessus.

## Reste à faire / attend l'utilisateur
- **Batch Renouvellement** (3 cartes [M] en Todo : RAoRTGfH, 2NM7Hhlc, qmIyvbfb) : **go utilisateur attendu** + choix de fin (cascade = un seul merge, ou reciblage pour livrer la carte 1 plus tôt). Prévu **empilé**. Avant de lancer : créer la liste « Batch — Renouvellement (empilé) » (avant Todo) et ajouter aux cartes 3 précisions vérifiées dans le code : carte 2 → empreinte du secret côté navigateur avec `@noble/hashes` (pas `crypto.subtle`, absent en HTTP sur l'IP) ; carte 2 → la contrainte CHECK `acces_portefeuille_rate_limits_scope_check` doit garder les scopes `simulation_achat_*` ajoutés par #305 ; carte 1 → clé Brevo lue via `organisation_secrets`, envoi de test à la liste « Nicolas » seulement. Tickets écrits sur `43ea93b`, toujours conformes au code (vérifié le 30/10).
- Toujours en suspens : action admin `RESEND_WEBHOOK_SECRET` prod (https://trello.com/c/6LUg8hnR) ; clés Brevo des orgs de test staging (« Une nouvelle asso test » a une clé refusée par Brevo, 401).

## Blockers
- Aucun.

## Décisions
- Écriture de secrets (`supabase secrets set`) refusée par le classifieur du mode auto : passer la session en manuel pour cette étape. Les connexions prod `psql`/`pg_dump` sont passées en mode auto cette fois.
- Commande à faire lancer à l'utilisateur : jamais de `!` en tête dans un bloc à coller dans un terminal (le shell l'interprète comme une négation et la chaîne `&&` s'arrête).
- Workflow v2 puis v2.1 adoptés (utilisateur, 28 et 29/10).
- Sous-agent dev autorisé à appliquer migrations et déployer des fonctions **sur staging** ; jamais en prod.
- Reçus : régénération au même numéro avec un nouveau montant reste légitime ; rectificatif à cadrer plus tard.
- Gotenberg : un seul couple identifiant / mot de passe pour staging et prod (service partagé).
- Seuils simulation d'achat : 5 par IP par heure, 3 par adresse par jour.

## Env
- Worktrees `../mothana-2-review` et `../mothana-2-claude-dev` en HEAD détaché sur `origin/dev`, propres. Serveurs 5174 et 5175 arrêtés. Aucune PR ouverte (vérifié 30/10 fin de journée). `main` = promotion #313 ; `dev` en avance uniquement des PR doc #314, #315 et de ce fichier. CLI Supabase du checkout principal liée à staging.
