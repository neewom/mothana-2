import { useCallback, useEffect, useRef } from 'react'

/**
 * Clé de l'affichage courant (ex. `${organisationId}|${annee}`) : la fonction renvoyée dit si une
 * clé capturée au lancement d'une requête est toujours celle affichée, pour ignorer une réponse
 * arrivée après un changement d'organisation ou d'année.
 */
export function useCleCourante(cle: string): (cleLancement: string) => boolean {
  const cleRef = useRef(cle)
  useEffect(() => { cleRef.current = cle }, [cle])
  return useCallback((cleLancement: string) => cleRef.current === cleLancement, [])
}
