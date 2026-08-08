// Les erreurs Supabase (PostgrestError, StorageError...) sont des objets simples
// avec un champ `message`, pas des instances `Error` — `instanceof Error` échoue
// et String(err) produit "[object Object]" au lieu du message utile.
export function getErrorMessage(err: unknown): string {
  if (err instanceof Error) return err.message
  if (err && typeof err === 'object' && 'message' in err && typeof err.message === 'string') {
    return err.message
  }
  return String(err)
}
