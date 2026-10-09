import { useEffect, useState } from 'react'
import PinCodeCard from '../components/parametres/PinCodeCard'
import { useAdminOutletContext } from '../hooks/useAdminOutletContext'
import { useOrganisationId } from '../hooks/useOrganisationId'
import { supabase } from '../lib/supabaseClient'

// Paramètres › Codes PIN : bénévole puis vendeur (si le porte-monnaie est actif). Sortis de
// l'ancienne page Organisation ; régénération immédiate, sans bouton Enregistrer.
export default function ParametresCodesPinPage() {
  const organisationId = useOrganisationId()
  const { fonctionnalitesActivees } = useAdminOutletContext()
  const [pins, setPins] = useState<{ benevole: string | null; vendeur: string | null } | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!organisationId) return
    let cancelled = false
    void supabase
      .from('organisations')
      .select('code_pin_benevole, code_pin_vendeur_evenement')
      .eq('id', organisationId)
      .single()
      .then(({ data, error: loadError }) => {
        if (cancelled) return
        if (loadError || !data) {
          setError(loadError?.message ?? 'Erreur de chargement')
          return
        }
        const row = data as { code_pin_benevole: string | null; code_pin_vendeur_evenement: string | null }
        setPins({ benevole: row.code_pin_benevole, vendeur: row.code_pin_vendeur_evenement })
      })
    return () => { cancelled = true }
  }, [organisationId])

  return (
    <div className="-m-6 min-h-[calc(100%+3rem)] space-y-6 bg-paper p-6 font-registre">
      <div>
        <h1 className="text-2xl font-bold text-ink md:text-3xl">Codes PIN</h1>
        <p className="mt-1 text-sm text-ink-muted">Accès partagés des bénévoles et des vendeurs, sans compte individuel.</p>
      </div>

      {error && <div className="rounded-sm border border-stamp/30 bg-stamp/[0.04] px-4 py-3 text-sm text-stamp">{error}</div>}
      {!pins && !error && <p className="text-sm text-ink-faint">Chargement…</p>}

      {pins && (
        <>
          <PinCodeCard
            organisationId={organisationId}
            role="benevole"
            title="Code PIN bénévole"
            description="Ce code permet aux bénévoles d'accéder à l'écran de saisie de dons. Il est partagé entre tous les bénévoles de votre organisation."
            initialPin={pins.benevole}
            successMessage="Nouveau PIN généré — pensez à le communiquer à vos bénévoles"
          />
          {fonctionnalitesActivees?.evenements && (
            <PinCodeCard
              organisationId={organisationId}
              role="vendeur"
              title="Code PIN vendeur"
              description="Ce code donne accès uniquement à l'écran de demande de paiement du porte-monnaie. Il ne permet pas de saisir des dons ni de consulter les adhésions."
              initialPin={pins.vendeur}
              successMessage="PIN vendeur généré — accès limité aux paiements événement"
            />
          )}
        </>
      )}
    </div>
  )
}
