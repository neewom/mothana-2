# Règles métier — Reçus fiscaux (Cerfa)

## 1. Types de reçus

| Civilité | Type donateur | Template |
|---|---|---|
| 1 (Monsieur) | Particulier | Cerfa 11580 |
| 2 (Madame) | Particulier | Cerfa 11580 |
| 3 (Mademoiselle) | Particulier | Cerfa 11580 |
| 4 (Foyer) | Particulier | Cerfa 11580 |
| 5 (Société) | Personne morale | Cerfa 16216 |
| 6 (Association) | Personne morale | Cerfa 16216 |
| 7 (Famille) | — | ⛔ Bloquant |
| NULL / non défini | — | **Bloquant** (voir §3) |

---

## 2. Validation côté organisation

Avant toute génération de reçu, les champs suivants doivent être renseignés dans les Paramètres. Si l'un manque, **aucun reçu ne peut être généré**.

**Champs obligatoires (modele_recu_pdf JSONB + table organisations) :**
- Nom de l'organisation
- Adresse, code postal, ville
- RNA **ou** SIREN (au moins l'un des deux)
- Objet social
- Mention légale d'éligibilité (ex: "Organisme d'intérêt général éligible au mécénat – article 200 du CGI")

**Message affiché sur la page Reçus si incomplet :**
> "Complétez les paramètres de votre organisation pour pouvoir générer des reçus fiscaux" + lien direct vers Paramètres

---

## 3. Validation côté participant

Chaque participant est validé individuellement avant génération. Si des champs manquent, le reçu de ce participant est bloqué et les champs manquants sont listés dans un message d'erreur sur la ligne du participant.

### Règles communes à tous les participants
| Champ | Obligatoire | Remarque |
|---|---|---|
| Nom | ✅ Oui | Déjà obligatoire en base |
| Adresse | ✅ Oui | Domicile fiscal du donateur |
| Code postal | ✅ Oui | |
| Ville | ✅ Oui | |
| Civilité | ✅ Oui | Sans civilité, impossible de choisir le bon template |
| Email | ⚠️ Non | Pas requis sur le Cerfa, utile pour l'envoi |

### Règles spécifiques par civilité

**Civilité 1, 2, 3, 7 (particulier individuel)**
- Prénom obligatoire

**Civilité 4 (Foyer)**
- Prénom obligatoire (du titulaire principal)
- Nom2 / Prénom2 : optionnels
  - Si renseignés → affichage : "Nom Prénom et Nom2 Prénom2"
  - Si non renseignés → affichage : "Nom Prénom" uniquement

**Civilité 7 (Famille)**
- ⛔ **Génération de reçu impossible**
- Un reçu fiscal est nominatif et ne peut pas être émis au nom d'une "famille" en tant que telle
- Message d'erreur sur la ligne du participant : "Les dons enregistrés au nom d'une famille ne permettent pas de générer un reçu fiscal. Identifiez le foyer fiscal (Mr & Mme) ou le donateur individuel."
- ⚠️ Les 57 participants Velouvanaram en civilité 7 seront tous dans ce cas — l'admin devra recorriger leurs fiches

**Civilité 5, 6 (Société, Association — personne morale)**
- Prénom non requis (nom = raison sociale)
- Template Cerfa 16216

---

## 4. Règles de numérotation

- Numérotation automatique, au format choisi par l'organisation dans Paramètres › Reçus fiscaux (`modele_recu_pdf.format_numero_recu`, depuis le 2026-10-31) :
  - **Séquence annuelle** (`sequence`, défaut quand la clé est absente) : `{ANNÉE}-{N°}` (ex: `2026-001`), RPC `next_numero_recu`. Le numéro de départ est configurable dans les Paramètres (pour continuité avec une numérotation existante)
  - **Année + numéro de donateur** (`donateur`) : `{ANNÉE}-{numéro de donateur}` (ex: `2026-2803`), numéro de donateur = `profils_participant.id_externe` repris tel quel (pas de zéros ajoutés), sans consommer la séquence. Un donateur sans numéro de donateur (ou dont le numéro contient autre chose que chiffres, lettres, tiret et tiret bas) ne peut pas recevoir de reçu dans ce format : erreur explicite, aucun reçu créé. Unicité : `id_externe` est unique par organisation et il n'y a qu'un reçu par donateur et par année
- La règle vit côté serveur (Edge Function `generate-recu`, `supabase/functions/_shared/numeroRecu.ts`) ; le front n'affiche qu'un exemple
- Unicité : un numéro est unique dans une organisation (index unique partiel `(organisation_id, numero_ordre)`, migration `recus_fiscaux_numero_unique.sql`). Dans `generate-recu`, un nouveau numéro déjà porté par un autre reçu de l'organisation (formats mélangés dans une même année, numéro de donateur réattribué) est refusé (409, aucun reçu créé) : contrôle préalable, puis upload du PDF sans écrasement (`upsert: false`) et index en base, qui font foi en cas d'appels simultanés. Aucun PDF n'est jamais remplacé, y compris en régénération (§5)
- L'écriture de la fiche et de la version (`enregistrer_version_recu`) est bloquante : si elle échoue, aucun succès n'est renvoyé et le PDF déposé par cet appel (nouveau fichier, référencé nulle part) est retiré du Storage ; les fichiers des versions déjà émises ne sont jamais touchés (un numéro de séquence ainsi consommé n'est pas réutilisé)
- Changer de format ne renumérote rien : les reçus déjà émis gardent leur numéro, le nouveau format ne s'applique qu'aux reçus créés ensuite
- Un numéro attribué est **définitif** — même en cas de regénération du reçu, le même numéro est conservé
- La séquence repart à partir du numéro de départ configuré chaque 1er janvier
- Tenu en base depuis le 2026-10-30 (`recus_fiscaux_immutabilite.sql`) : un trigger refuse tout changement d'un `numero_ordre` déjà attribué, ainsi que de `organisation_id`, `profil_participant_id` et `annee`, pour tous les rôles. Une migration de correction devra désactiver explicitement le trigger `recus_fiscaux_verrou_identite` le temps de l'opération

---

## 5. Règles de regénération et versions

- Si un reçu existe déjà pour un participant sur une année donnée → message de confirmation : la régénération crée une nouvelle version du PDF avec le même numéro, la précédente est conservée
- **Chaque génération crée une version conservée** (depuis le 2026-11-04, migration `recus_fiscaux_versions.sql`) : nouveau fichier PDF, le **numéro d'ordre est conservé** (pas de nouveau numéro). Version 1 : `<organisation>/<année>/<numéro>.pdf` ; versions suivantes : `<numéro>-v<N>.pdf`. Upload toujours sans écrasement (`upsert: false`)
- `recus_fiscaux` reste la fiche du reçu (un par donateur et par année, upsert sur `profil_participant_id` + `annee`) et pointe sur la dernière version (`fichier_url`, montant, snapshots) ; `recus_fiscaux_versions` garde chaque version (n°, fichier, montant, snapshots donateur/organisation, `genere_le`, `genere_par`, `email_envoye_le`). Les deux s'écrivent dans une même transaction, par la fonction `enregistrer_version_recu` (service_role seulement), appelée par `generate-recu`
- Génération en lot (« Générer les N reçus manquants ») : ne traite que les reçus **pas encore générés** de l'année (fiches complètes), dans le même ordre d'attribution des numéros qu'auparavant ; aucun reçu existant n'y reçoit de nouvelle version (décision utilisateur du 2026-11-04) — la régénération d'un reçu passe par son bouton « Regénérer »
- Suppression : un donateur ou une organisation ayant au moins un reçu émis ne peut pas être supprimé (versions conservées 6 ans) ; l'organisation peut être archivée
- Envoi par email (`send-recu-email`) : envoie la dernière version et renseigne son `email_envoye_le` (en plus de `recus_fiscaux.email_envoye_at`)
- **Immutabilité tenue en base, pour tous les rôles (service_role et super-admin compris)** : trigger `recus_fiscaux_versions_immuables`, aucune mise à jour d'une version sauf `email_envoye_le`, aucune suppression (ni directe, ni par cascade : supprimer un donateur ou une organisation qui a des reçus émis échoue désormais), ni TRUNCATE. Une migration de correction devra désactiver explicitement ce trigger
- Lecture : membres de l'organisation + bypass super-admin ; aucune écriture client. Storage (bucket privé `recus-fiscaux`) : une seule policy, de lecture (organisation + bypass super-admin) ; aucun client ne peut déposer, remplacer ni supprimer un PDF. Seul le service_role (Edge Functions) écrit, et `generate-recu` ne supprime que le fichier qu'il vient de déposer quand l'enregistrement échoue
- Historique consultable et téléchargeable dans le détail d'un reçu (page Reçus fiscaux), dernière version mise en avant
- Reprise de l'existant : une version 1 par reçu existant au moment de la migration, pointant sur son fichier actuel ; les versions écrasées auparavant sont perdues. Elle n'est marquée envoyée que si l'email est postérieur à la génération du fichier actuel (sinon le PDF envoyé avait été écrasé depuis)
- Hors périmètre : reçu rectificatif / nouveau numéro, purge après 6 ans

---

## 6. Règles de calcul du montant

- Seuls les dons **strictement supérieurs à 0€** sont inclus dans le total annuel
- Le montant est affiché **en chiffres et en toutes lettres** sur le reçu (obligation légale)
- Les dons de toutes les activités confondues sont agrégés sur l'année

---

## 7. Obligations légales de l'association

⚠️ À afficher dans les Paramètres à titre informatif :
- L'association doit conserver une copie de chaque reçu émis pendant **6 ans**
- Depuis le 1er janvier 2021, l'association doit **déclarer annuellement** à l'administration fiscale le montant total des dons et le nombre de reçus émis (article 222 bis du CGI), quel que soit le montant
- Une association qui émet des reçus sans y être habilitée s'expose à une amende égale à **66% des sommes inscrites** sur les reçus

---

## 8. Champs à ajouter dans les Paramètres organisation

À ajouter dans `modele_recu_pdf` (JSONB) :

| Champ | Type | Description |
|---|---|---|
| rna | text | Numéro RNA (format W + 9 chiffres) |
| siren | text | Numéro SIREN (optionnel si RNA renseigné) |
| objet_social | text | Objet social de l'association |
| mention_legale | text | Mention d'éligibilité CGI (pré-remplie avec formule standard) |
| numero_recu_depart | integer | Numéro du premier reçu (défaut : 1) |

Champs déjà existants dans `modele_recu_pdf` (à conserver) :
- Les 4 champs actuels (à identifier dans le code)

Champs déjà dans `organisations` (à utiliser directement) :
- `nom`
- Adresse (à vérifier si elle existe ou à ajouter)
