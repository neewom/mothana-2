export type ImportEntityKey = 'participants' | 'activites' | 'dons'

export type ParseOutcome<T = unknown> = { ok: true; value: T } | { ok: false; error: string }

export interface FieldDef {
  key: string
  label: string
  required: boolean
  parse: (raw: unknown) => ParseOutcome
  /** Formatage pour l'affichage humain (résolution de conflits). Défaut : String(value) ou "—" si vide. */
  formatValue?: (value: unknown) => string
  /** Autres noms de colonnes reconnus pour le mapping automatique (ex : anglais, abréviations). */
  aliases?: string[]
}

export interface ParsedRow {
  index: number
  values: Record<string, unknown>
  errors: Record<string, string>
}

export interface ExcludedRow {
  index: number
  reason: string
}

export interface FieldDiff {
  key: string
  label: string
  current: unknown
  imported: unknown
  format: (value: unknown) => string
}

export interface ConflictRow {
  index: number
  idExterne: string | null
  /** Ligne prête à envoyer, valeurs importées par défaut ; ajustée par applyResolutions selon les choix de l'admin. */
  payloadBase: Record<string, unknown>
  diffs: FieldDiff[]
}
