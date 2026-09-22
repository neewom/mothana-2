# Coupon 3 — Spike transport vendeur / acheteur

Carte : https://trello.com/c/RSgVypMH · PR #192 (draft)

## Décision provisoire — pas encore validée sur téléphones

Le candidat préféré est **Broadcast comme signal de changement + relecture serveur,
avec polling de secours**. Le polling seul reste sélectionnable pour comparer.
Les mesures Mac ci-dessous favorisent ce candidat mais ne satisfont PAS les critères
sur deux vrais téléphones. Aucun choix final n'est acté pour les cartes 4/5.

Le prototype démontre une demande fictive vendeur → acheteur puis une décision
acheteur → vendeur. Il ne lit ni ne modifie `portefeuilles`, `demandes_paiement` ou
les mouvements. Les capacités du banc sont temporaires et ne sont pas les secrets
portefeuille. Aucun écran produit, scan caméra, paiement ni débit n'est livré.

## Mécanisme réutilisable

`src/lib/transport/paymentTransport.ts` reçoit un adaptateur `read(signal)`, un
abonnement aux signaux, et des callbacks d'état/diagnostic. Il est indépendant de
React, du banc et des RPC. À reprendre dans les cartes 4/5 avec leurs Edge Functions.

- Polling seul : délai de 1 seconde **après** chaque réponse, sans requêtes simultanées.
- Broadcast : signal vide sur un canal aléatoire de 256 bits distinct des capacités
  d'écriture. Il déclenche la même relecture HTTP que le polling. Aucun contenu
  Broadcast n'est interprété comme une décision. Réconciliation toutes les 5 secondes
  même quand la socket paraît connectée ; repli à 1 seconde si elle tombe.
- Échecs HTTP : backoff de 2 à 15 secondes ; timeout de lecture 8 secondes. Les signaux
  sont regroupés et limités à une relecture au plus toutes les 250 ms.
- Hors ligne / page cachée : arrêt de l'abonnement et des timers ; lecture immédiate
  et réabonnement au retour. Une page verrouillée peut être suspendue par le système :
  **aucune garantie de réception en arrière-plan**, ni notification push.
- Révisions croissantes : ignorer doublons et anciennes réponses. Lecture initiale,
  après reconnexion et après chaque mutation, y compris si sa réponse s'est perdue.
- Aucun retry automatique d'une écriture ; en cas de résultat inconnu, relire d'abord.
  Le serveur verrouille la session, limite à une demande en attente, conserve la
  première décision, refuse une réponse après les 90 secondes serveur.

Un signal perdu est récupéré par la réconciliation. Une coupure ne vaut ni refus ni
acceptation. Si elle dépasse la durée de la demande, le serveur retourne `expired`.

## Sécurité et limites du banc

- Edge Function `coupon-transport-spike` verrouillée sur la référence staging et
  `COUPON_SPIKE_ENABLED=true`. Création par super-admin via `auth.getUser`, puis deux
  capacités aléatoires (vendeur / acheteur), vérifiées côté serveur et stockées hashées.
- Session de deux heures ; capacités en fragment URL, retiré dès le chargement,
  gardées en mémoire seulement, jamais dans les exports. Un rechargement nécessite
  de rouvrir le lien original. Les liens s'ouvrent dans un nouvel onglet.
- Table technique sans tenant, RLS activée et aucun droit `anon` / `authenticated`,
  aucune policy organisationnelle à contourner ; RPC exécutable par `service_role`
  uniquement. Les utilisateurs ne peuvent pas choisir leur rôle avec un champ JSON.
- Canal public non devinable : un détenteur du canal peut injecter un signal vide,
  mais cela ne donne ni droit de lecture HTTP ni droit d'écriture. Ne jamais y mettre
  secret, solde, montant, état métier ou données personnelles.
- Pas de généralisation implicite de cette autorisation aux vrais portefeuilles :
  distribution et rotation des canaux après révocation à définir dans les cartes 4/5.
- Le banc est réservé à quelques testeurs : pas un test de charge ni un endpoint
  produit. Les sessions expirées sont purgées à la création suivante. Désactiver le
  flag serveur à la fin de la campagne. Aucun mécanisme de facturation modifié.
- Pour une écriture produit, garder la RPC métier comme autorité ; les règles réelles
  d'idempotence, RLS, secret révoqué, module désactivé, gel et clôture viennent de
  Coupon 1 et devront être exercées lors de l'intégration 4/5.

## Quotas — vérification documentaire du 22 septembre 2026

[Limites officielles Supabase](https://supabase.com/docs/guides/realtime/limits) :
Pro avec plafond de dépenses : **500 connexions simultanées**, 500 messages/s ;
Pro sans plafond : **10 000 connexions**, 2 500 messages/s. Ces limites sont
configurables par projet. Aucun réglage réel du Dashboard n'a été vérifié ni changé.

Dimensionnement conservateur : un appareil actif = une connexion dans ce prototype.
Exemple : 450 acheteurs + 30 vendeurs laissent seulement 20 connexions sur un plafond
500, avant autres événements, onglets et usages du projet. Cela ne valide pas une
capacité réelle. Point remonté au lead tech dans la PR : obtenir l'affluence cible,
le plafond effectif et le plan du staging (documenté Free historiquement).

Le polling déplace la charge : N clients à 1 s donnent jusqu'à N lectures Edge/s
hors temps de réponse ; à 5 s, jusqu'à N/5 lectures/s plus les notifications.
Mesurer charge DB, quotas Edge et coût avant dimensionnement produit.

[Broadcast officiel](https://supabase.com/docs/guides/realtime/broadcast) : le canal
public n'impose pas d'authentification ; son nom aléatoire ne remplace donc jamais la
vérification du secret pour la lecture de l'état ou une décision.

## Résultats obtenus — ordinateur uniquement

Données brutes : `coupon-3-mesures-mac.json`. Deux rôles Node sur le **même Mac**, même
réseau, backend staging ; cinq demandes et cinq décisions par mode. Durée de l'action
HTTP jusqu'à l'observation par l'autre rôle après relecture serveur, chronomètre
monotone commun. Aucune intervention humaine incluse. Polling démarré au moment de
l'action : cette phase est défavorable au polling, ce n'est pas une distribution
aléatoire d'arrivées. Échantillon insuffisant pour une conclusion statistique/mobile.

| Mode | Demande min–max | Médiane demande | Décision min–max | Médiane décision |
|---|---:|---:|---:|---:|
| Broadcast + relecture | 572–723 ms | 666 ms | 526–669 ms | 609 ms |
| Polling 1 s + relecture | 1235–1281 ms | 1255 ms | 1226–1295 ms | 1253 ms |

Contrôles : 26 tests Vitest (8 transport), `tsc -b`, lint ciblé, `deno check`,
SQL appliqué deux fois et tests transactionnels sur staging. Tests HTTP : création
anonyme refusée, mauvais secret refusé, rôles séparés, première décision conservée.
Le build normal n'émet pas la page ; le build opt-in la contient.

## Lancer le banc

1. Sur staging seulement, appliquer `supabase/spikes/coupon_transport.sql` puis
   `coupon_transport.test.sql` (ce ne sont pas des migrations produit à promouvoir).
2. `supabase secrets set --project-ref cxngcmvxktddhyxboyyx COUPON_SPIKE_ENABLED=true`
3. `supabase functions deploy coupon-transport-spike --project-ref cxngcmvxktddhyxboyyx --use-api --no-verify-jwt`
   Le JWT de création est vérifié dans la fonction ; les autres actions utilisent
   la capacité du banc et ne nécessitent pas une connexion Auth acheteur.
4. Front avec `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` de **staging** et
   `VITE_COUPON_SPIKE=true`. Local : serveur isolé autorisé, puis `/coupon-spike.html`.
   Build : `VITE_COUPON_SPIKE=true npm run build`.
5. Créer une session avec le super-admin de staging. Ouvrir le lien vendeur sur le
   premier téléphone et le lien acheteur sur le second. Aucun compte acheteur requis.
6. Reproduction réseau Mac : `node scripts/coupon-transport-smoke.mjs` ; utilise
   `.env`, écrit uniquement des mesures sans capacités dans `/tmp/coupon3-network-results.json`.

**HTTPS téléphone à préparer** : `test.samakan.fr` suit `dev` et ne contient donc pas
cette PR draft. Il faut un déploiement HTTPS autorisé du banc branché sur staging,
ou un merge explicitement autorisé puis un build recette opt-in. Ne pas rediriger
le domaine ni merger automatiquement. Les previews de branches Vercel héritent sinon
des variables prod : imposer staging explicitement. Aucun scan caméra dans ce spike ;
sa validation HTTPS reste nécessaire pour l'écran vendeur de la carte 5.

## Protocole obligatoire sur deux vrais téléphones — à réaliser

Noter téléphone/OS/navigateur/opérateur/Wi-Fi ou 4G/5G et mode dans « Repère de test ».
Exporter les deux journaux après chaque série. Les heures de deux appareils ne sont
pas forcément synchronisées : **ne pas soustraire leurs timestamps pour une latence**.
`write-http-round-trip` est le temps aller-retour de la mutation seulement ;
`seller-round-trip-including-human` comprend le temps de décision de l'acheteur.
Pour la latence perçue unidirectionnelle, filmer les deux écrans dans le même plan
(60 images/s si possible), compter les images entre appui et changement distant.

Pour chaque mode, alterner l'ordre des modes entre séries, 20 demandes acceptées puis
5 refusées, deux appareils au premier plan, réseau mobile réel. Relever médiane,
p95 (avec prudence sur le petit échantillon), maximum, nombre de pertes/doublons.
Ne pas mélanger temps HTTP, temps humain, et temps d'affichage.

| Scénario (répéter dans les deux modes) | Vérification | Résultat réel |
|---|---|---|
| Deux écrans actifs, 4G/5G | Aller vendeur→acheteur et retour décision | À mesurer |
| Couper le réseau acheteur 15 s, envoyer pendant coupure | Demande retrouvée au retour, aucun succès fictif | À mesurer |
| Couper le réseau vendeur autour de la décision | Décision retrouvée à la reprise | À mesurer |
| Verrouiller l'acheteur 30 s / changer d'application | Rien de garanti caché ; relecture au retour | À mesurer |
| Verrouiller >90 s | Demande expirée, aucune acceptation tardive | À mesurer |
| Wi-Fi → réseau mobile | Reconnexion puis état cohérent | À mesurer |
| Fermer/réouvrir le lien original | Snapshot courant sans dépendre d'un ancien Broadcast | À mesurer |
| Mode polling seul | Même résultat métier sans socket | À mesurer |

Clôture : joindre les exports/mesures, décider avec le lead si quota limitant,
confirmer ou remplacer le candidat et mettre la PR ready uniquement après validation
fonctionnelle. Carte maintenue hors Done tant que cette preuve n'existe pas.
