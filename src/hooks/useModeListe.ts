import { useCallback, useState } from 'react'
import { useMediaQuery } from './useMediaQuery'
import { ecrireModeListe, lireModeListe, type ModeListe } from '../lib/listeDonnees'

/**
 * Mode d'affichage d'une liste (`ui/liste-donnees`) : sous 768 px, choix tableau / cartes de
 * l'utilisateur (cartes par défaut), mémorisé par appareil et par liste (`id`) ; à partir de
 * 768 px, toujours le tableau et pas de sélecteur.
 *
 * `selecteur` se passe tel quel à `ListToolbar` (prop `mode`), `mode` à `ListeDonnees`.
 */
export function useModeListe(id: string) {
  const mobile = !useMediaQuery('(min-width: 768px)')
  const [prefere, setPrefere] = useState<ModeListe>(() => lireModeListe(id))

  const choisir = useCallback(
    (next: ModeListe) => {
      setPrefere(next)
      ecrireModeListe(id, next)
    },
    [id],
  )

  const mode: ModeListe = mobile ? prefere : 'tableau'
  return { mode, selecteur: mobile ? { value: prefere, onChange: choisir } : undefined }
}
