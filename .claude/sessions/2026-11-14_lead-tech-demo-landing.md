# Session lead tech — 2026-11-13/14 : suggestions email, démo publique, landing démo + contact

## Réalisé
- **Suggestions de domaine email** (FW5ILBZJ) : PR #417 mergée sur `dev` (journal #418).
- **Démo publique « Voir la démo »** (jEO5LkJd, découpée en 4 cartes, batch empilé) : PR #419 à #422 mergées sur `dev` le 13/11, **avant** le test utilisateur (décision utilisateur : la démo exige HTTPS ou localhost, test trop compliqué depuis le serveur de revue). Testée et validée par l'utilisateur en recette sur `demo-test.samakan.fr`.
  - Domaine `demo-test.samakan.fr` ajouté dans Vercel par l'utilisateur (Preview, branche `dev`) ; CNAME posé par le lead tech via l'API OVH (même cible que `test.samakan.fr`).
  - Vérifié en recette : HTTPS, CSP, cache immuable, Brotli (5,2 Mo transférés), 34 s en 4G lente puis environ 2 s, 0 erreur, 0 requête externe.
  - Gabarits sous-agent et relecteur corrigés (`project-ref`, PR #423). Journal : PR #424. Cartes en Done, liste du batch archivée, spike #412 fermé et O6ZIN4DZ en Done.
- **Landing : démo + contact seulement** (FW85vVTb) : PR #425 mergée sur `dev` (journal #426), vérifiée en recette. « Voir la démo » en appel principal, « Nous contacter » (`mailto:contact@samakan.fr`) en secondaire, aussi dans la démo ; plus aucune mention de gratuité ; `/inscription` sans lien public mais fonctionnelle.
- Carte Backlog créée : **Refonte du wording des pages publiques** (TM2ZvIKI).

## Reste à faire
- **Promotion en prod** de #417, de la démo (#419 à #422) et de la landing (#425), toutes sur `dev`. Avant :
  - l'utilisateur ajoute `demo.samakan.fr` dans Vercel en **Production** (branche `main`) et donne le CNAME ; le lead tech pose le DNS chez OVH (carte action admin RENbkyFK, `demo-test` déjà fait) ;
  - instantané du schéma de la démo selon la procédure d'`AGENTS.md` (`npm run demo:schema`, `demo:smoke`, PR vers `dev` avant la promotion) ;
  - puis promotion, TNR prod (démo comprise : `https://demo.samakan.fr` à 375 et 1280 px).
- **Décisions démo laissées ouvertes** (non bloquantes) : bandeau démo sur mobile (environ 100 px), polices système dans la démo, encart « à essayer » (avis lead tech : non), règle de merge de la PR d'instantané à chaque promotion (proposition : merge par le lead tech dès `demo:smoke` vert, à écrire dans `AGENTS.md`).
- CGU : section « Offre gratuite et abonnement » à revoir (avec le wording ou avant d'ouvrir les offres).
- Toujours ouverts depuis la session du 12-13/11 : parcours d'inscription réel en prod et création d'organisation depuis `/super-admin` en prod (utilisateur) ; données de test sur staging ; cartes proposées « liens Auth » et « migrations rejouables » sans réponse ; tuile bénévole de la landing.
- Todo vide ; Backlog à revoir au prochain démarrage.

## Blockers
- Aucun.

## Décisions
- Tant que le freemium, les offres et le CRM ne sont pas prêts, la landing ne propose que la démo et le contact (mailto, pas de formulaire). Réactivation de l'essai : `src/lib/essaiGratuit.ts`.
- La landing garde le bouton plein au cachet (`bg-stamp`) pour son appel principal, malgré la réserve de `DESIGN.md` côté app.
- Une PR dont le test exige HTTPS peut être mergée sur `dev` avant le test utilisateur, sur son accord explicite, puis testée en recette.
