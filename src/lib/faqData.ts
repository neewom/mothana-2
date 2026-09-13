export interface FaqItem {
  question: string
  answer: string
  // Étapes numérotées — seulement pour les réponses réellement procédurales
  // (une suite d'actions à faire dans l'ordre), pas pour une règle ou une
  // simple information : ne pas systématiser au détriment de la lisibilité.
  steps?: string[]
}

export interface FaqCategory {
  id: string
  label: string
  items: FaqItem[]
}

// Contenu V1 volontairement limité aux fonctionnalités les plus utilisées
// (cadrage 2026-09-13) — à compléter de façon itérative, pas une couverture
// exhaustive dès le départ.
export const FAQ_CATEGORIES: FaqCategory[] = [
  {
    id: 'dons',
    label: 'Dons',
    items: [
      {
        question: 'Comment enregistrer un don ?',
        answer: 'Depuis Dons > Ajouter :',
        steps: [
          "Recherchez le donateur par son nom, ou créez-le à la volée s'il n'existe pas encore.",
          "Choisissez l'activité concernée (facultatif).",
          'Renseignez le montant et le mode de paiement.',
        ],
      },
      {
        question: 'Comment automatiser des dons récurrents (prélèvements) ?',
        answer: 'Depuis la page Dons réguliers :',
        steps: [
          "Créez un engagement pour le donateur (montant, jour de prélèvement, date de début/fin).",
          "Chaque échéance génère un don à confirmer — rien n'est enregistré automatiquement sans cette validation.",
        ],
      },
      {
        question: 'Puis-je modifier ou réaffecter un don après coup ?',
        answer:
          "Oui, en cliquant sur la ligne du don. Attention : réaffecter un don à un autre donateur est bloqué si un reçu fiscal a déjà été émis pour l'année concernée, pour ne pas désynchroniser un montant déjà déclaré.",
      },
      {
        question: 'Comment exporter la liste des dons ?',
        answer:
          'Le bouton "Exporter" en haut du tableau Dons télécharge un CSV correspondant aux filtres actuellement appliqués (période, donateur, activité, mode de paiement).',
      },
    ],
  },
  {
    id: 'adherents',
    label: 'Adhérents',
    items: [
      {
        question: 'Comment ajouter un adhérent ?',
        answer: 'Depuis Adhérents > Ajouter :',
        steps: [
          'Renseignez la civilité — les champs obligatoires s’adaptent ensuite (ex. un foyer peut ajouter un 2ᵉ nom/prénom).',
          'Complétez les informations de contact.',
          "Enregistrez une adhésion dans la foulée, ou ajoutez-la plus tard depuis la fiche de l'adhérent.",
        ],
      },
      {
        question: 'Comment fonctionne le renouvellement d’une adhésion ?',
        answer:
          "Une adhésion est valable un an glissant à partir de sa date de début (pas une année civile). La date de fin et le statut (actif/expiré) sont calculés automatiquement — ils ne se saisissent jamais manuellement.",
      },
      {
        question: 'Comment traiter une demande d’adhésion reçue via le formulaire public ?',
        answer: "Chaque organisation dispose d'un formulaire public personnalisable à partager :",
        steps: [
          "La demande arrive dans Adhérents > Demandes d'adhésion.",
          'Ouvrez-la pour vérifier les informations (un doublon potentiel est signalé automatiquement).',
          'Ratifiez (crée l’adhérent et son adhésion) ou refusez avec un motif.',
        ],
      },
      {
        question: 'Comment gérer les listes de diffusion et tags d’adhérents ?',
        answer: 'Depuis Adhérents :',
        steps: [
          'Sélectionnez une ou plusieurs lignes.',
          'Cliquez sur "Ajouter à une liste" ou "Retirer d’une liste".',
          'Utilisez ensuite cette liste comme cible pour une campagne mailing ou courrier.',
        ],
      },
    ],
  },
  {
    id: 'campagnes',
    label: 'Campagnes',
    items: [
      {
        question: 'Comment envoyer une campagne email à mes adhérents ?',
        answer: 'Depuis Adhérents > Mailing :',
        steps: [
          'Composez le message dans l’éditeur (placeholders possibles comme {{params.prenom}}).',
          'Choisissez les destinataires par statut ou par liste de diffusion.',
          "Envoyez la campagne — un brouillon est conservé automatiquement si vous quittez la page avant.",
        ],
      },
      {
        question: 'Comment configurer l’envoi d’emails (Brevo) ?',
        answer: 'Depuis la page Mailing :',
        steps: [
          'Cliquez sur "Configurer".',
          'Renseignez la clé API et l’expéditeur de votre compte Brevo.',
          "L'envoi de campagnes reste indisponible tant que cette configuration n'est pas enregistrée.",
        ],
      },
      {
        question: 'Comment envoyer un courrier postal (publipostage) ?',
        answer: 'Depuis Adhérents > Campagne courrier :',
        steps: [
          'Sélectionnez les destinataires par statut ou par liste de diffusion, comme pour le mailing.',
          'Générez le document imprimable regroupant les adresses postales.',
          'Traitez ensuite l’envoi papier de votre côté.',
        ],
      },
      {
        question: 'Un adhérent peut-il se désinscrire des emails ?',
        answer:
          "Oui, chaque email envoyé contient un lien de désinscription RGPD. Un email qui rebondit (adresse invalide) est aussi signalé automatiquement sur la fiche de l'adhérent concerné.",
      },
    ],
  },
  {
    id: 'recus-fiscaux',
    label: 'Reçus fiscaux',
    items: [
      {
        question: 'Que faut-il configurer avant de générer un premier reçu fiscal ?',
        answer:
          "Dans Paramètres > Fiscalité : nom, adresse, RNA ou SIREN, objet social et mention légale d'éligibilité de l'organisation. Tant que l'un de ces champs manque, aucun reçu ne peut être généré (message explicite sur la page Reçus fiscaux).",
      },
      {
        question: 'Comment générer un reçu fiscal ?',
        answer: 'Depuis Reçus fiscaux :',
        steps: [
          "Sélectionnez l'année concernée.",
          'Générez le reçu d’un donateur, ou tous les reçus en une fois.',
          'Le bon modèle Cerfa (11580 particulier, 16216 personne morale) est choisi automatiquement selon la civilité du donateur.',
        ],
      },
      {
        question: 'Pourquoi la génération est-elle bloquée pour certains donateurs ?',
        answer:
          "Chaque donateur doit avoir nom, adresse, code postal, ville et civilité renseignés (prénom en plus pour un particulier). Un don enregistré au nom d'une \"famille\" ne peut jamais générer de reçu : il faut identifier le foyer fiscal ou la personne exacte.",
      },
      {
        question: 'Puis-je régénérer un reçu déjà émis ?',
        answer:
          "Oui, mais le numéro attribué à l'origine est définitif — une régénération ne change jamais le numéro, même si le contenu ou le montant a changé depuis.",
      },
    ],
  },
  {
    id: 'benevole',
    label: 'Bénévole',
    items: [
      {
        question: 'Comment un bénévole se connecte-t-il ?',
        answer:
          "Via \"Accéder avec votre code PIN\" sur la page de connexion — un code à 4 chiffres propre à l'organisation, pas un compte email/mot de passe individuel.",
      },
      {
        question: 'J’ai oublié le code PIN bénévole, comment le retrouver ?',
        answer:
          "Un administrateur peut l'afficher (icône œil) ou le régénérer depuis Paramètres > Organisation.",
      },
      {
        question: 'Que peut faire un bénévole une fois connecté ?',
        answer:
          "Deux actions principales : saisir un don sur le terrain (avec création du donateur à la volée si besoin) et vérifier la carte d'un adhérent présentée physiquement.",
      },
    ],
  },
]
