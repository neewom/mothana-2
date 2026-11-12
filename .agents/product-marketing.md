# Product Marketing Context — Samakan

**Document version:** v1
**Last updated:** 2026-11-11

> Rédigé à partir du code (landing `src/pages/LandingPage.tsx`, `index.html`), de `docs/cadrage-mothana.md`, des cartes Trello « Business plan — Commercialisation » et de la veille HelloAsso. Les mentions **[À confirmer]** sont des hypothèses du lead tech, **[À compléter]** des informations que seul l'utilisateur a.

## Product Overview
**One-liner :** Toute la gestion de ton association, sans la complexité.
**What it does :** Samakan réunit dans un seul outil web ce qu'une association gère aujourd'hui entre tableurs, cahiers et boîtes mail : les dons et leurs reçus fiscaux Cerfa, les adhérents et leurs renouvellements, l'emailing et le courrier, et la saisie des dons sur le terrain par les bénévoles (code PIN, depuis un téléphone).
**Product category :** logiciel de gestion d'association (recherches probables : « logiciel gestion association », « logiciel reçu fiscal association », « gestion adhérents association »).
**Product type :** SaaS web multi-organisation, responsive mobile.
**Business model :** freemium → forfait payant (décidé 2026-11-10). Modules gratuits v1 : dons + adhérents. Limites, prix, périodicité, prestataire de paiement : **non tranchés** (cartes Pricing, RuSv56GE).

## Target Audience
**Target companies :** associations françaises loi 1901 (toutes, pas une niche cultuelle sur la landing — décision 2026-11-10), petites à moyennes, gérées par des bénévoles, qui reçoivent des dons ouvrant droit à réduction d'impôt et/ou ont des adhérents (confirmé 2026-11-11). Ordre de grandeur de référence : l'association d'origine, ~500 adhérents.
**Decision-makers :** président·e, trésorier·e, secrétaire — bénévoles, rarement techniques.
**Primary use case :** émettre les reçus fiscaux Cerfa des dons, y compris (surtout) des dons hors ligne (espèces, chèques remis en main propre).
**Jobs to be done :**
- Envoyer à chaque donateur un reçu fiscal conforme, sans tout refaire à la main en fin d'année.
- Savoir qui est à jour de cotisation et relancer les autres sans effort.
- Enregistrer les dons au moment où ils arrivent (événement, fête, permanence), plutôt que de recopier des feuilles volantes.
- Présenter des chiffres propres à l'assemblée générale.
**Use cases :**
- Fête de quartier / événement : un bénévole saisit les dons en espèces sur son téléphone.
- Fin d'année : reçus fiscaux générés et envoyés en lot (email ou courrier pour ceux sans email).
- Rentrée : campagne de renouvellement des adhésions avec lien personnel.
- Migration : import du tableur existant (donateurs, adhérents, dons).

## Personas
| Persona | Cares about | Challenge | Value we promise |
|---------|-------------|-----------|------------------|
| Trésorier·e (utilisateur principal, décideur) | Exactitude, conformité des reçus, chiffres pour l'AG | Reçus faits à la main, tableurs divergents | Reçus Cerfa conformes en lot, chiffres prêts à présenter |
| Président·e (décideur / champion) | Simplicité, image de l'asso, temps des bénévoles | Faire adopter un outil à une équipe non technique | Un seul outil que toute l'équipe sait utiliser |
| Secrétaire / responsable adhésions | Fichier adhérents à jour, relances | Relances manuelles, courriers | Renouvellements qui se font d'eux-mêmes |
| Bénévole de terrain (utilisateur) | Aller vite, ne pas se tromper | Feuilles volantes, ressaisie | Un PIN, un téléphone, le don est enregistré |

## Problems & Pain Points
**Core problem :** la gestion est éclatée entre tableurs, cahiers et boîtes mail ; les reçus fiscaux des dons hors ligne se font à la main.
**Why alternatives fall short :**
- Les plateformes de collecte en ligne (HelloAsso) ne génèrent pas de Cerfa pour les dons hors ligne, qui sont l'essentiel des dons de nos associations.
- Les tableurs : pas de numérotation fiable des reçus, pas de relance, données qui divergent entre membres du bureau.
- Les logiciels de gestion d'association complets : souvent pensés pour des structures plus grandes, avec beaucoup de modules **[à étayer si on veut s'en servir]**.
**What it costs them :** des soirées de fin d'année à faire les reçus, des cotisations non relancées, des erreurs de ressaisie.
**Emotional tension :** peur d'émettre un reçu fiscal non conforme ; dépendance à une seule personne qui « tient le fichier ».

## Competitive Landscape
*Mis de côté (décision 2026-11-11) : à reprendre quand des prospects citeront des alternatives. Usage interne uniquement, jamais de concurrent nommé ni de comparatif sur le site.*

**Repère connu :** HelloAsso (collecte et adhésion en ligne) ne génère pas de Cerfa pour les dons hors ligne et n'a pas de saisie terrain par bénévole. Ne pas courir après ses fonctionnalités ; piste plus alignée : import des dons HelloAsso.

## Differentiation
**Key differentiators :**
- Reçus fiscaux Cerfa (11580 et 16216) pour **tous** les dons, y compris espèces et chèques, avec numérotation fiable et modèle de reçu aux couleurs de l'asso.
- Espace bénévole par code PIN sur téléphone, rattaché aux activités.
- Dons, adhérents, communication (email + courrier/étiquettes) et terrain dans les mêmes données.
- Données hébergées dans l'UE (Irlande, Pays-Bas), pensé RGPD dès la conception.
**How we do it differently :** un outil unique et simple plutôt qu'une suite de modules ; le terrain (hors ligne, espèces) est un cas de premier rang, pas une exception.
**Why that's better :** moins de ressaisie, reçus conformes sans effort, toute l'équipe sur les mêmes chiffres.
**Why customers choose us :** **[À compléter — aucun client hors associations d'origine à date]**

## Objections
| Objection | Response |
|-----------|----------|
| « On a déjà HelloAsso. » | Complémentaire : Samakan gère ce que HelloAsso ne fait pas (dons hors ligne et leurs Cerfa, saisie terrain). Import des dons HelloAsso : pas encore livré, ne pas le promettre. |
| « Nos données sont dans un tableur, migrer va être long. » | Import du tableur existant, rien à ressaisir (l'association d'origine a importé ses ~500 adhérents en une fois, puis continue dans l'outil). |
| « Un reçu fiscal faux, c'est un risque pour nous. » | Numérotation fiable, règles Cerfa intégrées, blocage des reçus si RNA/SIREN manquants. **[Validation par un expert-comptable prévue, carte r08cl5kP]** |
| « Ça va coûter combien ? » | **[À compléter : offre freemium à définir]** |

**Anti-persona (confirmé 2026-11-11) :** grandes associations avec service comptable et CRM ; structures qui ne collectent qu'en ligne ; associations qui cherchent une billetterie ou une comptabilité complète.

## Switching Dynamics
**Push :** la corvée des reçus de fin d'année ; les relances de cotisation à la main.
**Pull :** reçus en lot, renouvellements automatiques, saisie terrain sur téléphone, un seul outil.
**Habit :** « le tableur marche à peu près », la personne qui tient le fichier depuis des années.
**Anxiety :** perte ou fuite de données, conformité des reçus, adoption par des bénévoles âgés ou peu à l'aise, pérennité d'un petit éditeur.

## Customer Language
> ⚠️ **Phrases provisoires inventées par le lead tech** pour amorcer les textes, à remplacer par de vraies phrases entendues (carte Trello https://trello.com/c/aq1YCEmX). Ne jamais les publier comme témoignages ni les attribuer à quelqu'un.

**How they describe the problem (provisoire) :**
- « Le fichier des adhérents, c'est un Excel que chacun a dans sa version. »
- « Pour savoir qui a payé sa cotisation, il faut demander au trésorier. »
- « Envoyer un mail à tout le monde, c'est copier-coller les adresses en copie cachée. »
- « Ceux qui n'ont pas d'email, on les appelle un par un ou on les oublie. »
- « Les reçus fiscaux, on les fait à la main en janvier. »
**How they describe us (provisoire) :**
- « Tout est au même endroit. »
- « Même les bénévoles qui ne sont pas à l'aise s'en servent. »
- « On a enfin la liste des adhérents à jour. »
**Words to use :** association, bénévoles, dons, reçus fiscaux, adhérents, cotisation, saison, assemblée générale, trésorier, simple, au même endroit.
**Words to avoid :** « plateforme », « CRM », « solution », jargon technique (RLS, SaaS), anglicismes.
**Glossary :**
| Term | Meaning |
|------|---------|
| Cerfa 11580 / 16216 | Formulaires officiels de reçu au titre des dons (particuliers / entreprises) |
| Espace bénévole | Accès simplifié par code PIN pour saisir des dons |
| Activité | Événement ou temps fort auquel un don est rattaché |
| Samakan / Mothana | Samakan = marque publique ; Mothana = nom interne du projet, jamais en public |

## Brand Voice
| Attribute | Means | Doesn't mean | Example line |
|-----------|-------|--------------|--------------|
| Proche | Tutoiement, on parle à un·e bénévole | Familier, blagues | « Tes données sont hébergées en Europe. » |
| Concret | Des gestes réels du quotidien associatif | Promesses abstraites | « Plus de feuille volante à recopier le lendemain. » |
| Rassurant | Sérénité, conformité, soin des données | Alarmiste, juridique | « Ton trésorier arrive serein. » |
| Simple | Phrases courtes, un mot par idée | Simpliste, infantilisant | « Sans la complexité. » |

**Tone by context :**
- Support : patient, pas à pas, tutoiement.
- Launch : sobre, centré sur le geste rendu plus facile.
- Errors : dire ce qui s'est passé et quoi faire, sans blâmer.
- Sales : pas de pression, pas de fausse urgence.
- Social : **[À définir]**
**Terms we own :** **[À définir]**
**Never use (and why) :** le nom des associations clientes et leurs témoignages sur la landing (décision 2026-11-10) ; « gratuit à vie » ou tout engagement tarifaire tant que l'offre n'est pas tranchée.

## Proof Points
**Metrics (association d'origine, prod, relevé 2026-11-11, à citer sans la nommer) :**
- Adhérents : ~500 adhérents actifs, presque tous avec une adhésion 2026 (497) ; fichier importé en août 2026, puis 24 adhésions saisies dans l'outil et 6 demandes d'adhésion reçues par le formulaire en ligne.
- Campagnes email : 2 campagnes à l'ensemble des adhérents (oct. et nov. 2026, ~340 destinataires chacune), plus des envois ciblés.
- ~3 adhérents sur 10 sans email (145 sur 500) : le courrier et les étiquettes ne sont pas un gadget.
- Dons et reçus fiscaux : mis de côté comme preuve (encore très peu utilisés dans l'outil : historique importé, 1 seul reçu généré). Renouvellement par lien personnel pas encore utilisé. Ne rien affirmer sur ces points avant d'avoir des chiffres d'usage.
**Customers :** aucun cité publiquement (décision 2026-11-10).
**Testimonials :** aucun pour l'instant.
**Value themes :**
| Theme | Proof |
|-------|-------|
| Adhérents à jour | ~500 adhérents suivis, adhésions de l'année, demandes en ligne |
| Communiquer avec tous | Campagnes email à ~340 adhérents ; courrier pour les ~30 % sans email |
| Reçus conformes | Cerfa 11580/16216, numérotation fiable, modèle personnalisable (fonctionnalité, pas encore de preuve d'usage) |
| Données en Europe | Base et emails en Irlande, PDF aux Pays-Bas, emailing hébergé dans l'UE |
| Terrain | Espace bénévole PIN sur téléphone |

## Goals
**Business goal :** obtenir les premières associations clientes hors associations d'origine (zéro prospect à date, carte 4vjdBSvH).
**Conversion action :** « Essayer gratuitement » → demande d'inscription freemium (validée par le super-admin).
**Current metrics :** aucune mesure d'audience sur samakan.fr (confirmé 2026-11-11).

## Learnings
*Decisions and tested lessons. Newest first. Keep it to about 20 active entries.*
| Date | Learning | Evidence | Applies to | Status |
|------|----------|----------|------------|--------|
| 2026-11-11 | Preuves à mettre en avant : adhérents et campagnes email (usage réel) ; dons, reçus et concurrents mis de côté tant que l'usage est faible | Décision utilisateur + relevé prod | copywriting, cro, landing | active |
| 2026-11-10 | Landing pour toutes les associations, tutoiement, un seul CTA, pas de client cité ni de témoignage | Décision utilisateur | landing, copywriting | active |
| 2026-11-10 | Démo éphémère abandonnée au profit du freemium (avec email, n'apportait rien de plus) ; à reconsidérer sans email si les visiteurs hésitent à s'inscrire | Décision utilisateur | signup, cro | active |
| 2026-11-10 | Inscription validée en un clic par le super-admin (anti faux reçus Cerfa, réputation du domaine d'envoi) | Décision utilisateur | signup | active |

## Changelog
*Newest first. One line per revision: what changed and why.*
- v1 (2026-11-11) — Contexte initial, brouillon tiré du code et des cartes Business plan.
