# Session 2026-09-15 → 2026-09-16 — Cadrage backlog, super-admin sans blocages, batch 555

**Statut : partie 1 terminée** (batch 555 clos le 2026-09-16 avant `/clear`). **Partie 2 ci-dessous** (nouvelle session le même jour, après `/clear`) : cadrage landing page (reporté) + dev "page paramètres admin" / rôle contributeur, PR #186 ouverte, pas encore mergée.

Session à cheval sur deux jours (démarrée le 2026-09-15, batch dev + merges conclus le 2026-09-16). Tour de cadrage complet du backlog Trello, diagnostic + fix de la fidélité visuelle de l'import Cerfa, dev complet du sujet "super-admin sans blocages Supabase" (promu en prod), puis un batch de 4 cartes issues du cadrage.

## Réalisé

### Tour de cadrage backlog (2026-09-15)
5 sujets cadrés dans la session, écrits sur Trello (description + étiquette "cadré" + déplacement Backlog → Todo) :
- Sortir Activités du groupe Dons dans la nav
- Renommer "Mailing" en "Campagne mailing"
- Demande d'adhésion : email aux admins à la soumission
- Assets orga : CTA "Remplacer"/"Supprimer" qui débordent de leur cadre (bug visuel remonté par l'utilisateur)
- Cerfa : numéro de donateur fiable (`{{numero_donateur}}`) — relance un sujet abandonné le 2026-07-20, désormais possible en reprenant le pattern `next_adherent_id_externe`

Au passage, deux corrections de synchro Trello ↔ CLAUDE.md : carte "OCR scan de carte adhérent" supprimée par l'utilisateur hors session (confirmé, retirée du backlog condensé) ; carte "Cerfa import PDF" restée par erreur dans la liste alors que déjà en Done depuis le 2026-09-14 (retirée).

### Cerfa : fidélité visuelle de l'import PDF (pas de carte Trello, diagnostic ad hoc)
L'utilisateur a testé l'import PDF fraîchement amélioré (passage à Opus le 2026-09-14) sur un reçu au design travaillé (généré par Claude Design) — rendu jugé "comme une mauvaise copie". Diagnostic complet :
- Tableau du détail des dons (`{{dons_detail}}`) : format figé en dur, ne peut par construction pas reproduire un tableau sur-mesure — écart structurel assumé, pas un raté de l'IA.
- 4 écarts de style confirmés en rendant réellement le HTML/CSS généré (Playwright, pas juste en comparant des captures) : logo jamais affiché (prompt ignorait le système d'assets), ville manquante sous le logo, `border-radius` inventé sur les badges, fond doré du badge "N° D'ORDRE" absent (classe CSS vide).
- Diagnostic du "pourquoi malgré Opus" : le comparatif de modèles du 2026-09-14 validait la fidélité structurelle/textuelle, jamais la fidélité visuelle pixel — jamais mesurée à ce niveau avant cette session.
- 4 règles ajoutées au prompt `generate-template-from-pdf` (texte exhaustif, pas de style inventé, cohérence des classes distinctives, saturation des fonds colorés) + mécanisme asset/logo + règle "texte variable sans placeholder → conserver tel quel, jamais supprimer silencieusement". Déployé sur staging.

### Cerfa/super-admin : lever les blocages Supabase pour l'onboarding (PR #180 dev, #181 promo prod)
Nouvelle carte Trello créée par l'utilisateur, cadrée puis développée dans la foulée (confirmation explicite donnée) :
- 9 Edge Functions + 4 RPC d'import dérivaient l'organisation uniquement via `profils_organisation`/`current_user_organisation_id()`, sans jamais accepter de paramètre client — bloquant systématiquement le super-admin en mode "Consulter".
- Brique partagée `_shared/resolveOrganisationId.ts` + fonction SQL `is_current_user_super_admin()`, étendant aux Edge Functions/RPC le bypass déjà en place au niveau RLS.
- Blocage trouvé en testant, corrigé dans la même PR : policy RLS `organisation_assets` seule sur 53 encore sans bypass `is_super_admin`.
- Audit complet demandé par l'utilisateur : 53 policies RLS passées en revue, 0 lacune restante. Deux briques ajoutées pour réduire le risque futur : helper `is_organisation_row_accessible(organisation_id)` + fonction `audit_missing_super_admin_bypass()`.
- Promu en prod (pas de `pg_dump` disponible sur la machine — définitions sauvegardées manuellement avant migration en filet de sécurité).

### Batch "batch 555" (2026-09-16) — 4 cartes cadrées la veille, dev enchaîné sur un seul go
- **PR #182** Assets orga CTA overflow — empilement vertical (desktop) / ligne (mobile), + 2 retours traités après coup : CTA "Supprimer" ne respectait pas `DESIGN.md` (bouton brut → `Button variant="danger"`), CTA forcés sur 2 lignes en mobile alors qu'il y avait la place (`flex-row sm:flex-col`).
- **PR #183** Renommer "Mailing" en "Campagne mailing" — nav, route, titre, FAQ, page Découvrir.
- **PR #184** Sortir Activités du groupe Dons dans la nav — entrée top-level, `FeatureGuard` étendu pour accepter un tableau de fonctionnalités (bug trouvé en testant : la route restait gated sur "dons" seul).
- **PR #185** Cerfa numéro de donateur fiable — `next_participant_id_externe`, détection collision/doublon à l'import généralisée aux participants (jusqu'ici réservée aux adhérents), placeholder `{{numero_donateur}}`.

Les 4 PR mergées par l'utilisateur au fil de l'eau ; routine post-merge (checkout `dev`, Trello Done, sync CLAUDE.md/journal) enchaînée automatiquement sans redemander confirmation entre chaque merge (nouvelle règle explicite de l'utilisateur, mémorisée). Batch clos, liste Trello archivée.

## Reste à faire

Backlog Todo restant (tous déjà cadrés, confirmation à redemander avant de démarrer) : mire de connexion personnalisée, campagne mailing donateurs, page paramètres admin, multi-org (dev reporté), dette technique factorisation (reportée), demande d'adhésion email admins.

Backlog non cadré : `agents.md` (pause), export comptable, Pagode Coupon.

## Blockers

Aucun.

## Décisions

- **Fidélité visuelle Cerfa** : le tableau `{{dons_detail}}` reste au format fixe (limite acceptée, pas de rework du moteur de template pour l'instant).
- **Promotion prod sans `pg_dump`** : accepté pour des migrations fonctions/policies uniquement (pas de DDL touchant des données) — sauvegarde manuelle des définitions comme filet de sécurité.
- **Nouvelle règle de fonctionnement (mémorisée)** : au sein d'un batch dev déjà confirmé, l'annonce d'un merge PR par PR vaut autorisation d'enchaîner directement (routine + branche suivante) sans re-demander.

---

## Partie 2 — 2026-09-16 (après `/clear`)

### Réalisé

**Nouvelle carte Trello "Landing page"** (ajoutée par l'utilisateur, hors session) — cadrage entamé mais **explicitement reporté** : trouvé en explorant le code qu'une page `/decouvrir` existe déjà (hero + parcours fonctionnalités, liée seulement depuis `/aide`) ; utilisateur a choisi de s'en inspirer pour le contenu (pas de réutilisation telle quelle, pas de refonte from scratch) mais a jugé le scope des sections encore trop flou tant que la commercialisation n'est pas posée — carte laissée en Backlog, non cadrée, à reprendre plus tard.

**Carte "admin : ajouter une page paramètres admin"** — dev complet, PR [#186](https://github.com/neewom/mothana-2/pull/186) ouverte (dev ← feat/admin-parametres-contributeur), **pas encore mergée**.
- Nouvelle page `/admin/parametres/compte` : nom affiché, changement d'email (double lien de confirmation ancienne+nouvelle adresse via `generateLink`/Resend, pattern existant du projet — pas d'envoi auto Supabase), réinitialisation mot de passe (réutilise `request-password-reset`), préférence `notif_demandes_adhesion` (colonne posée, logique d'envoi laissée à la carte séparée "demande d'adhésion : email aux admins").
- **Modèle de rôle simplifié en cours de plan mode** : le cadrage initial de la carte ("admin_root" par promotion, super-admin promeut un admin en admin_root) a été jugé trop lourd à développer par l'utilisateur une fois le plan présenté — remplacé par un modèle plus simple sans promotion : `admin` inchangé (toujours créé par le super-admin), nouveau rôle `contributeur` créé par un admin, mêmes droits fonctionnels, aucun droit de gestion des comptes (confirmé explicitement, pas même en lecture).
- **Faille RLS préexistante trouvée et fermée** (pas un bug de cette feature, mais un risque activé par l'ajout d'une 2e valeur de `role`) : policy `profils_org_all_admin` (catch-all, sans `WITH CHECK`) permettait en théorie à un admin de modifier n'importe quelle colonne — y compris `role` — de n'importe quelle ligne de son organisation via l'API REST directe. Fermée par policy self-update + `REVOKE`/`GRANT` colonne par colonne + trigger de défense en profondeur. Vérifié en staging : auto-promotion et insert direct bloqués en 403.
- **Découverte critique pendant l'exploration** : `resolveOrganisationId.ts` filtrait en dur `role = 'admin'`, ce qui aurait bloqué le premier compte contributeur sur 9 Edge Functions (reçus, mailing, PIN bénévole...) — fix appliqué et déployé avant toute création de contributeur.
- `AdminAccountsManager` extrait de `SuperAdminPage` (composant partagé, ~150 lignes dédupliquées), réutilisé par la nouvelle page et par `SuperAdminPage` (qui affiche désormais admin + contributeur avec badge de rôle).
- Testé sur staging (Playwright, via l'instance `npm run dev` permanente déjà en cours) : création/désactivation/réactivation d'un contributeur, toggle préférence, changement d'email (requête 200, non vérifié jusqu'à réception réelle de l'email), écrans desktop + mobile (375px). Comptes de test créés sur l'organisation "Association Démo Staging" désactivés après vérification (pas supprimés, pas d'accès service_role local pour le faire proprement).

### Reste à faire

- Carte "Landing page" à reprendre pour cadrage quand la commercialisation sera plus avancée.
- Vérifier que le dialogue d'approbation `@AGENTS.md` s'affiche bien à la prochaine ouverture du projet (voir Partie 3) — utilisateur va redémarrer l'instance au prochain `/clear`.
- Tester réellement la création de compte contributeur depuis le téléphone (bloqué par le sujet IP littérale/Vite `allowedHosts`, cf. investigation ci-dessous — laissé de côté par choix explicite de l'utilisateur).

### Blockers

Aucun.

### Décisions

- **Rôle `contributeur` plutôt qu'`admin_root`** : modèle sans promotion (rôle fixé à la création selon qui crée le compte) préféré par l'utilisateur à la mécanique de promotion initialement cadrée — plus simple à développer et à raisonner.
- **Gestion des comptes 100% réservée à l'admin** : un contributeur n'a aucun accès à la section "Comptes", ni en lecture ni en écriture (confirmé explicitement, écarte une lecture plus permissive de "mêmes droits que l'admin hormis la création").
- **Landing page reportée** : pas de cadrage tant que les sections de contenu dépendent de décisions de commercialisation pas encore prises.

### Investigation post-PR : erreur "Unexpected token '<'" en testant depuis le téléphone (2026-09-16)

Utilisateur bloqué en testant "Ajouter un contributeur" depuis son téléphone via l'IP Tailscale (`100.107.87.80:5173`, réseau Tailscale confirmé — `tailscale status`, tailnet `tail5a5a34.ts.net`). Root cause isolée par tests directs (curl répétés, contrôlés) :
- **Cause réelle, à deux niveaux** :
  1. Supabase Auth (`generateLink`, utilisé par `create-admin`) rejette silencieusement (réponse HTML au lieu de JSON) tout `redirectTo` dont l'hôte est une IP littérale — confirmé déterministe (3/3 échecs avec IP, 3/3 succès avec nom d'hôte), y compris après ajout de l'IP exacte à l'allowlist Supabase. Un nom d'hôte (testé : `mac-mini-de-vichith.local`, puis le nom Tailscale MagicDNS) fonctionne.
  2. Vite lui-même bloque le nom Tailscale en Host header (protection anti DNS-rebinding, `server.allowedHosts` par défaut) — nécessiterait un ajout dans `vite.config.ts` **et** un redémarrage de l'instance `npm run dev` permanente pour prendre effet. Utilisateur a choisi de ne pas aller jusque-là pour l'instant (option "je testerai autrement").
- **Pas un bug introduit par cette PR** : le flux `create-admin` existant (`SuperAdminPage`, avant cette session) aurait le même comportement testé dans les mêmes conditions (IP littérale).
- **Changement laissé en place sur le projet Supabase staging** : allowlist Auth (`uri_allow_list`) mise à jour pour remplacer l'IP par le nom Tailscale MagicDNS (`http://mac-mini-de-vichith.tail5a5a34.ts.net:5173/**`), en plus de `localhost:5173` et `test.samakan.fr` déjà présents — utile si le sujet `allowedHosts` Vite est repris plus tard, sans effet tant que ce n'est pas fait.
- **6 comptes de test créés pendant le diagnostic** (sur "Association Démo Staging") désactivés en fin d'investigation.
- **Reste à faire pour tester réellement la création de compte depuis le téléphone** : soit ajouter `mac-mini-de-vichith.tail5a5a34.ts.net` à `server.allowedHosts` dans `vite.config.ts` + redémarrer l'instance `npm run dev` (accord explicite requis, jamais fait sans demander), soit tester via `localhost:5173` sur la machine, soit attendre la promotion sur `test.samakan.fr`.

---

## Partie 3 — 2026-09-16 (fin de session)

### Réalisé

**PR #186 mergée et validée par l'utilisateur** (plan de test fourni avant merge : infos perso, changement email, reset mdp, préférences, cycle de vie contributeur, vue super-admin). Routine post-merge exécutée :
- `checkout dev` + `pull` — rattrapage au passage d'un commit de notes de session resté sur la branche feature après le merge (cherry-pické sur `dev`).
- Carte Trello "admin : ajouter une page paramètres admin" déplacée en Done, Backlog revérifié (rien de nouveau).
- Entrée `docs/journal-avancement.md` ajoutée (dev + investigation post-merge IP Tailscale).

**Sujet `AGENTS.md` relancé par l'utilisateur**, explicitement dans l'optique du handoff (quota Claude Code proche de 80% évoqué comme déclencheur). Discussion approfondie sur le suivi d'usage avant d'en arriver là (voir aussi mémoires `feedback_agents_md_sync_load_bearing_rules`, `project_agents_md_cadrage`) :
- Écarté : statusline (rendu terminal seulement, jamais dans mon contexte), hooks lisant le quota via un outil tiers non officiel (`claude-quota`, exige une auth OAuth séparée — jugé disproportionné par l'utilisateur).
- Retenu : partage manuel ponctuel de `/usage` par l'utilisateur (fait une fois en cours de session, 59% fenêtre 5h / 36% semaine à ce moment-là).
- Cadrage puis dev `AGENTS.md` fait dans la foulée (même session, confirmation "go") : `AGENTS.md` créé à la racine (~90% de l'ancien `CLAUDE.md`, dé-Claude-ifié), `CLAUDE.md` réduit à `@AGENTS.md` + section Claude-only (mémoire persistante, skill webapp-testing). Carte Trello cadrée puis déplacée directement en Done (changement doc-only, pas de PR). Détail complet des décisions : `docs/journal-avancement.md` + mémoire `project_agents_md_cadrage`.
- **Non vérifié à ce stade** : le mécanisme `@import` lui-même — utilisateur va redémarrer l'instance Claude Code au prochain `/clear` pour vérifier que le dialogue d'approbation s'affiche.

### Blockers

Aucun.

### Décisions

- **Pas d'automatisation du suivi de quota** : le risque (auth séparée, endpoint non documenté) a été jugé disproportionné par rapport au besoin — partage manuel de `/usage` retenu à la place.
- **`AGENTS.md` : contenu durable de la mémoire répliqué en texte statique**, pas de MCP ni d'outil de mémoire partagée tiers — maintenance manuelle assumée (nouvelle règle mémorisée pour ne pas avoir à le redemander).
