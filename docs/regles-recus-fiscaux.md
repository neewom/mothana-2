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

- Numérotation automatique, séquence annuelle : `{ANNÉE}-{N°}` (ex: `2026-001`)
- Le numéro de départ est configurable dans les Paramètres (pour continuité avec une numérotation existante)
- Un numéro attribué est **définitif** — même en cas de regénération du reçu, le même numéro est conservé
- La séquence repart à partir du numéro de départ configuré chaque 1er janvier

---

## 5. Règles de regénération

- Si un reçu existe déjà pour un participant sur une année donnée → message de confirmation : "Un reçu a déjà été généré pour ce participant pour l'année {ANNÉE}. Voulez-vous le regénérer ?"
- En cas de regénération : le fichier PDF est remplacé (nouveau fichier en Storage), mais le **numéro d'ordre est conservé** (pas de nouveau numéro)
- La ligne `recus_fiscaux` est mise à jour (upsert sur `profil_participant_id` + `annee`)

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
