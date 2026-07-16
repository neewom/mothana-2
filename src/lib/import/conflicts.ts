import type { ConflictRow } from './types'

export type Resolution = 'current' | 'imported'
export type ResolutionMap = Record<number, Record<string, Resolution>>

/** Choix par défaut pour chaque champ en conflit de chaque ligne (ex : "imported" partout). */
export function defaultResolutions(conflicts: ConflictRow[], choice: Resolution): ResolutionMap {
  const map: ResolutionMap = {}
  for (const c of conflicts) {
    const fieldChoices: Record<string, Resolution> = {}
    for (const d of c.diffs) {
      fieldChoices[d.key] = choice
    }
    map[c.index] = fieldChoices
  }
  return map
}

/** Construit les lignes finales à envoyer pour les conflits, en appliquant les choix de résolution. */
export function applyResolutions(conflicts: ConflictRow[], resolutions: ResolutionMap): Record<string, unknown>[] {
  return conflicts.map((c) => {
    const row = { ...c.payloadBase }
    const rowResolutions = resolutions[c.index] ?? {}
    for (const d of c.diffs) {
      if (rowResolutions[d.key] === 'current') {
        row[d.key] = d.current
      }
      // 'imported' (par défaut) : payloadBase contient déjà la valeur importée.
    }
    return row
  })
}
