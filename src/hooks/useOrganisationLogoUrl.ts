import { useEffect, useState } from 'react'
import { fetchOrganisationLogoUrl, ORGANISATION_LOGO_CHANGE_EVENT } from '../lib/organisationLogo'

/** URL du logo de l'organisation, rechargée après un changement fait depuis Paramètres → Visuels. */
export function useOrganisationLogoUrl(organisationId: string | null | undefined): string | null {
  const [logo, setLogo] = useState<{ organisationId: string; url: string | null } | null>(null)

  useEffect(() => {
    if (!organisationId) return
    let cancelled = false
    function load(id: string) {
      fetchOrganisationLogoUrl(id)
        .then((url) => { if (!cancelled) setLogo({ organisationId: id, url }) })
        .catch(() => { if (!cancelled) setLogo({ organisationId: id, url: null }) })
    }
    load(organisationId)
    const onChange = () => load(organisationId)
    window.addEventListener(ORGANISATION_LOGO_CHANGE_EVENT, onChange)
    return () => {
      cancelled = true
      window.removeEventListener(ORGANISATION_LOGO_CHANGE_EVENT, onChange)
    }
  }, [organisationId])

  return logo && logo.organisationId === organisationId ? logo.url : null
}
