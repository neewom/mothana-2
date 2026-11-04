# Reçus en lot : test de charge sur staging (2026-11-04)

Carte : [Reçus en lot 5/5 : test de charge sur staging](https://trello.com/c/BW74YlIJ). Code testé : branche `feat/recus-lot-envoi` (PR #343, tête `4499b3e`), déployée sur staging (`cxngcmvxktddhyxboyyx`). Organisation de test « Test lots reçus » (`87213abf-c373-43ba-85d2-aa1cdb97e882`) seulement. Aucun code applicatif modifié : ce document propose des réglages, il ne les applique pas.

## En bref

- **Génération : 300 reçus en 12 min 29 s, sans aucun échec ni nouvelle tentative**, numéros `2022-001` à `2022-300` consécutifs dans l'ordre alphabétique, une version par reçu, aucun doublon. Le débit (24 reçus/min) est plafonné par le paquet de 25 lignes par exécution, ni par Gotenberg ni par la base.
- **Bloquant pour Wat (3 335 donateurs), hors du code des lots** : au format de numérotation « séquence », `next_numero_recu` tronque les numéros à partir du 1 000ᵉ reçu d'une année (`lpad(…, 3, '0')`) : le 1 000ᵉ reçu reçoit `AAAA-100`, et tous les suivants échouent sur un numéro déjà pris. Reproduit sur staging (§ 3).
- **Envoi : non mesuré.** L'organisation de test n'a pas de configuration Brevo (ni clé, ni expéditeur), donc `lancer_lot_envoi_recus` refuse le lot (`BREVO_REQUIS`). Consigne respectée : je n'ai posé aucune clé (§ 4).

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

Mélange de civilités : Monsieur et Madame en majorité, 30 Foyer, 15 Société ; noms accentués (Àlvarez, Écuyer, Œuvray, de la Tour…) pour vérifier l'ordre français. Les 32 donateurs déjà présents n'ont aucun don en 2021 ni en 2022 : le lot 2022 contenait exactement les 300 nouveaux. Réglages de l'organisation : `numero_recu_depart` passé à 998 le temps du test de débordement puis remis à 1 ; rythme d'envoi jamais modifié (absent : valeurs par défaut 250 par jour et 5 par minute).

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

## 4. Envoi en lot : bloqué par l'absence de configuration Brevo

État constaté sur staging avant toute action :

- `organisations.brevo_expediteur_nom` et `brevo_expediteur_email` : vides ;
- `organisation_secrets` : une ligne existe pour l'organisation, mais `brevo_api_key` est vide ;
- donc `brevo_configure_organisation` = faux ; `recapitulatif_envoi_lot_recus(…, 2022)` renvoie `{"a_envoyer": 300, "exclus": [], "par_jour": 250, "par_minute": 5, "envoyes_24h": 0, "brevo_configure": false}` et `lancer_lot_envoi_recus(…, 2022)` lève **`BREVO_REQUIS`** ;
- le secret `SIMULER_ENVOI_RECUS_INVALID` est bien posé sur staging (mis à jour le 2026-11-04 à 18:56 UTC).

Le chemin simulé lui-même n'a pas besoin de Brevo : dans `_shared/envoyerRecu.ts`, une adresse en `.invalid` avec la simulation active est marquée envoyée (canal « simulation ») sans aucun appel à Brevo ni téléchargement du PDF. Seule la garde de lancement bloque. Pour faire le test, il faut poser sur l'organisation de test une configuration Brevo factice complète (clé quelconque **qui n'est pas une vraie clé**, nom et adresse d'expéditeur), par l'écran des paramètres ; je ne l'ai pas fait (consigne : aucune manipulation de clé).

Rien n'a donc été envoyé ni simulé, et aucun email n'est parti. Le rythme d'envoi de l'organisation n'a jamais été modifié (pas de `envoi_lot_par_jour` / `envoi_lot_par_minute` dans `modele_recu_pdf`) : il est resté par défaut.

Protocole à rejouer une fois la configuration factice posée (≈ 15 min) : rythme 30 par jour et 5 par minute, puis lancer le lot 2022 (300 reçus). Attendu : 5 envois simulés par minute, 30 au bout de 6 min, puis `en_attente_jusqu_a` ≈ premier envoi + 24 h + 1 min et une fin estimée à ≈ 10 jours. Arrêter le lot, le relancer, vérifier que les 30 versions déjà marquées envoyées sont exclues (`a_envoyer` = 270) et qu'aucune ligne ne repasse. Remettre enfin le rythme par défaut.

### Estimation d'envoi par le calcul (non mesurée)

Une exécution envoie au plus `min(par_minute, 25)` emails par minute (le paquet `MAX_LIGNES` vaut aussi pour l'envoi), et au plus `par_jour` sur 24 h glissantes.

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
