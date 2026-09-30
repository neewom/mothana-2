---
version: 1
slug: "src-pages-portefeuillepage-tsx"
primary_target: "src/pages/PortefeuillePage.tsx"
related_targets: []
---

SCOPE
Page publique mobile-first /p pour consulter un portefeuille événementiel en lecture seule. Visiteur non connecté ouvrant un lien secret.

AUDIENCE / JOB / ACTION
Acheteur non technique, souvent sur téléphone le jour d'un événement. Il doit voir immédiatement son solde, présenter son QR au vendeur, télécharger le QR en PDF et vérifier ses mouvements. Action principale : présenter le QR ; action secondaire : télécharger le PDF.

PROOF / CONTENT
Nom de l'organisation et de l'événement, statut clos le cas échéant, solde en euros, QR dérivé du code public, code public lisible, historique chronologique avec crédit/débit et solde après mouvement. États explicites pour chargement, hors ligne, lien invalide/révoqué, indisponibilité et limite de requêtes.

CONSTRAINTS
Le secret brut reste dans le fragment puis est retiré de l'URL ; seul son SHA-256 traverse le réseau. Lecture seule. Aucune dépendance à la PR #192 ni reprise de son abstraction. Système visuel existant carnet tamponné x registre, Inter + IBM Plex Mono, palette paper/ink/stamp, bordures plates, accessible et responsive.

DIRECTION
Un reçu de caisse personnel : le solde est la première donnée et le QR occupe la place centrale, comme un ticket prêt à être présenté. Les mouvements suivent comme des lignes de registre. Aucun décor gratuit.

FIRST VIEWPORT / SIGNATURE
Sur mobile, le premier écran contient l'identité événementielle, le solde très lisible, le QR complet et le code public. Interaction signature : le bouton de téléchargement confirme brièvement la préparation du PDF, tandis que le QR reste stable et disponible.

UNRESOLVED
Aucune décision fonctionnelle ouverte dans le ticket. Les seuils de rate limiting restent des paramètres techniques documentés.

SEED KEY
coupon-4-portefeuille-recu
