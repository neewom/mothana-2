export type ImportEntityKey = 'participants' | 'activites' | 'dons' | 'adherents'

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

export interface SensitiveConflict {
  /** collision : même id_externe, mais nom+prénom différents (probable personne distincte). */
  /** duplicate : pas de match par id_externe, mais nom/prénom/email/téléphone correspond à un adhérent existant sous un autre id_externe. */
  kind: 'collision' | 'duplicate'
  reason: string
}

export interface ConflictRow {
  index: number
  idExterne: string | null
  /** Ligne prête à envoyer, valeurs importées par défaut ; ajustée par applyResolutions selon les choix de l'admin. */
  payloadBase: Record<string, unknown>
  diffs: FieldDiff[]
  /** Renseigné uniquement pour les adhérents : ce conflit nécessite une décision explicite (pas de résolution groupée) avant de pouvoir continuer. */
  sensitive?: SensitiveConflict
  /**
   * Payload alternatif prêt à insérer comme adhérent distinct si l'admin choisit
   * "Créer un nouvel adhérent" sur une ligne sensible. Pour kind === 'collision',
   * id_externe est null (l'importé est déjà pris) : à renseigner via
   * next_adherent_id_externe au moment du choix, avant envoi.
   */
  createNewPayload?: Record<string, unknown>
}
