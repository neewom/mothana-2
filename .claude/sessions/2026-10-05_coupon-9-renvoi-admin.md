# Coupon 9 — renvoi de l'accès acheteur par un admin

## Réalisé

- Traité le recadrage demandé sur la PR #206 : retrait complet du formulaire public de récupération, de son Edge Function, de sa RPC, du scope de rate limiting et des tests associés.
- Ajouté la migration `renvoyer_acces_portefeuille.sql` : traçabilité du créateur des secrets et des corrections d'adresse, RPC authentifiée et transactionnelle, garde organisation/super-admin, collision d'email explicite et révocation optionnelle.
- Ajouté l'Edge Function authentifiée `renvoyer-acces-portefeuille`, qui transmet le JWT à la RPC, attend Resend et rend compte de l'échec d'envoi sans perdre le nouveau lien.
- Ajouté l'action « Renvoyer l'accès » au tableau de bord événement : email modifiable, avertissement de vérification d'identité, révocation optionnelle, envoi par email ou affichage unique avec copie compatible HTTP.
- Remplacé `crypto.randomUUID()` sur la page d'achat par le helper UUID v4 fondé sur `crypto.getRandomValues`.
- Appliqué la migration sur staging et exécuté les tests SQL transactionnels avec succès.
- Supprimé `demander-lien-portefeuille` de staging et déployé `renvoyer-acces-portefeuille` avec vérification JWT active.
- Smoke tests staging : ancienne fonction HTTP 404 ; nouvelle fonction HTTP 401 sans utilisateur authentifié.

## Reste à faire

- Test fonctionnel utilisateur sur le tableau de bord événement : envoi réel, changement d'adresse, collision, révocation et copie HTTP.
- Une fois le périmètre validé par l'utilisateur, passer la PR #206 en ready for review et commenter la carte Trello.

## Blockers

- Aucun blocker technique. La vérification visuelle authentifiée n'a pas pu utiliser la session native car le Mac était verrouillé ; les contrôles automatisés et SQL couvrent les chemins sensibles en attendant le test utilisateur.

## Décisions

- Aucun PDF joint au mail de renvoi : le ticket l'autorisait, et un lien suffit pour ce flux d'assistance administrateur.
- En cas d'échec Resend, l'interface affiche le lien nouvellement créé afin que l'admin puisse le transmettre manuellement au lieu de perdre l'accès généré.
- La PR reste en draft pendant la boucle fonctionnelle/UX avec l'utilisateur.
