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
