import { useEffect, useState } from 'react'

/** Valeur recopiée après `delayMs` sans changement (recherche serveur : un appel par pause de frappe). */
export function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs)
    return () => clearTimeout(timer)
  }, [value, delayMs])
  return debounced
}
