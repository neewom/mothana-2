import { useState } from 'react'
import { cn } from '../lib/utils'

/**
 * Logo de l'organisation dans un en-tête : hauteur fixe, proportions conservées. Ne rend rien
 * sans URL ou si l'image ne se charge pas (l'en-tête retombe sur le nom seul).
 */
export default function OrganisationLogo({ url, className }: { url: string | null; className?: string }) {
  const [failedUrl, setFailedUrl] = useState<string | null>(null)
  if (!url || failedUrl === url) return null
  return (
    <img
      src={url}
      alt=""
      aria-hidden="true"
      onError={() => setFailedUrl(url)}
      className={cn('shrink-0 object-contain', className)}
    />
  )
}
