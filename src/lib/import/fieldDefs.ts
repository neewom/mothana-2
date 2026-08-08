import type { Civilite, CiviliteAdherent, ModePaiement } from '../../types'
import type { FieldDef } from './types'
import { CIVILITE_LABELS } from '../civilite'
import { CIVILITE_ADHERENT_LABELS } from '../civiliteAdherent'
import { MODE_PAIEMENT_LABELS } from '../modePaiement'
import {
  parseTextCell,
  parseRequiredTextCell,
  parseDateCell,
  parseRequiredDateCell,
  parseBirthDateCell,
  parseMontantCell,
  parseCiviliteCell,
  parseModePaiementCell,
  parseOptionalMontantCell,
  parseOptionalModePaiementCell,
  parseCiviliteAdherentCell,
  parseBooleanCellDefaultTrue,
} from './normalizers'

function formatCivilite(value: unknown): string {
  if (value === null || value === undefined || value === '') return '—'
  return `${CIVILITE_LABELS[value as Civilite]} (${value})`
}

function formatCiviliteAdherent(value: unknown): string {
  if (value === null || value === undefined || value === '') return '—'
  return CIVILITE_ADHERENT_LABELS[value as CiviliteAdherent]
}

function formatModePaiement(value: unknown): string {
  if (value === null || value === undefined || value === '') return '—'
  return MODE_PAIEMENT_LABELS[value as ModePaiement]
}

function formatBoolean(value: unknown): string {
  return value ? 'Oui' : 'Non'
}

export const participantsFieldDefs: FieldDef[] = [
  { key: 'id_externe', label: 'Identifiant externe', required: false, parse: parseTextCell, aliases: ['external id', 'externalid', 'ref externe', 'reference externe'] },
  { key: 'nom', label: 'Nom', required: true, parse: parseRequiredTextCell, aliases: ['name', 'lastname', 'last name', 'surname'] },
  { key: 'prenom', label: 'Prénom', required: false, parse: parseTextCell, aliases: ['firstname', 'first name', 'given name'] },
  { key: 'civilite', label: 'Civilité', required: false, parse: parseCiviliteCell, formatValue: formatCivilite, aliases: ['title', 'salutation'] },
  { key: 'email', label: 'Email', required: false, parse: parseTextCell, aliases: ['mail', 'e-mail', 'courriel'] },
  { key: 'telephone', label: 'Téléphone', required: false, parse: parseTextCell, aliases: ['phone', 'tel', 'mobile', 'phone number'] },
  { key: 'adresse', label: 'Adresse', required: false, parse: parseTextCell, aliases: ['address', 'street'] },
  { key: 'code_postal', label: 'Code postal', required: false, parse: parseTextCell, aliases: ['zip', 'zipcode', 'postal code', 'postcode', 'cp'] },
  { key: 'ville', label: 'Ville', required: false, parse: parseTextCell, aliases: ['city', 'town'] },
  { key: 'pays', label: 'Pays', required: false, parse: parseTextCell, aliases: ['country'] },
  { key: 'nom2', label: 'Nom 2 (co-signataire)', required: false, parse: parseTextCell, aliases: ['name2', 'lastname2'] },
  { key: 'prenom2', label: 'Prénom 2 (co-signataire)', required: false, parse: parseTextCell, aliases: ['firstname2'] },
  { key: 'notes', label: 'Notes', required: false, parse: parseTextCell, aliases: ['comment', 'comments', 'remark', 'remarks'] },
]

export const activitesFieldDefs: FieldDef[] = [
  { key: 'id_externe', label: 'Identifiant externe', required: false, parse: parseTextCell, aliases: ['external id', 'externalid', 'ref externe', 'reference externe'] },
  { key: 'nom', label: 'Nom', required: true, parse: parseRequiredTextCell, aliases: ['name', 'title'] },
  { key: 'date_debut', label: 'Date de début', required: false, parse: parseDateCell, aliases: ['start date', 'startdate', 'begin date'] },
  { key: 'date_fin', label: 'Date de fin', required: false, parse: parseDateCell, aliases: ['end date', 'enddate'] },
]

export const donsFieldDefs: FieldDef[] = [
  { key: 'id_externe', label: 'Identifiant externe', required: false, parse: parseTextCell, aliases: ['external id', 'externalid', 'ref externe', 'reference externe'] },
  { key: 'participant_id_externe', label: 'Identifiant externe participant', required: true, parse: parseRequiredTextCell, aliases: ['participant id', 'donor id', 'participant external id'] },
  { key: 'activite_id_externe', label: 'Identifiant externe activité', required: false, parse: parseTextCell, aliases: ['activity id', 'event id'] },
  { key: 'montant', label: 'Montant', required: true, parse: parseMontantCell, aliases: ['amount', 'total'] },
  { key: 'date', label: 'Date du don', required: true, parse: parseRequiredDateCell, aliases: ['donation date', 'date don'] },
  { key: 'mode_paiement', label: 'Mode de paiement', required: true, parse: parseModePaiementCell, formatValue: formatModePaiement, aliases: ['payment method', 'payment type', 'method'] },
]

// Champs stables (adherents) + champs de cycle (adhesions) — date_debut est
// obligatoire pour que la comparaison de cycle (buildAdherentsBatch) soit
// possible, cohérent avec le fait que la donnée source a toujours une date
// de cycle en cours. Les autres champs de cycle restent optionnels (montant,
// mode de paiement, droit de vote, bulletin signé — cf. AdherentModal.tsx).
export const adherentsFieldDefs: FieldDef[] = [
  { key: 'id_externe', label: 'Identifiant externe', required: false, parse: parseTextCell, aliases: ['external id', 'externalid', 'ref externe', 'reference externe'] },
  { key: 'civilite', label: 'Civilité', required: false, parse: parseCiviliteAdherentCell, formatValue: formatCiviliteAdherent, aliases: ['title', 'salutation'] },
  { key: 'nom', label: 'Nom', required: true, parse: parseRequiredTextCell, aliases: ['name', 'lastname', 'last name', 'surname'] },
  { key: 'prenom', label: 'Prénom', required: false, parse: parseTextCell, aliases: ['firstname', 'first name', 'given name'] },
  { key: 'date_naissance', label: 'Date de naissance', required: false, parse: parseBirthDateCell, aliases: ['birth date', 'date of birth', 'dob'] },
  { key: 'adresse', label: 'Adresse', required: false, parse: parseTextCell, aliases: ['address', 'street'] },
  { key: 'code_postal', label: 'Code postal', required: false, parse: parseTextCell, aliases: ['zip', 'zipcode', 'postal code', 'postcode', 'cp'] },
  { key: 'ville', label: 'Ville', required: false, parse: parseTextCell, aliases: ['city', 'town'] },
  { key: 'telephone', label: 'Téléphone', required: false, parse: parseTextCell, aliases: ['phone', 'tel', 'mobile', 'phone number'] },
  { key: 'courriel', label: 'Courriel', required: false, parse: parseTextCell, aliases: ['email', 'mail', 'e-mail'] },
  { key: 'date_debut', label: "Date d'adhésion", required: true, parse: parseRequiredDateCell, aliases: ['membership date', 'adhesion date', 'join date', "date d'adhesion"] },
  { key: 'montant_cotisation', label: 'Cotisation', required: false, parse: parseOptionalMontantCell, aliases: ['membership fee', 'cotisation annuelle', 'cotisation_annuelle'] },
  { key: 'date_paiement_cotisation', label: 'Date de paiement', required: false, parse: parseDateCell, aliases: ['payment date', 'date_paie_cotis'] },
  { key: 'mode_paiement', label: 'Mode de paiement', required: false, parse: parseOptionalModePaiementCell, formatValue: formatModePaiement, aliases: ['payment method', 'payment type', 'method', 'mode_paie_cotis'] },
  { key: 'droit_vote_ag', label: 'Droit de vote AG', required: false, parse: parseBooleanCellDefaultTrue, formatValue: formatBoolean, aliases: ['ag droit vote', 'voting right', 'ag_droit_vote'] },
  { key: 'bulletin_signe', label: 'Bulletin signé', required: false, parse: parseBooleanCellDefaultTrue, formatValue: formatBoolean, aliases: ['bulletin signed', 'bulletin_signe'] },
]
