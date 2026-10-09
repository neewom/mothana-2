import { useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'

/**
 * Ouvre l'élément désigné par un paramètre d'URL (ex. `?id=…` depuis la recherche globale) dès
 * que la liste est chargée, puis retire le paramètre pour qu'un rechargement ou un retour ne
 * rouvre pas le panneau. `items` à null tant que la liste n'est pas chargée.
 */
export function useDeepLinkSelection<T extends { id: string }>(
  items: T[] | null,
  onFound: (item: T) => void,
  param = 'id',
) {
  const [searchParams, setSearchParams] = useSearchParams()
  const wanted = searchParams.get(param)

  useEffect(() => {
    if (!wanted || !items) return
    const item = items.find((candidate) => candidate.id === wanted)
    if (item) onFound(item)
    setSearchParams((current) => {
      const next = new URLSearchParams(current)
      next.delete(param)
      return next
    }, { replace: true })
  // onFound peut changer à chaque rendu : sans effet, le paramètre est retiré dès le premier passage.
  }, [wanted, items, param, setSearchParams, onFound])
}
