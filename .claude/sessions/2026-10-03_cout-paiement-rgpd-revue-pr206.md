# 2026-10-03 — Coût paiement (Stripe/HelloAsso), RGPD Coupon, revue PR #206

Session lead tech. Aucun code produit : analyse, cadrage et revue.

## Réalisé

### Chiffrage des frais de paiement (préparation d'un RDV pro)
Tarifs **vérifiés sur la page Stripe France** (ceux inscrits sur la carte 6 — « ~2,9 % + 0,30 € » — sont les tarifs **US**, à corriger sur la carte) :

| Type de carte | Frais |
|---|---|
| Standard EEE | 1,5 % + 0,25 € |
| Premium EEE | 2,8 % + 0,25 € |
| Britannique | 2,5 % + 0,25 € |
| Hors EEE | 3,15 % + 0,25 € |
| Litige | 20 € par litige |

Appliqué aux montants réellement configurés en base (5 / 10 / 20 / 50 €) : **6,5 % sur une recharge de 5 €, 2,0 % sur 50 €**. C'est la part fixe de 0,25 € qui domine — le taux effectif dépend donc plus de la granularité des recharges proposées que du tarif Stripe. Sur un événement collectant 2 000 € : de **40 € (tout en 50 €) à 130 € (tout en 5 €)**.

Trois constats pour la carte 6 :
- **Le porte-monnaie est structurellement avantageux** : 8 achats de 2,50 € par carte au stand = 11,5 % de frais ; une recharge unique de 20 € = 2,75 %. Le prépayé divise les frais carte par ~4. Argument de fond pour le modèle.
- **Les frais ne sont jamais rendus en cas de remboursement** (vérifié dans la doc Stripe). Impacte directement la question ouverte « sort du solde restant à la clôture » : rembourser un solde inutilisé est une perte sèche pour l'association.
- **Moyens de paiement à frais fixes** : Wero/iDEAL à 0,29 € et prélèvement SEPA à 0,35 € (sans pourcentage). Sur 50 €, **Wero est 3,4× moins cher que la carte**. Wero = portefeuille européen porté par les banques françaises, piste sérieuse.

Commission **identique quel que soit le mode d'intégration** (Checkout, Payment Links, Elements, plugin e-commerce) — vérifié. Ce qui ajoute du coût : la plateforme e-commerce elle-même (Shopify prélève 0,5–2 % si on n'utilise pas Shopify Payments) et les modules Stripe optionnels (Billing +0,7 %, Tax +0,5 %).

### Stripe vs HelloAsso en contexte associatif
- **Pas de tarif associatif chez Stripe en France** (vérifié). HelloAsso est **gratuit** (pourboire volontaire du payeur) : 0 € contre 40–130 € sur les mêmes 2 000 €.
- **Mais le vrai blocage est identique des deux côtés** : les CGU HelloAsso énumèrent ce que couvrent ses outils de collecte (dons, crowdfunding, billetterie, adhésions) — un porte-monnaie prépayé n'en fait pas partie ; Stripe classe la valeur stockée en activité restreinte. **Les deux doivent confirmer explicitement l'éligibilité du modèle.** Comparer les prix avant cette réponse est prématuré.
- Trois contreparties à HelloAsso si éligible : friction du pourboire à l'achat (contexte « recharge rapide devant un stand » ≠ contexte don), pas de mode marketplace confirmé, et surtout **ça ferme définitivement la porte à une commission Samakan** (décision de modèle économique, pas technique).
- **Recommandation** : ne pas choisir maintenant. L'option 2 du brief (chaque association apporte son propre compte) est agnostique — marche avec Stripe comme avec HelloAsso et n'engage sur rien.

### Analyse RGPD du Coupon → nouvelle carte créée
Carte [Coupon — RGPD](https://trello.com/c/OJvbKKKV) créée dans la liste Coupon, placée **au-dessus des cartes 6/7/8** (non bloquée), étiquette « cadré », ticket dev inclus.

Ce qui est bien fait : minimisation exemplaire (seul l'email est collecté), **le PDF ne contient aucune donnée personnelle** (rien d'identifiant ne transite par Gotenberg/Railway), base en eu-west-1 (Irlande).

Trois trous identifiés, **vérifiés dans le schéma** :
1. **L'effacement est impossible par construction** (majeur) — le trigger `trg_mouvements_portefeuille_immuables` bloque update **et** delete, et la clé étrangère vers `portefeuilles` est **sans `on delete cascade`**. Dès qu'un portefeuille a un mouvement, il devient indéfiniment indestructible, email compris. L'immuabilité du journal reste la bonne décision : la sortie est d'**écraser l'email** (placeholder unique, format valide à cause du CHECK et de l'index unique), sur `portefeuilles` **et** `commandes`.
2. **Aucune durée de conservation** définie ni purge — à décider avec la carte 6.
3. **Aucune information des personnes** — pas de mention de confidentialité sur les pages publiques (art. 13). Le plus simple à corriger.

Mineur : les IP hachées du rate limiting ne sont jamais purgées pour un visiteur qui ne revient pas (le nettoyage est scopé à l'IP/portefeuille de l'appel en cours).

**Rien n'est une violation en cours** : flag `evenements` désactivé par défaut, seule l'organisation de démo l'a activé, avec des adresses de test. C'est une checklist à solder avant activation chez une vraie association.

### Revue lead tech de la PR #206 (carte 9)
Revue faite dans `../mothana-2-review` (worktree dédié, HEAD détaché sur la branche de la PR). `tsc -b` propre et **56/56 tests Vitest verts confirmés indépendamment**. [Commentaire posté](https://github.com/neewom/mothana-2/pull/206#issuecomment-5966514202).

**1 bloquant — fuite par le temps de réponse.** L'Edge Function **attend** l'appel Resend avant de répondre : une adresse inconnue ressort après la seule RPC, une adresse connue après l'aller-retour HTTP (~100-500 ms). Corps et statut identiques, mais la latence trahit l'information — l'énumération redevient possible au chronomètre, ce qui annule la contrainte n°1 de la carte. Correctif proposé : `EdgeRuntime.waitUntil()` (API Supabase vérifiée dans la doc avant recommandation ; premier usage dans le projet ; nécessite `policy = "per_worker"` pour un test via la CLI locale, et garder le try/catch dans la tâche de fond).

4 suggestions non bloquantes, dont une à remonter au-delà de la PR : **la RPC exige `statut = 'ouvert'`**, donc après la clôture un acheteur ne peut plus récupérer son lien — en tension avec le remboursement du solde restant prévu en carte 6, là où il en aura justement besoin.

Bien vu côté Codex : `normaliseSiteUrl` extrait dans `_shared/siteUrl.ts` au lieu d'être dupliqué ; correctif du sujet fait sur les deux emails avec des références d'espaces distincts (`order.id` / `secret.id`) ; les tentatives bloquées n'insèrent que la ligne IP, donc un attaquant ne peut pas repousser indéfiniment le délai d'un acheteur légitime.

## Reste à faire
- **Codex corrige le bloquant** de la PR #206, puis je confirme.
- PR #206 toujours **en draft** — la revue a été faite sur demande explicite de l'utilisateur, pas au déclencheur habituel (« ready for review »).
- **Deux questions laissées sans réponse** : consigner le chiffrage Stripe/HelloAsso + la tension « événement clos » sur la carte 6 ? Démarrer le serveur 5175 (pas démarré : l'utilisateur est dans la boucle draft avec Codex sur le 5174, un second port ajouterait de la confusion) ?
- **Évaluer le modèle de paiement le moins coûteux** — demande explicite de l'utilisateur en fin de session, suite à son RDV pro.

## Blockers
- **Carte 6 toujours non tranchée** (prestataire de paiement) : bloque les cartes 7/8. Deux questions à poser avant toute décision — (1) à Stripe **et** à HelloAsso : le modèle de crédit prépayé par événement est-il éligible ? (2) au juriste : le seuil de déclaration ACPR s'apprécie-t-il par association ou cumulé à l'échelle de la plateforme ?
- La carte RGPD n'est bloquée par rien, hors la durée de conservation à décider avec la carte 6.

## Décisions
- Carte RGPD créée comme carte à part entière plutôt que diluée dans les cartes existantes, et placée au-dessus des cartes bloquées.
- L'immuabilité du journal des mouvements **n'est pas remise en cause** — elle est complétée par une anonymisation, pas supprimée.
- Sur le choix du prestataire : ne pas trancher tant que l'éligibilité du modèle prépayé n'est pas confirmée par écrit par Stripe et HelloAsso.
