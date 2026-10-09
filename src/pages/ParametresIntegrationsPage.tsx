import { useEffect, useState } from 'react'
import BrevoConfigModal, { type BrevoConfigValues } from '../components/BrevoConfigModal'
import ParametresSection from '../components/ParametresSection'
import Toast from '../components/Toast'
import { Badge } from '../components/ui/badge'
import { Button } from '../components/ui/button'
import { useOrganisationId } from '../hooks/useOrganisationId'
import { useToast } from '../hooks/useToast'
import { supabase } from '../lib/supabaseClient'

// Paramètres › Intégrations : configuration Brevo, sortie de la page Emailing (qui ne garde
// qu'un rappel avec un lien vers ici quand Brevo n'est pas configuré).

interface BrevoRow {
  brevo_api_key: string | null
  brevo_expediteur_nom: string | null
  brevo_expediteur_email: string | null
}

function isConfigured(values: BrevoConfigValues): boolean {
  return !!(values.apiKey.trim() && values.expediteurNom.trim() && values.expediteurEmail.trim())
}

export default function ParametresIntegrationsPage() {
  const organisationId = useOrganisationId()
  const { toast, showToast, dismissToast } = useToast()
  const [config, setConfig] = useState<BrevoConfigValues | null>(null)
  const [modalOpen, setModalOpen] = useState(false)

  useEffect(() => {
    if (!organisationId) return
    let cancelled = false
    void supabase
      .from('organisations')
      .select('brevo_api_key, brevo_expediteur_nom, brevo_expediteur_email')
      .eq('id', organisationId)
      .single()
      .then(({ data }) => {
        if (cancelled) return
        const row = data as BrevoRow | null
        setConfig({
          apiKey: row?.brevo_api_key ?? '',
          expediteurNom: row?.brevo_expediteur_nom ?? '',
          expediteurEmail: row?.brevo_expediteur_email ?? '',
        })
      })
    return () => { cancelled = true }
  }, [organisationId])

  const configured = config !== null && isConfigured(config)

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
            <Button type="button" variant="secondary" onClick={() => setModalOpen(true)}>
              {configured ? 'Modifier' : 'Configurer'}
            </Button>
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
