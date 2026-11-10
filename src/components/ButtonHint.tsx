import type { ReactNode } from 'react'
import Tooltip from './Tooltip'

/**
 * Infobulle d'un bouton (composant Tooltip, pas l'attribut `title` natif, invisible au toucher) :
 * raison d'un bouton désactivé, ou nom d'un bouton icône seule. Sans `hint`, le bouton est rendu
 * tel quel. Un bouton désactivé ne reçoit pas le pointeur (`disabled:pointer-events-none`) :
 * survol et toucher arrivent au conteneur, qui ouvre la bulle.
 */
export default function ButtonHint({
  hint,
  children,
  className,
  triggerClassName,
  align,
  placement,
  maxWidthClassName,
}: {
  hint: string | null | undefined
  children: ReactNode
  /** Classes du conteneur, à accorder à celles du bouton (ex. `hidden md:inline-block`, `block w-full`). */
  className?: string
  /** Classes de la zone de survol autour du bouton (`block` pour un bouton pleine largeur). */
  triggerClassName?: string
  align?: 'start' | 'end'
  /** Au-dessus par défaut ; `bottom` quand la place manque au-dessus (haut de page sous un conteneur
   * qui coupe ce qui dépasse, haut de modale). */
  placement?: 'top' | 'bottom'
  /** Largeur max de la bulle (`max-w-xs` par défaut), à réduire si le bouton est loin du bord en mobile. */
  maxWidthClassName?: string
}) {
  if (!hint) return <>{children}</>
  return (
    <Tooltip bare content={hint} className={className} triggerClassName={triggerClassName} align={align} placement={placement} maxWidthClassName={maxWidthClassName}>
      {children}
    </Tooltip>
  )
}
