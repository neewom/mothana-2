---
version: 1
slug: "src-pages-benevolepage-tsx"
primary_target: "src/pages/BenevolePage.tsx"
related_targets: ["src/components/BenevoleEvenement.tsx"]
---

# Écran vendeur bénévole

- Mode : Operate
- Surface : nouvel onglet de `BenevolePage`, optimisé pour téléphone en situation d’événement.
- Tâche : créer puis suivre manuellement une demande de paiement sans révéler le solde du portefeuille.
- Contraintes : identité Mothana existante, phase temps réel exclue, caméra disponible uniquement en contexte HTTPS.

## Direction contract

**THESIS.** Un poste de vente séquentiel qui garde une seule décision principale visible à la fois ; il refuse le tableau de bord multi-cartes et la surcharge d’informations pendant l’encaissement.

**OWN-WORLD.** Héritage strict du « carnet tamponné x registre » : papier crème, surfaces blanches bordées, encre sombre, cachet bordeaux réservé aux actions, ambre pour l’attente et vert pour la réussite.

**STORY.** Le bénévole choisit l’événement, identifie le portefeuille par scan ou saisie, entre le montant, crée la demande puis vérifie ou annule son état. Chaque erreur nomme le problème et la prochaine action, sans exposer le solde.

**FIRST VIEWPORT.** Sous les onglets de l’espace bénévole, un titre court introduit une carte opérationnelle pleine largeur : événement en premier, bascule Scanner/Saisir ensuite, montant et action finale en bas. Sur téléphone, toutes les cibles occupent la largeur et restent lisibles sans défilement horizontal.

**FORM.** Extension locale précise de la surface existante, sans tournoi de concepts ; seed key : `precise-extension`.

**FINISH.** unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
