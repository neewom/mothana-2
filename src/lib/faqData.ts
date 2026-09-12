export interface FaqItem {
  question: string
  answer: string
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
        answer:
          "Depuis Dons > Ajouter, renseignez le donateur (recherche instantanée ou création à la volée), l'activité, le montant et le mode de paiement. Le donateur peut être retrouvé en tapant son nom, ou créé directement depuis le formulaire s'il n'existe pas encore.",
      },
      {
        question: 'Comment automatiser des dons récurrents (prélèvements) ?',
        answer:
          "La page Dons réguliers permet de créer un engagement mensuel (montant, jour de prélèvement, date de début/fin) pour un donateur. Chaque échéance génère un don à confirmer avant d'être définitivement enregistré — rien n'est validé automatiquement sans passage par cette confirmation.",
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
        answer:
          "Depuis Adhérents > Ajouter. Les champs obligatoires dépendent de la civilité choisie (ex. un foyer peut renseigner un 2ᵉ nom/prénom). Une adhésion peut être enregistrée dans la foulée ou ajoutée plus tard depuis la fiche adhérent.",
      },
      {
        question: 'Comment fonctionne le renouvellement d’une adhésion ?',
        answer:
          "Une adhésion est valable un an glissant à partir de sa date de début (pas une année civile). La date de fin et le statut (actif/expiré) sont calculés automatiquement — ils ne se saisissent jamais manuellement.",
      },
      {
        question: 'Comment traiter une demande d’adhésion reçue via le formulaire public ?',
        answer:
          "Chaque organisation dispose d'un formulaire public (lien à partager, personnalisable en en-tête/pied de page). Les demandes arrivent dans Adhérents > Demandes d'adhésion, à ratifier ou refuser (avec motif) individuellement — la ratification crée l'adhérent et son adhésion.",
      },
      {
        question: 'Comment gérer les listes de diffusion et tags d’adhérents ?',
        answer:
          "Depuis Adhérents, sélectionnez une ou plusieurs lignes puis \"Ajouter à une liste\"/\"Retirer d'une liste\". Ces listes servent ensuite de cible pour une campagne mailing ou courrier.",
      },
    ],
  },
  {
    id: 'campagnes',
    label: 'Campagnes',
    items: [
      {
        question: 'Comment envoyer une campagne email à mes adhérents ?',
        answer:
          "Depuis Adhérents > Mailing : composez le message (éditeur riche, placeholders comme {{params.prenom}}), choisissez les destinataires par statut ou par liste de diffusion, puis envoyez. Un brouillon est conservé automatiquement si vous quittez la page.",
      },
      {
        question: 'Comment configurer l’envoi d’emails (Brevo) ?',
        answer:
          "Le bouton \"Configurer\" sur la page Mailing ouvre la modale de connexion à votre compte Brevo (clé API, expéditeur). Tant qu'elle n'est pas configurée, l'envoi de campagnes n'est pas disponible.",
      },
      {
        question: 'Comment envoyer un courrier postal (publipostage) ?',
        answer:
          "La page Campagne courrier fonctionne comme le mailing (sélection de destinataires par statut ou liste) mais génère un document imprimable regroupant les adresses postales, à traiter ensuite en envoi papier.",
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
        answer:
          "Depuis Reçus fiscaux, sélectionnez l'année puis générez le reçu d'un donateur (ou en masse). Le bon modèle Cerfa (11580 particulier, 16216 personne morale) est choisi automatiquement selon la civilité du donateur.",
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
