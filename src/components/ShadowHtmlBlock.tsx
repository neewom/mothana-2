import { useEffect, useRef } from 'react'
import DOMPurify from 'dompurify'

interface ShadowHtmlBlockProps {
  html: string
  css?: string
  className?: string
}

// Rend du HTML/CSS saisi par un admin (en-tête/pied de page du formulaire
// public d'adhésion) dans un shadow DOM : isole le CSS personnalisé du reste
// de l'app dans les deux sens (pas de fuite de style), et sanitize le HTML
// (DOMPurify) car il est affiché à des visiteurs anonymes, contrairement aux
// templates Cerfa/carte qui ne sont jamais rendus tels quels dans le navigateur.
export default function ShadowHtmlBlock({ html, css, className }: ShadowHtmlBlockProps) {
  const hostRef = useRef<HTMLDivElement>(null)
  const shadowRef = useRef<ShadowRoot | null>(null)

  useEffect(() => {
    if (!hostRef.current) return
    if (!shadowRef.current) {
      shadowRef.current = hostRef.current.attachShadow({ mode: 'open' })
    }
    // CSS posé en texte (jamais via innerHTML : un « </style><img onerror> » dans le CSS
    // s'exécutait) ; HTML assaini par DOMPurify et inséré comme nœuds (audit sécurité 2026-10-24).
    const style = document.createElement('style')
    style.textContent = css ?? ''
    shadowRef.current.replaceChildren(style, DOMPurify.sanitize(html, { RETURN_DOM_FRAGMENT: true }))
  }, [html, css])

  // contain: paint : un élément position:fixed du CSS saisi reste confiné au bloc.
  return <div ref={hostRef} className={className} style={{ contain: 'paint' }} />
}
