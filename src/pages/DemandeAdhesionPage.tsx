import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'

// Ancienne adresse du formulaire public d'adhésion (/adhesion/<slug>), retiré le 2026-11-04 :
// les adhésions se saisissent dans l'espace bénévole ou par l'équipe. La page reste pour
// répondre aux anciens liens partagés ; le slug sert toujours au renouvellement
// (/adhesion/<slug>/renouveler).

interface OrganisationPublic {
  nom: string
}

export default function DemandeAdhesionPage() {
  const { slug } = useParams<{ slug: string }>()

  const [organisation, setOrganisation] = useState<OrganisationPublic | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!slug) return

    async function fetchOrganisation() {
      setLoading(true)
      const { data, error } = await supabase.rpc('get_organisation_public', { p_slug: slug })
      setOrganisation(!error && data && data.length > 0 ? (data[0] as OrganisationPublic) : null)
      setLoading(false)
    }

    fetchOrganisation()
  }, [slug])

  if (loading) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-paper font-registre text-sm text-ink-faint">
        Chargement…
      </div>
    )
  }

  return (
    <div className="flex min-h-dvh items-center justify-center bg-paper px-4 font-registre">
      <div className="max-w-md rounded-sm border border-paper-border bg-white p-6 text-center">
        <h1 className="text-lg font-semibold text-ink">Adhésion</h1>
        <p className="mt-2 text-sm text-ink-faint">
          {organisation
            ? `Les adhésions se font directement auprès de ${organisation.nom}.`
            : "Ce lien n'est pas valide ou n'existe plus."}
        </p>
      </div>
    </div>
  )
}
