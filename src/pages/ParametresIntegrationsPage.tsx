import { useEffect, useState } from 'react'
import BrevoConfigModal from '../components/BrevoConfigModal'
import { brevoConfigure, chargerEtatConfigBrevo, type EtatConfigBrevo } from '../lib/brevoConfig'
import { useAuth } from '../hooks/useAuth'
import ParametresSection from '../components/ParametresSection'
import Toast from '../components/Toast'
import { Badge } from '../components/ui/badge'
import { Button } from '../components/ui/button'
import { useOrganisationId } from '../hooks/useOrganisationId'
import { useToast } from '../hooks/useToast'

// Paramètres › Intégrations : configuration Brevo, sortie de la page Emailing (qui ne garde
// qu'un rappel avec un lien vers ici quand Brevo n'est pas configuré).

export default function ParametresIntegrationsPage() {
  const organisationId = useOrganisationId()
  const { toast, showToast, dismissToast } = useToast()
  const { auth } = useAuth()
  // Modification réservée à l'admin (et au super-admin en mode Consulter) ; la RPC le vérifie.
  const peutModifier = auth.type === 'super_admin' || (auth.type === 'admin' && auth.role === 'admin')
  const [config, setConfig] = useState<EtatConfigBrevo | null>(null)
  const [modalOpen, setModalOpen] = useState(false)

  useEffect(() => {
    if (!organisationId) return
    let cancelled = false
    void chargerEtatConfigBrevo(organisationId).then((etat) => {
      if (cancelled) return
      setConfig(etat ?? { cleConfiguree: false, expediteurNom: '', expediteurEmail: '' })
    })
    return () => { cancelled = true }
  }, [organisationId])

  const configured = config !== null && brevoConfigure(config)

  return (
    <div className="-m-6 min-h-[calc(100%+3rem)] space-y-6 bg-paper p-6 font-registre">
      <div>
        <h1 className="text-2xl font-bold text-ink md:text-3xl">Intégrations</h1>
        <p className="mt-1 text-sm text-ink-muted">Services externes utilisés par votre organisation.</p>
      </div>

      <ParametresSection
        title="Brevo"
        description="Compte Brevo de votre organisation, utilisé pour l'envoi des campagnes d'emailing."
      >
        {config === null ? (
          <p className="text-sm text-ink-faint">Chargement…</p>
        ) : (
          <div className="flex flex-wrap items-center gap-3">
            <Badge variant={configured ? 'success' : 'neutral'}>{configured ? 'Configuré' : 'Non configuré'}</Badge>
            {configured && (
              <span className="text-sm text-ink-muted">
                Expéditeur : {config.expediteurNom} &lt;{config.expediteurEmail}&gt;
              </span>
            )}
            {peutModifier ? (
              <Button type="button" variant="secondary" onClick={() => setModalOpen(true)}>
                {configured ? 'Modifier' : 'Configurer'}
              </Button>
            ) : (
              <span className="text-xs text-ink-faint">Seul un administrateur peut modifier cette configuration.</span>
            )}
          </div>
        )}
      </ParametresSection>

      {config && (
        <BrevoConfigModal
          open={modalOpen}
          onClose={() => setModalOpen(false)}
          onSaved={(values) => {
            setConfig(values)
            showToast('Configuration Brevo enregistrée')
          }}
          organisationId={organisationId}
          initial={config}
        />
      )}

      {toast && <Toast key={toast.id} message={toast.message} onDismiss={dismissToast} />}
    </div>
  )
}
