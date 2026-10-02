# 2026-10-02 — Coupon 9 : déblocage, cadrage et ticket dev

Session lead tech (Claude Code). Aucun code produit : cadrage + passation à Codex.

## Réalisé

### Estimation du coût Railway (question d'entrée)
- Mail Railway « 2,51 $ d'usage ce mois » → Railway n'héberge que **Gotenberg** sur ce projet.
- Requête en base **prod** (lien CLI basculé temporairement sur `bocqfdhmxmleracrwvbu`, puis **remis sur staging**) : `recus_fiscaux` ne contient **qu'un seul enregistrement, en août 2026**. Zéro en septembre et octobre.
- Conclusion : le coût par PDF n'a pas de sens aujourd'hui — les 2,51 $ sont le **coût fixe du conteneur Gotenberg qui tourne en continu**, pas un coût marginal à l'usage. Coût marginal réel d'une conversion HTML→PDF : de l'ordre de 0,0005–0,001 $. À recalculer quand il y aura un vrai flux de reçus.
- Note : cartes adhérents et PDF Coupon passent aussi par Gotenberg mais **ne sont pas persistés** (génération à la volée) — non comptabilisables depuis la base.

### Carte Coupon 9 débloquée
Point de départ : `AGENTS.md` annonçait « cartes 7/8/9 bloquées par la carte 6 » (prestataire de paiement). L'utilisateur a remis en cause cette dépendance pour la 9.

Vérification dans le code : le modèle portefeuille/secret (tables, RPC `creer_commande_en_attente` / `activer_commande` / `lire_portefeuille_par_secret_hash`, hash SHA-256, page acheteur) est **entièrement livré par la carte 4** et **indépendant du moyen de paiement** — déjà exploitable via le flux simulé de la carte 12. La dépendance « carte 8 » inscrite sur la carte visait en réalité la page acheteur, livrée par la carte 4.

→ Carte 9 recadrée : **dépend de 1+4 (déjà livrées), pas de 6/7/8**. Développable immédiatement, fonctionnera à l'identique une fois le paiement réel branché.

### Bug trouvé en route : repli Gmail masquant le lien du portefeuille
Constaté sur screenshot d'un vrai mail reçu : Gmail replie le contenu derrière « Afficher le texte des messages précédents », **cachant le bouton « Ouvrir mon portefeuille »**.

- Cause : le sujet de l'email d'achat est `Votre portefeuille — ${evenement.nom}` (`simuler-achat-evenement/index.ts:225`), **statique par événement, pas par envoi**. Gmail regroupe en conversation les emails de même sujet entre mêmes interlocuteurs et replie le « déjà vu ».
- Piège identifié grâce à une relance de l'utilisateur : utiliser le `code_public` comme différenciateur **ne corrige pas** le problème — il est fixe par portefeuille, donc l'email de récupération collisionnerait avec l'email d'achat du même portefeuille, et les renvois successifs entre eux. Il faut un identifiant **unique par envoi** : `order.id` pour l'achat, id du nouveau secret pour chaque récupération.
- Impact actuel : latent en prod/staging sur l'achat simulé (se déclenche dès qu'une même adresse reçoit deux emails pour le même événement). Correctif intégré au périmètre de la carte 9 puisque les deux emails partagent la logique de sujet.

### Livrables
- Carte Trello [Coupon 9](https://trello.com/c/0ohg1J5l) : cadrage corrigé, volonté du flux documentée (self-service car l'acheteur n'a pas de compte — la carte 11 exclut explicitement la réémission côté admin, donc aujourd'hui un lien perdu est **irrécupérable**), point technique Gmail, **ticket dev complet**, étiquette « cadré », commentaire de coordination.
- `AGENTS.md` : backlog Coupon mis à jour (commit `9c7191d`, poussé sur `dev`).
- Prompt de démarrage transmis à Codex.

## Reste à faire
- Codex développe la carte 9 (branche `feat/coupon-9-recuperation-lien`, PR draft vers `dev`).
- Revue lead tech au passage « ready for review ».
- Critère d'acceptation non automatisable à faire vérifier : **rendu réel dans Gmail** (achat + récupération du même événement, sans repli, bouton visible).

## Blockers
- Aucun sur la carte 9.
- Cartes 7/8 toujours bloquées par la **carte 6** (prestataire de paiement : confirmation Stripe + avis juridique, en attente côté utilisateur). Aucun mouvement sur cette carte depuis le brief du 2026-09-29.

## Décisions
- Carte 9 dissociée de la décision paiement : elle sera développée et testée contre le flux simulé.
- Le correctif du sujet d'email unique est traité **dans la carte 9**, pas dans une carte séparée, car les deux emails partagent la même logique.
- L'identifiant d'unicité du sujet doit être **par envoi** et ne doit **jamais** contenir tout ou partie du secret.
