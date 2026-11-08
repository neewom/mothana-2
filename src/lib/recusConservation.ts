/**
 * Les versions des reçus fiscaux émis sont immuables (obligation de conservation de 6 ans,
 * trigger `recus_fiscaux_versions_immuables`) : un donateur ou une organisation qui en a ne
 * peut pas être supprimé. Messages affichés à la place de l'erreur brute de la base.
 */
export const MESSAGE_DONATEUR_AVEC_RECUS =
  'Ce donateur a des reçus fiscaux émis : ils doivent être conservés 6 ans, il ne peut pas être supprimé.'

export const MESSAGE_ORGANISATION_AVEC_RECUS =
  'Cette organisation a émis des reçus fiscaux : ils doivent être conservés 6 ans. Archivez-la plutôt que de la supprimer.'

/** Erreur levée par le trigger d'immutabilité des versions (suppression en cascade refusée). */
export function estRefusConservationRecus(err: { code?: string; message?: string } | null | undefined): boolean {
  if (!err) return false
  return err.code === '23514' && /re[çc]u/i.test(err.message ?? '')
}
