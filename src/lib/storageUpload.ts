// Erreurs d'envoi vers Supabase Storage : un bucket qui porte ses propres limites
// (allowed_mime_types, file_size_limit) refuse le fichier avec un statusCode
// « 415 » (type non autorisé) ou « 413 » (taille dépassée), sous un status HTTP 400.

/** Résultat d'un envoi : url publique si réussi, sinon le message d'erreur à afficher. */
export type StorageUploadResult = { url: string; error: null } | { url: null; error: string }

const REJECTION_CODES = ['413', '415']

export function isStorageRejection(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false
  const { status, statusCode } = error as { status?: unknown; statusCode?: unknown }
  return REJECTION_CODES.includes(String(statusCode)) || REJECTION_CODES.includes(String(status))
}

/** Message affiché sous le champ fichier quand l'envoi échoue. `formats` : ex. « PNG ou JPEG ». */
export function storageUploadErrorMessage(error: unknown, formats: string): string {
  return isStorageRejection(error)
    ? `Fichier refusé (${formats}, 2 Mo max)`
    : "Erreur lors de l'envoi du fichier"
}
