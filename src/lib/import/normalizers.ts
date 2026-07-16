import type { Civilite } from '../../types'
import type { ParseOutcome } from './types'

const DIACRITICS_PATTERN = new RegExp(`[${String.fromCharCode(0x0300)}-${String.fromCharCode(0x036f)}]`, 'g')

function stripAccents(s: string): string {
  return s.normalize('NFD').replace(DIACRITICS_PATTERN, '')
}

export function parseTextCell(raw: unknown): ParseOutcome<string | null> {
  if (raw === null || raw === undefined) return { ok: true, value: null }
  const s = String(raw).trim()
  return { ok: true, value: s === '' ? null : s }
}

export function parseRequiredTextCell(raw: unknown): ParseOutcome<string> {
  const r = parseTextCell(raw)
  if (!r.ok) return r
  if (r.value) return { ok: true, value: r.value }
  return { ok: false, error: 'Champ obligatoire manquant' }
}

export function parseDateCell(raw: unknown): ParseOutcome<string | null> {
  if (raw === null || raw === undefined || raw === '') return { ok: true, value: null }
  if (raw instanceof Date) {
    if (isNaN(raw.getTime())) return { ok: false, error: 'Date invalide' }
    return { ok: true, value: raw.toISOString().slice(0, 10) }
  }
  const s = String(raw).trim()
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return { ok: true, value: s }
  const m = s.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/)
  if (m) {
    const [, d, mo, y] = m
    return { ok: true, value: `${y}-${mo.padStart(2, '0')}-${d.padStart(2, '0')}` }
  }
  return { ok: false, error: `Date non reconnue : "${s}"` }
}

export function parseRequiredDateCell(raw: unknown): ParseOutcome<string> {
  const r = parseDateCell(raw)
  if (!r.ok) return r
  if (r.value) return { ok: true, value: r.value }
  return { ok: false, error: 'Champ obligatoire manquant' }
}

export function parseMontantCell(raw: unknown): ParseOutcome<number> {
  if (raw === null || raw === undefined || raw === '') {
    return { ok: false, error: 'Champ obligatoire manquant' }
  }
  if (typeof raw === 'number') {
    if (!isFinite(raw) || raw <= 0) return { ok: false, error: 'Montant invalide (doit être > 0)' }
    return { ok: true, value: Math.round(raw * 100) / 100 }
  }
  const cleaned = String(raw).trim().replace(/[€\s]/g, '').replace(',', '.')
  const value = parseFloat(cleaned)
  if (!isFinite(value) || value <= 0) return { ok: false, error: `Montant invalide : "${raw}"` }
  return { ok: true, value: Math.round(value * 100) / 100 }
}

const CIVILITE_ALIASES: Record<string, Civilite> = {
  m: 1,
  mr: 1,
  monsieur: 1,
  mme: 2,
  madame: 2,
  mlle: 3,
  mademoiselle: 3,
  foyer: 4,
  societe: 5,
  ste: 5,
  sarl: 5,
  sas: 5,
  association: 6,
  asso: 6,
  famille: 7,
}

export function parseCiviliteCell(raw: unknown): ParseOutcome<Civilite | null> {
  if (raw === null || raw === undefined || raw === '') return { ok: true, value: null }
  if (typeof raw === 'number' && raw >= 1 && raw <= 7) return { ok: true, value: raw as Civilite }
  const s = String(raw).trim()
  const numeric = Number(s)
  if (!isNaN(numeric) && numeric >= 1 && numeric <= 7) return { ok: true, value: numeric as Civilite }
  const key = stripAccents(s.toLowerCase())
  if (key in CIVILITE_ALIASES) return { ok: true, value: CIVILITE_ALIASES[key] }
  return { ok: false, error: `Civilité non reconnue : "${s}"` }
}

const MODE_PAIEMENT_ALIASES: Record<string, 'virement' | 'cheque' | 'especes'> = {
  virement: 'virement',
  vir: 'virement',
  'virement bancaire': 'virement',
  cheque: 'cheque',
  chq: 'cheque',
  especes: 'especes',
  espece: 'especes',
  cash: 'especes',
  liquide: 'especes',
}

export function parseModePaiementCell(raw: unknown): ParseOutcome<'virement' | 'cheque' | 'especes'> {
  if (raw === null || raw === undefined || raw === '') {
    return { ok: false, error: 'Champ obligatoire manquant' }
  }
  const key = stripAccents(String(raw).trim().toLowerCase())
  if (key in MODE_PAIEMENT_ALIASES) return { ok: true, value: MODE_PAIEMENT_ALIASES[key] }
  return { ok: false, error: `Mode de paiement non reconnu : "${raw}"` }
}
