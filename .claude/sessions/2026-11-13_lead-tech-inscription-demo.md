# Session lead tech — 2026-11-12/13 : inscription freemium en prod, spike démo PGlite

## Réalisé
- **Landing** : illustrations de « Simple, vraiment » et capture du hero sans bandeau ambre (PR #405). Promotion en prod de #401, #402 et #405 (PR #410), TNR vert (journal, PR #411).
- **Inscription freemium (PR #409)**, mergée sur `dev` le 13/11, puis promue en prod (PR #414, merge `fa630c2`) avec un TNR vert. Journal : PR #413 (feature) et #415 (promotion). Ajouts en cours de test :
  - ville de la demande reportée dans `organisations.ville` (`p_ville`) ;
  - confirmation d'adresse par email (double opt-in, statut `a_confirmer`, objet « (réf. XXXX) » unique par envoi) ;
  - suggestion de correction du domaine email retirée (décision utilisateur) ;
  - invitations depuis le serveur de revue : le pare-feu Cloudflare devant Supabase bloque un `redirect_to` contenant une IP, d'où le correctif `origineRedirectionAuth` (liens Auth vers test.samakan.fr) et un message d'erreur lisible.
- **Spike démo locale PGlite** (carte O6ZIN4DZ, PR #412 en draft, non mergée) : go technique. L'application réelle tourne dans le navigateur avec PGlite et tinbase 0.22.7. Première visite : 35 à 50 s en 4G lente, puis 2 à 5 s.
- **Cartes créées ou cadrées** : [S] Suggestions de domaine dans les champs email (FW5ILBZJ, Todo) ; [L] Démo publique « Voir la démo » (jEO5LkJd, Todo, cadrée avec écran d'attente, sans préchargement).
- Relecture factuelle d'un extrait de post LinkedIn pour la session « Dash ».

## Reste à faire
- **Utilisateur** :
  - faire un vrai parcours d'inscription en prod (demande, confirmation, validation dans `/super-admin`, invitation), qui couvre aussi le clic sur le lien d'invitation, jamais testé ;
  - créer une organisation depuis `/super-admin` en prod (non couvert par les TNR du 12 et du 13/11).
- **Données de test sur staging** : l'organisation « Les amis du quartier » (invitation à relancer depuis le serveur de revue, ou à supprimer), les demandes « ZZ Test … », l'organisation « ZZ Test inscription creation SA sans ville ».
- **Spike PGlite** : carte O6ZIN4DZ en « To review », PR #412 gardée en draft comme référence. Fermer la PR et passer la carte en Done (avec l'entrée de journal) une fois la démo publique livrée.
- **Proposé, sans réponse de l'utilisateur** : une carte « liens Auth ». `create-admin` ne passe pas `site_url` par `normaliseSiteUrl`, et `request-password-reset`, `request-email-change` et `verify-pin` sont bloqués par Cloudflare depuis une IP. Aucun impact en prod.
- **Proposé, sans réponse** : une carte « migrations rejouables ». `supabase/migrations` ne reconstruit pas une base neuve (107 fichiers sur 127 échouent), ce qui gêne un environnement de secours ou des tests SQL d'intégration.
- La tuile bénévole de la landing ne mentionne pas l'inscription d'adhérent : décision utilisateur toujours en attente.
- Backlog : pas trié finement ce jour-là, à revoir au prochain démarrage.

## Blockers
- Aucun.

## Décisions
- Double opt-in plutôt que l'aide à la correction de l'email. Les suggestions de domaine pendant la saisie font l'objet d'une carte séparée (FW5ILBZJ), à démarrer après #409, désormais mergée.
- Démo publique : option A (application réelle dans le navigateur, sur `demo.samakan.fr`), chargée **au clic** seulement, sans préchargement sur la landing. Moteur hébergé chez nous, stockage local écrit après le clic, écran d'attente honnête (étapes réelles, choix entre admin et bénévole, carrousel « à essayer », porte de sortie si c'est lent).
- En prod, `INSCRIPTION_NOTIF_EMAIL` reprend l'alias `+samakan-inscription` de l'utilisateur, comme en recette.
- Journaux Supabase lisibles via l'API Management, endpoint `analytics/endpoints/logs`, table `logs`, syntaxe `ilike`. Il faut le jeton de la CLI, ce qui suppose que le mode auto soit désactivé.
