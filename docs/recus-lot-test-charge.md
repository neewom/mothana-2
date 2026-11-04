# Reçus en lot : test de charge sur staging (2026-11-04)

Carte : [Reçus en lot 5/5 : test de charge sur staging](https://trello.com/c/BW74YlIJ). Code testé : branche `feat/recus-lot-envoi` (PR #343, tête `4499b3e`), déployée sur staging (`cxngcmvxktddhyxboyyx`). Organisation de test « Test lots reçus » (`87213abf-c373-43ba-85d2-aa1cdb97e882`) seulement. Aucun code applicatif modifié : ce document propose des réglages, il ne les applique pas.

## En bref

- **Génération : 300 reçus en 12 min 29 s, sans aucun échec ni nouvelle tentative**, numéros `2022-001` à `2022-300` consécutifs dans l'ordre alphabétique, une version par reçu, aucun doublon. Le débit (24 reçus/min) est plafonné par le paquet de 25 lignes par exécution, ni par Gotenberg ni par la base.
- **Bloquant pour Wat (3 335 donateurs), hors du code des lots** : au format de numérotation « séquence », `next_numero_recu` tronque les numéros à partir du 1 000ᵉ reçu d'une année (`lpad(…, 3, '0')`) : le 1 000ᵉ reçu reçoit `AAAA-100`, et tous les suivants échouent sur un numéro déjà pris. Reproduit sur staging (§ 3).
- **Envoi (simulé, adresses `.invalid`) : conforme.** Avec 30 par jour et 5 par minute : 5 envois par minute exactement, mise en attente au 30ᵉ envoi jusqu'à « premier envoi + 24 h + 1 min », estimation de 10 jours juste. Sur 5 lots arrêtés puis relancés : 60 envois, 60 donateurs distincts, **aucun double envoi**, aucune ligne « à vérifier » (§ 4).
- **Point d'attention (envoi)** : augmenter le quota du jour ne réveille pas un lot déjà en attente, qui attend ses 24 h. Il faut l'arrêter et le relancer (§ 4.3).

## 1. Données de test ajoutées (elles restent)

| Donnée | Quantité | Repère |
|---|---|---|
| Donateurs fictifs (personne + profil), fiche complète, `chargeN@example.invalid` | 300 | `profils_participant.notes = 'test-charge-BW74YlIJ'`, `id_externe` 1001 à 1300 |
| Dons 2022 (1 à 4 par donateur, 10 à 199 €) | 750 | profils ci-dessus |
| Reçus 2022 (`2022-001` à `2022-300`) + PDF dans Storage (15,4 Mo) | 300 | lot `11ca5e41-27bb-453c-98ed-206344a7fd69` |
| Donateurs du test de débordement, `debordementN@example.invalid` | 5 | `notes = 'test-charge-BW74YlIJ-debordement'`, `id_externe` 2001 à 2005 |
| Dons 2021 | 5 | profils ci-dessus |
| Reçus 2021 : `2021-998`, `2021-999`, `2021-100` (numéro tronqué) | 3 | lot `26da4225-52cc-4cc5-be0b-c29514fdfe4c` |
| Séquences de numéros | 2022 à 300, 2021 à 1006 | `recu_seq_87213abf_…_2021` / `_2022` |
| Lots d'envoi 2022, tous arrêtés | 5 | `e1e3bb5a…`, `86cd62c7…`, `d2aa9d5b…`, `e94c2abe…`, `312a023d…` |
| Versions de reçus 2022 marquées envoyées (canal « simulation », aucun email) | 60 | `recus_fiscaux_versions.email_envoye_le` ; 240 restent à envoyer |

Mélange de civilités : Monsieur et Madame en majorité, 30 Foyer, 15 Société ; noms accentués (Àlvarez, Écuyer, Œuvray, de la Tour…) pour vérifier l'ordre français. Les 32 donateurs déjà présents n'ont aucun don en 2021 ni en 2022 : le lot 2022 contenait exactement les 300 nouveaux. Réglages de l'organisation : `numero_recu_depart` passé à 998 le temps du test de débordement puis remis à 1 ; rythme d'envoi réglé à 30, puis 40, puis 60 par jour (5 par minute) pendant le test d'envoi, puis remis par défaut (clés retirées : 250 par jour et 5 par minute, vérifié par `rythme_envoi_recus`). La configuration Brevo factice posée par le lead tech (clé non valide, expéditeur `test-lots@example.invalid`) reste en place.

## 2. Génération : 300 reçus (année 2022)

Lancé par `lancer_lot_recus` (session super-admin, API REST de staging) à 20:43:11 UTC.

| Mesure | Valeur |
|---|---|
| Durée totale (création du lot → fin) | **749 s (12 min 29 s)** |
| Débit réel | **24,0 reçus/min** |
| Exécutions de `traiter-lots-recus` | 12, de 25 reçus chacune (20:44 à 20:55) |
| Durée d'une exécution (25 reçus) | 32,3 à 38,9 s, puis attente de la minute suivante |
| Premier reçu d'une exécution, après le passage de pg_cron | 2,1 à 4,1 s (4,1 s pour la première : démarrage à froid) |
| Durée par reçu (tout compris : lecture, numéro, Gotenberg, Storage, enregistrement) | moyenne **1,43 s**, médiane 1,39 s, 95ᵉ centile 1,68 s, **max 2,87 s** |
| Échecs / nouvelles tentatives | **0 / 0** (une tentative par ligne) |
| Taille d'un PDF | 52,7 Ko en moyenne |

Vérifications faites en base après le lot :

- 300 lignes « fait », 300 reçus, **300 numéros distincts** ; aucun numéro en double dans l'organisation ; un seul reçu 2022 par donateur ;
- **numéros consécutifs dans l'ordre des rangs** (chaque numéro = précédent + 1), et rangs dans l'ordre nom puis prénom en collation française (`Àlvarez Julie 2022-001`, `Àlvarez Julie 2022-002`, `Àlvarez Noé 2022-003`…) ;
- **une version par reçu** (300 reçus à une version, aucun à deux) ;
- aucun reçu préexistant détecté (`recu_preexistant` faux partout).

**Gotenberg (Railway)** : `/health` répond en 0,23 s avant le test ; 300 conversions en série sans une seule erreur ni lenteur notable (pire reçu 2,87 s de bout en bout). Une conversion à la fois, une exécution par minute : la charge ne l'a pas mis en difficulté.

**Consommation Supabase visible** : 12 appels d'Edge Function (≈ 35 s chacun), ≈ 1 000 lignes en base, 15,4 Mo de Storage. Pas d'erreur de limite CPU (2 s par exécution) ni de durée murale. Je n'ai pas lu les journaux des Edge Functions (la CLI ne les expose pas) : à regarder dans le tableau de bord Supabase pour le détail du temps CPU.

### Ce qui limite le débit

Le paquet `MAX_LIGNES = 25` (`supabase/functions/traiter-lots-recus/index.ts`). Une exécution traite 25 reçus en ≈ 35 s puis rend la main ; la suivante ne part qu'à la minute suivante (pg_cron). `BUDGET_MS = 90 000` n'est jamais atteint. Une seule exécution traite tous les lots en attente, l'un après l'autre : **deux organisations qui lancent un lot en même temps se partagent ces 25 reçus par minute**.

## 3. Bloquant : numéros tronqués au-delà de 999 reçus par an

`next_numero_recu` (`supabase/migrations/next_numero_recu.sql`, inchangée par le batch) se termine par :

```sql
return annee || '-' || lpad(next_val::text, 3, '0');
```

En PostgreSQL, `lpad` **tronque** une chaîne plus longue que la longueur demandée : `lpad('1000', 3, '0')` = `'100'`, `lpad('1234', 3, '0')` = `'123'` (vérifié sur staging). Donc au format « séquence » :

- le 1 000ᵉ reçu d'une année porte le numéro `AAAA-100` : s'il n'existe pas encore (année commencée haut), il est **créé avec un numéro faux, hors ordre** ; s'il existe (cas normal), la garde anti-collision de `genererRecu` refuse (409) ;
- toutes les valeurs 1 000 à 9 999 retombent sur `AAAA-100` à `AAAA-999`, déjà pris : **plus aucun reçu ne peut être généré dans l'année** au-delà du 999ᵉ, en lot comme à l'unité.

Reproduction sur staging, année 2021, `numero_recu_depart` mis à 998, 5 donateurs (lot `26da4225-…`, 4 min 19 s) :

| Rang | Résultat | Tentatives | Numéro |
|---|---|---|---|
| 1 | fait | 1 | `2021-998` |
| 2 | fait | 1 | `2021-999` |
| 3 | fait | 1 | **`2021-100`** (devrait être `2021-1000`) |
| 4 | échec | 3 | « Le numéro de reçu 2021-100 est déjà porté par un autre reçu… » |
| 5 | échec | 3 | idem |

Dans un lot, le 409 est classé « passager » : chaque ligne bloquée est retentée 3 fois, **une minute à chaque fois, et le lot n'avance pas pendant ce temps** (ordre des numéros). Pour Wat en un seul lot : 999 reçus en ≈ 42 min, puis ≈ 2 336 lignes en échec à raison d'une toutes les 3 minutes (≈ 5 jours), chacune consommant 3 numéros de séquence. Le reçu `2021-100` créé sur staging est immuable : il reste dans l'organisation de test avec ce numéro faux.

À vérifier avant Wat : son format de numérotation en prod (`modele_recu_pdf.format_numero_recu`). Au format « année + numéro de donateur », la séquence n'est pas utilisée et le problème ne se pose pas ; au format « séquence » (valeur par défaut), il est certain.

**Correction proposée (à coder dans une carte dédiée, hors de ce rapport)** : `lpad(next_val::text, greatest(3, length(next_val::text)), '0')`. Les numéros existants (≤ 999) ne changent pas ; à partir de 1 000 : `AAAA-1000`, `AAAA-1001`… Attention aux tris : un tri texte de `numero_ordre` placerait `2022-1000` avant `2022-101` ; trier par la partie numérique (ou par date de génération) là où l'ordre compte (liste des reçus, exports). Ajouter un test SQL qui passe le cap des 999.

## 4. Envoi en lot (simulé) : rythme, quota, arrêt et relance

Préalable : le lead tech a posé sur l'organisation de test une configuration Brevo **factice** (clé `cle-factice-test-charge-non-valide`, expéditeur « Test lots reçus » `test-lots@example.invalid`). Avant cela, `lancer_lot_envoi_recus` refusait le lot (`BREVO_REQUIS`, clé et expéditeur vides). Le secret `SIMULER_ENVOI_RECUS_INVALID` est posé sur staging. Lancements par RPC en session super-admin, année 2022 (300 reçus générés au § 2, adresses `chargeN@example.invalid`).

### 4.1 Rythme et mise en attente au quota (30 par jour, 5 par minute)

Récapitulatif avant lancement : `{"a_envoyer": 300, "exclus": [], "par_jour": 30, "par_minute": 5, "envoyes_24h": 0, "brevo_configure": true}`. Lot `e1e3bb5a…` lancé à 21:07:06 UTC.

| Mesure | Valeur |
|---|---|
| Premier envoi | 21:08 (premier passage de pg_cron après le lancement, pas d'exécution immédiate) |
| Débit | **5 envois par minute exactement**, 21:08 à 21:13 (aucune minute à plus de 5 sur tout le test) |
| 30ᵉ envoi (quota du jour) | 21:13, soit 6 min |
| Mise en attente | au passage de 21:14 : `en_attente_jusqu_a` = 2026-11-05 21:09:02, soit premier envoi compté + 24 h + 1 min, comme prévu |
| Estimation affichée avant lancement (`estimerDureeEnvoi(300, 30/j, 5/min)`) | 9 jours et 7 min, affichés « environ 10 jours » : c'est le calcul exact (30 le premier jour, puis 9 tranches de 30) |
| Échecs / à vérifier | 0 / 0 |

Pendant l'attente, le bandeau affiche « Quota d'envoi atteint : reprise … » (`RecusLotBandeau`), à partir de `en_attente_jusqu_a`. Petite imprécision, sans gravité : l'estimation en cours d'envoi (`estimerDureeEnvoi(restants, rythme)`) ne retranche pas les envois des dernières 24 h. Elle peut donc sous-estimer d'une tranche, c'est-à-dire d'un jour, quand le quota du jour est déjà entamé.

### 4.2 Arrêt puis relance : aucun double envoi

| Étape | Lot | Résultat |
|---|---|---|
| Arrêt du lot en attente (21:14:52), récapitulatif | `e1e3bb5a…` | `a_envoyer` = 270, `envoyes_24h` = 30 : les 30 reçus envoyés sont exclus |
| Relance (21:14:53) | `86cd62c7…` (270 lignes) | mis en attente dès le passage suivant (quota toujours atteint), 0 envoi |
| Quota porté à 40, arrêt puis relance (21:19:58) | `d2aa9d5b…` (270 lignes) | 10 envois (21:20 et 21:21, 5 par minute), puis attente |
| Quota porté à 60, relance, puis arrêt **pendant qu'une exécution tenait le lot** (bail posé, 21:24:00) | `e94c2abe…` (260 lignes) | arrêt pris en compte avant la première ligne : 0 envoi, bail libéré aussitôt ; relance acceptée dans la même seconde |
| Relance (21:24:00) | `312a023d…` (260 lignes) | 20 envois (21:25 à 21:28), puis attente ; arrêté à la fin du test |

Vérifié en base sur les 5 lots : 60 lignes « fait », **60 donateurs distincts**, 60 versions marquées envoyées, une seule version par reçu (l'envoi n'en crée pas), aucune ligne « en_cours », « à vérifier » ou « échec », aucun donateur marqué email invalide. Le garde-fou `ENVOI_EN_COURS` (relance refusée tant que le bail d'un lot arrêté court) n'a pas pu être pris en défaut : avec la simulation, une exécution libère le lot en moins d'une seconde après l'arrêt. Il reste couvert par les tests SQL de la PR #343.

### 4.3 Point d'attention : le changement de quota ne réveille pas un lot en attente

Après le passage du quota de 30 à 40 par jour (21:16), le lot `86cd62c7…`, en attente, n'a rien envoyé pendant 3 minutes. `prendre_lot_recus` ignore un lot tant que `en_attente_jusqu_a` est dans le futur, et cette date n'est recalculée que par `budget_envoi_lot_recus`, appelé seulement pour un lot pris. Le lot aurait attendu 24 h malgré le nouveau quota. L'arrêter puis le relancer règle le problème (lot `d2aa9d5b…`, reprise à la minute suivante). Deux options : effacer `en_attente_jusqu_a` des lots d'envoi en cours de l'organisation quand son rythme change, ou dire dans l'écran des réglages qu'un lot en attente doit être relancé. C'est une décision de produit, à trancher par le lead tech ; rien n'est codé ici.

### 4.4 Aucun appel réel à Brevo ni à Resend

- **Journaux de `traiter-lots-recus` non lus** : la CLI Supabase (v2.119) n'a pas de commande pour lire les journaux des fonctions, et aucun jeton de l'API de gestion n'est disponible dans le worktree. À confirmer dans le tableau de bord (Edge Functions → traiter-lots-recus → Logs, 21:08 à 21:29 UTC) : aucune ligne `send error`, `Brevo` ou `Resend` n'est attendue.
- **Preuves indirectes, en base et dans le code** :
  - les 60 lignes « fait » ont le canal **« simulation »** (`recus_lot_lignes.email_canal`, `recus_fiscaux.email_canal`), qui n'est posé que par la branche `.invalid` de `_shared/envoyerRecu.ts`. Cette branche ne contacte ni Brevo ni Resend et ne télécharge pas le PDF ;
  - avec la clé factice, un vrai appel à Brevo aurait été refusé (401), et la ligne serait passée en échec ou en nouvelle tentative : il n'y en a aucune ;
  - le secours Resend est coupé en lot (`sansSecoursResend: true`).
- **Vérification d'expéditeur** : elle n'a pas bloqué le chemin simulé. Dans `envoyerRecu.ts`, le test `.invalid` passe avant toute lecture de la clé Brevo ou de l'expéditeur. Seule la garde de lancement (`brevo_configure_organisation`) exige une configuration renseignée, quelle qu'elle soit.

### 4.5 Remise en état

Dernier lot arrêté, aucun lot en cours dans l'organisation, rythme remis par défaut (clés `envoi_lot_par_jour` / `envoi_lot_par_minute` retirées : 250 par jour, 5 par minute). Les 60 envois simulés comptent dans les « envois des dernières 24 h » de l'organisation jusqu'au 2026-11-05 vers 21:29 UTC.

### Estimation d'envoi par le calcul

Une exécution envoie au plus `min(par_minute, 25)` emails par minute (le paquet `MAX_LIGNES` vaut aussi pour l'envoi), et au plus `par_jour` sur 24 h glissantes. Le test a confirmé ce modèle à 5 par minute (mesuré) ; les lignes ci-dessous en découlent.

| Rythme | 300 reçus (test) | 3 335 reçus (Wat) |
|---|---|---|
| Défaut : 250/jour, 5/min | 2 jours (250 en 50 min, puis 50 le lendemain) | 14 jours |
| 1 000/jour, 10/min | 30 min | 4 jours |
| 3 400/jour, 10/min | 30 min | ≈ 5 h 35 |

## 5. Recommandations

**Taille de paquet (génération)** : un paquet qui dépasse la minute ne sert à rien. La minute suivante trouve le lot sous bail, et l'exécution d'après ne part qu'une minute plus tard : 50 reçus en 75 s donneraient toujours ≈ 25 reçus/min. Proposition : **borner chaque exécution par le temps plutôt que par le nombre**, `BUDGET_MS = 50 000` et `MAX_LIGNES = 40`. On obtient ≈ 35 reçus par exécution (≈ 50 s à 1,43 s le reçu, 53 s au pire), soit ≈ **35 reçus/min** (+ 45 %). À mesurer après le réglage : 25 reçus passent sous la limite CPU de 2 s, 35 ne sont pas vérifiés (journaux de la fonction).

**Parallélisme 2** : à ne pas faire pour l'instant. Dans un lot, les numéros sont attribués dans l'ordre des rangs, une ligne à la fois (bail du lot) ; générer deux reçus en même temps imposerait de réserver les numéros à l'avance et de gérer les trous en cas d'échec définitif. Le débit actuel suffit (Wat se génère en 1 h 35 à 2 h 20, onglet fermé). Si plusieurs associations lancent des lots en même temps, le seul effet est un partage du débit, sans erreur.

**Rythme d'envoi par défaut** : garder 250 par jour et 5 par minute. Ça tient sous le plafond du plan gratuit Brevo (300 emails par jour, mailings compris) et ça ménage la réputation d'un expéditeur neuf. Pour une association à plan Brevo payant : 1 000 par jour pour commencer, à augmenter si les rejets restent faibles. Au-delà de 25 par minute, le réglage ne change rien (paquet de 25).

**Estimation pour Wat (3 335 donateurs avec au moins un don sur l'année)** :

| Étape | Réglages actuels | Réglages proposés |
|---|---|---|
| Génération | ≈ 2 h 20 (24/min), **bloquée au 999ᵉ reçu au format « séquence »** (§ 3) | ≈ 1 h 35 (35/min), une fois `next_numero_recu` corrigé |
| Storage | ≈ 172 Mo de PDF | idem |
| Envoi | 14 jours à 250/jour | 4 jours à 1 000/jour, ou ≈ 5 h 35 si son plan Brevo le permet |

**Vigilance prod** :

1. **Corriger `next_numero_recu` avant le premier lot de Wat** (§ 3), ou vérifier que Wat est au format « année + numéro de donateur ».
2. À la promotion : secret `TRAITER_LOTS_RECUS_SECRET`, entrées Vault `traiter_lots_recus_secret` et `traiter_lots_recus_url` (URL de prod), `traiter-lots-recus` déployée avec `--no-verify-jwt`, tâches pg_cron `traiter-lots-recus` et `purger-historique-cron` présentes. **Jamais `SIMULER_ENVOI_RECUS_INVALID` en prod.**
3. Wat doit avoir Brevo configuré (clé + expéditeur) avant tout envoi en lot ; regarder son plan Brevo pour régler le rythme.
4. Premier lot réel : le lancer hors heures de bureau, suivre les journaux de `traiter-lots-recus` (temps CPU, erreurs Gotenberg) et l'utilisation de Railway pendant les premières exécutions.
5. Envois : suivre les lignes « à vérifier » (envois incertains, jamais renvoyés automatiquement) et les rejets Brevo des premiers jours.
6. Après un changement de rythme en cours d'envoi, arrêter puis relancer le lot en attente (§ 4.3), tant que ce n'est pas automatisé.
