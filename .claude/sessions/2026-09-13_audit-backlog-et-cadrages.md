# Audit backlog + cadrage jusqu'au bout

**Statut : terminé.** Session courte, uniquement du cadrage (aucun dev). Revue systématique du board Trello "Mothana" pour vérifier le statut "cadré" de chaque carte du backlog, puis cadrage de toutes les cartes cadrables restantes.

## Réalisé

### Audit initial
- Passage en revue de toutes les cartes Backlog/Todo : identification de celles déjà cadrées mais mal étiquetées (tag "cadré" manquant) et de celles non cadrées.
- Bug tutoiement DonsReguliersPage : confirmé cadré (fix trivial ta → votre), tag appliqué.

### Cadrages réalisés (présentés en chat, "Go" utilisateur avant écriture Trello, tag "cadré" + déplacement Todo)
1. **Renommer Participants en Donateurs** — libellés UI uniquement (~8 emplacements repérés par grep : AdminLayout, ParticipantsPage, DonsPage, DonModal, DonsReguliersPage, BenevolePage, ParticipantModal, import/configs.ts), code/DB/routes inchangés.
2. **Appliquer la méthodologie des tableaux à tous les tableaux** — audit des 10 tableaux du produit : ScrollShadowX manquant sur DonsPage/DeclarationCerfaCard (à ajouter), SuperAdminPage à harmoniser (pattern responsive différent du reste), bouton "Détail" redondant à supprimer sur DemandesAdhesionPage, colonnes masquées mobile à revoir au cas par cas. Hors scope : tableaux sans vue détail (RecusFiscauxPage, GererListesModal) gardent leurs actions en cellule.
3. **Revoir tous les CTAs pour appliquer le design adapté** — DESIGN.md obsolète (encore indigo/rounded-lg) à remettre à jour en premier pour refléter le système actuel (stamp/paper/ink, variantes default/secondary/ghost/destructive/success/danger), puis convention d'usage par variante, puis audit/migration des boutons hors composant `Button` non conformes (ex. ImportWizard.tsx en indigo brut). Exceptions assumées documentées (onglets, segmented control, fermeture modale, liens inline).
4. **Vraie documentation utilisateur (guides / FAQ)** — route publique `/aide`, format FAQ par catégories (Dons, Adhérents, Campagnes, Reçus fiscaux, Bénévole), périmètre admin+bénévole dès la V1, recherche client-side dès la V1, lien "Besoin d'aide ?" depuis `/decouvrir` et le layout admin (pas de fusion des deux pages). Contenu V1 limité aux fonctionnalités les plus utilisées, complété ensuite de façon itérative.
5. **Dette technique : factoriser CampagneCourrierPage / CampagneMailingPage** — scope technique posé pour plus tard (hook `useDestinatairesSelection` paramétrable par canal + modale `DestinatairesApercuModal` partagée), dev volontairement reporté au 3ᵉ signal de duplication (déjà dupliqué deux fois de suite sur ce module).

### Explicitement laissé de côté
- **`agents.md` calqué sur `CLAUDE.md`** — deux questions de cadrage posées, utilisateur a répondu "Ne cadre pas ce sujet, on verra plus tard" : rien écrit sur Trello, carte inchangée.
- **OCR scan carte adhérent**, **Pagode Coupon**, **Export comptable**, **Abonnements/plans** — non traités, déjà identifiés comme bloqués sur des prérequis ou hors périmètre dev classique.

### Reclassement du backlog
- Cartes Todo Trello réordonnées par priorité/complexité (position déplacée via API) : les sujets simples et fraîchement cadrés remontent (tutoiement, Renommer Participants, tableaux, CTAs, mire de connexion), ceux dont le dev est explicitement reporté redescendent malgré leur cadrage (support multi-org, dette technique campagnes).
- `CLAUDE.md` (section backlog) mis à jour et recommmité après chaque cadrage individuel, puis une dernière fois pour la reclassification globale.

## Reste à faire

- Aucun dev démarré ce jour — chaque sujet cadré reste soumis à confirmation explicite avant de coder (règle standard du projet).
- Prochain choix de sujet à faire avec l'utilisateur parmi le backlog reclassé (voir `CLAUDE.md`, ordre 1 à 13).

## Blockers

Aucun.

## Décisions

- `agents.md` : cadrage explicitement mis en pause par l'utilisateur, à ne pas relancer sans qu'il le redemande.
- Reclassement backlog : les cartes cadrées mais avec dev volontairement reporté (support multi-org, dette technique campagnes) sont classées en dessous de sujets plus simples même si cadrées avant elles chronologiquement — le critère est la probabilité de démarrage à court terme, pas seulement complexité/priorité brute.

---

# Dev batch 444 (5 cartes) + promotion dev → main

**Statut : terminé.** Suite directe de la session ci-dessus : "go" donné pour développer les 5 sujets cadrés en batch (liste Trello "Batch 444"), traités en PR chaînées sans attendre confirmation/merge entre elles (règle batch dev), puis promotion complète dev → main en fin de session.

## Réalisé

### PR #170 — Bug tutoiement DonsReguliersPage
Fix trivial (ta → votre). Mergée.

### PR #171 — Renommer Participants en Donateurs
Grep exhaustif : périmètre réel plus large que l'estimation de cadrage (~30 occurrences sur 13 fichiers, pas ~8 emplacements) — libellés UI uniquement, vérifié via Playwright. Mergée.

### PR #172 — Méthodologie des tableaux à tous les tableaux
Scope étendu en cours de route via plusieurs retours utilisateur en testant, tous traités dans la même PR :
- ScrollShadowX sur DonsPage/DeclarationCerfaCard, harmonisation SuperAdminPage (pattern mobile non conforme).
- CTA de ligne redondants avec le clic supprimés : "Détail" et Ratifier/Refuser en double sur DemandesAdhesionPage, et surtout **Carte/Renouveler/Archiver/Réactiver déplacés d'AdherentsPage vers une rangée dédiée dans `AdherentModal`** (sous le titre, chaque action ferme d'abord la modale avant d'ouvrir la sienne).
- Colonnes Civilité/Contact masquées sur mobile pour DemandesAdhesionPage.
- CampagneMailingPage puis CampagneCourrierPage (page jumelle, repérée par l'utilisateur qui a fourni des captures comparatives) : liseré `border-l-stamp` manquant, padding de carte empêchant le tableau de toucher les bords (nouveau prop `noPadding`), colonne "Sujet" non tronquée débordant sur mobile. Sur CampagneCourrierPage, la troncature d'Activité/Sélection a ensuite été retirée sur demande explicite ("il faut voir tout le contenu") et remplacée par `whitespace-nowrap` — nuance retenue : `truncate` seulement pour du texte libre potentiellement très long, jamais pour une donnée identifiante.
- Audit final demandé par l'utilisateur ("fait le tour de tous les tableaux") : liseré manquant retrouvé sur RecusFiscauxPage et SuperAdminPage (organisations actives), `DeclarationCerfaCard` restructurée. Le reste déjà conforme.
Mergée.

### PR #173 — Revoir tous les CTAs / DESIGN.md
DESIGN.md réécrit intégralement (obsolète, encore 1ère itération indigo/rounded-lg). **Scope réduit après investigation** : le volet "migrer les boutons non conformes" (ImportWizard cité en exemple au cadrage) aurait en réalité nécessité de migrer 8 composants entiers jamais touchés par le rollout shadcn — question posée à l'utilisateur via AskUserQuestion, réponse : DESIGN.md seulement, dette documentée, migration complète en carte séparée (pas encore créée). Ajout après coup : palier typo "Micro-label" 11px documenté + exception `.impeccable/config.json`, suite à une question de l'utilisateur sur les alertes récurrentes du hook (capture comparative fournie à sa demande pour trancher). Section "Tables" ajoutée ensuite dans la même PR, consolidant toute la méthodologie de la PR #172. Mergée.

### PR #174 — FAQ publique /aide
Route + contenu FAQ (5 catégories, recherche client-side), lien depuis /decouvrir et le layout admin. 2 itérations demandées par l'utilisateur après la 1ère version : accordéon (questions repliées par défaut, résultats de recherche auto-ouverts), puis listes numérotées pour les 7 réponses réellement procédurales (nouveau champ `steps` dans le modèle FAQ). Mergée.

### Promotion dev → main (PR #175, puis #176 pour un correctif)
Aucune migration/Edge Function dans le lot (100% frontend + doc) — promotion directe sans étape de dump/migration. PR #175 vérifiée après merge : les 5 commits de fusion (#170-174) bien tous présents. PR #176 : correction d'une erreur de date introduite dans le rattrapage du journal (voir Décisions).

### Rattrapage journal d'avancement
Écart constaté : les cartes Trello #170 à #173 avaient été déplacées en Done au fil de l'eau sans l'entrée `docs/journal-avancement.md` correspondante (violation de la règle "action indissociable"). Rattrapé en une fois pour les 5 PR du batch avant la promotion.

### CLAUDE.md
Backlog condensé nettoyé (5 sujets terminés retirés) après la promotion — laissé sur `dev`, pas de promotion dédiée (fichier non exécutable, peut attendre la prochaine).

## Reste à faire

- Aucun sujet du batch 444 restant — board Trello ("Batch 444") vidé et archivé.
- Nouvelle carte Backlog créée (pas encore cadrée) : "Sortir Activités du groupe Dons dans la nav" — remontée par l'utilisateur en cours de session (Activités nécessaire aussi pour les campagnes mailing/courrier, actuellement dans le groupe de nav "Dons" derrière son FeatureGuard).
- Prochain choix de sujet à faire avec l'utilisateur parmi le backlog Todo reclassé.

## Blockers

Aucun.

## Décisions

- **Batch dev** : 1 seul "go" a couvert les 5 cartes, PR chaînées sans attendre confirmation/merge entre elles ; chaque branche repartait de `dev` (pas empilée). Un oubli corrigé en cours de route : après le merge de la carte 3 (méthodologie tableaux) sur la branche courante, une correction (renommage Donateurs déjà mergé) avait accidentellement été faite sur la mauvaise branche — repérée immédiatement via le contenu du fichier affiché par le système, corrigée par stash/checkout/pop avant de continuer.
- **Scope PR #172 et #173** : agrandis significativement par rapport au cadrage initial suite à des retours utilisateur trouvés en testant (règle "un blocage trouvé en testant se corrige dans cette même PR", étendue ici à des améliorations demandées explicitement, pas seulement des bugs).
- **PR #173** : demande de migration complète des 8 composants non-shadcn explicitement refusée par l'utilisateur au profit d'une simple documentation de la dette — éviter un résultat "bâtard" (bouton neuf dans un composant par ailleurs resté à l'ancien système).
- **Journal d'avancement** : rattrapage groupé en fin de batch plutôt qu'au fil de l'eau — reconnu comme un écart à la règle du projet, à ne pas reproduire (l'entrée doit accompagner chaque déplacement Done, pas être différée).
- **Date de journal corrigée** : entrées écrites avec la date "2026-09-14" par erreur (confusion "nouvelle session" / "nouveau jour") alors que la date réelle du jour était restée 2026-09-13 — corrigé via une PR de promotion dédiée (#176) après avoir été détecté par l'utilisateur qui a demandé confirmation de la branche/contenu de la promotion précédente.
