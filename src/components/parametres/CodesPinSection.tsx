import { useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import ParametresGroupe from './ParametresGroupe'
import PinCodeCard from './PinCodeCard'
import { supabase } from '../../lib/supabaseClient'

interface CodesPinSectionProps {
  organisationId: string
  /** Module porte-monnaie actif : ajoute le PIN vendeur après le PIN bénévole. */
  avecVendeur: boolean
}

/**
 * Section « Codes PIN » de Paramètres › Équipe et accès (ex-page Codes PIN, fusionnée le
 * 2026-11-09) : bénévole puis vendeur si le porte-monnaie est actif ; régénération immédiate, sans
 * bouton Enregistrer. Ancre `#codes-pin` (redirection de l'ancienne adresse /admin/parametres/codes-pin).
 */
export default function CodesPinSection({ organisationId, avecVendeur }: CodesPinSectionProps) {
  const { hash } = useLocation()
  const [pins, setPins] = useState<{ benevole: string | null; vendeur: string | null } | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!organisationId) return
    let cancelled = false
    // PIN lus par la RPC codes_pin (organisation_secrets) : admin de l'organisation ou super-admin.
    void supabase
      .rpc('codes_pin', { p_organisation_id: organisationId })
      .then(({ data, error: loadError }) => {
        if (cancelled) return
        if (loadError) {
          setError(loadError.code === '42501' ? 'Les codes PIN sont réservés aux administrateurs.' : loadError.message)
          return
        }
        const row = ((data ?? []) as { code_pin_benevole: string | null; code_pin_vendeur_evenement: string | null }[])[0]
        setPins({ benevole: row?.code_pin_benevole ?? null, vendeur: row?.code_pin_vendeur_evenement ?? null })
      })
    return () => { cancelled = true }
  }, [organisationId])

  // Arrivée par l'ancre (#codes-pin) : la section n'a sa hauteur définitive qu'une fois les PIN chargés.
  useEffect(() => {
    if (hash === '#codes-pin' && (pins || error)) document.getElementById('codes-pin')?.scrollIntoView({ block: 'start' })
  }, [hash, pins, error])

  return (
    <ParametresGroupe id="codes-pin" title="Codes PIN" description="Accès partagés des bénévoles et des vendeurs, sans compte individuel.">
      {error && <div className="rounded-sm border border-stamp/30 bg-stamp/[0.04] px-4 py-3 text-sm text-stamp">{error}</div>}
      {!pins && !error && <p className="text-sm text-ink-faint">Chargement…</p>}
      {pins && (
        <>
          <PinCodeCard
            level={3}
            organisationId={organisationId}
            role="benevole"
            title="Code PIN bénévole"
            description="Ce code permet aux bénévoles d'accéder à l'écran de saisie de dons. Il est partagé entre tous les bénévoles de votre organisation."
            initialPin={pins.benevole}
            successMessage="Nouveau PIN généré — pensez à le communiquer à vos bénévoles"
          />
          {avecVendeur && (
            <PinCodeCard
              level={3}
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
    </ParametresGroupe>
  )
}
