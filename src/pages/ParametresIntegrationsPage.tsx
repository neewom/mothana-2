import { Fragment, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import BrevoConfigModal from '../components/BrevoConfigModal'
import {
  brevoConfigure,
  chargerEtatConfigBrevo,
  verifierExpediteurBrevo,
  type EtatConfigBrevo,
  type StatutExpediteurBrevo,
} from '../lib/brevoConfig'
import { useAdminOutletContext } from '../hooks/useAdminOutletContext'
import { useAuth } from '../hooks/useAuth'
import ParametresSection from '../components/ParametresSection'
import Toast from '../components/Toast'
import { Badge } from '../components/ui/badge'
import { Button } from '../components/ui/button'
import { StatusNotice } from '../components/ui/status-notice'
import { useOrganisationId } from '../hooks/useOrganisationId'
import { useToast } from '../hooks/useToast'

// Paramètres › Intégrations : configuration Brevo, sortie de la page Emailing (qui ne garde
// qu'un rappel avec un lien vers ici quand Brevo n'est pas configuré). Brevo sert aussi à l'envoi
// des reçus fiscaux par email (Dons › Paramètres).

const LIEN_EXPEDITEURS_BREVO = 'https://app.brevo.com/senders/list'

// Libellé et ton du badge d'état réel de l'expéditeur dans Brevo (carte B4). null = vérification en cours.
function badgeExpediteur(statut: StatutExpediteurBrevo | null): { label: string; variant: 'success' | 'warning' | 'neutral' } {
  switch (statut) {
    case null:
      return { label: 'Vérification…', variant: 'neutral' }
    case 'valide':
      return { label: 'Validé dans Brevo', variant: 'success' }
    case 'en_attente':
      return { label: 'En attente de validation', variant: 'warning' }
    case 'introuvable':
      return { label: 'Introuvable dans Brevo', variant: 'warning' }
    default:
      return { label: 'Vérification impossible', variant: 'neutral' }
  }
}

function LienExpediteursBrevo() {
  return (
    <a
      href={LIEN_EXPEDITEURS_BREVO}
      target="_blank"
      rel="noreferrer"
      className="font-medium text-stamp underline underline-offset-2 hover:no-underline"
    >
      Ouvrir les expéditeurs Brevo
    </a>
  )
}

export default function ParametresIntegrationsPage() {
  const organisationId = useOrganisationId()
  const { toast, showToast, dismissToast } = useToast()
  const { auth } = useAuth()
  const { fonctionnalitesActivees: flags } = useAdminOutletContext()
  // Fonctionnalités qui passent par Brevo, selon les modules actifs.
  const utilisations = [
    ...(flags?.adherents ? [{ label: 'Emailing', to: '/admin/communication/emailing' }] : []),
    ...(flags?.dons ? [{ label: 'Reçus fiscaux', to: '/admin/dons/parametres#email-recus' }] : []),
  ]
  // Modification réservée à l'admin (et au super-admin en mode Consulter) ; la RPC le vérifie.
  const peutModifier = auth.type === 'super_admin' || (auth.type === 'admin' && auth.role === 'admin')
  const [config, setConfig] = useState<EtatConfigBrevo | null>(null)
  const [modalOpen, setModalOpen] = useState(false)
  // État réel de l'expéditeur dans Brevo : null pendant la vérification ; `verification` relance.
  const [statutExpediteur, setStatutExpediteur] = useState<StatutExpediteurBrevo | null>(null)
  const [verification, setVerification] = useState(0)

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

  useEffect(() => {
    if (!organisationId || !configured) return
    let cancelled = false
    setStatutExpediteur(null)
    void verifierExpediteurBrevo(organisationId).then((statut) => {
      if (!cancelled) setStatutExpediteur(statut)
    })
    return () => { cancelled = true }
  }, [organisationId, configured, config?.expediteurEmail, verification])

  const badge = badgeExpediteur(statutExpediteur)

  return (
    <div className="-m-6 min-h-[calc(100%+3rem)] space-y-6 bg-paper p-6 font-registre">
      <div>
        <h1 className="text-2xl font-bold text-ink md:text-3xl">Intégrations</h1>
        <p className="mt-1 text-sm text-ink-muted">Services externes utilisés par votre organisation.</p>
      </div>

      <ParametresSection
        title="Brevo"
        description="Compte Brevo de votre organisation, utilisé pour les campagnes d'emailing et l'envoi des reçus fiscaux par email."
      >
        {utilisations.length > 0 && (
          <p className="mb-4 text-sm text-ink-muted">
            Utilisé par :{' '}
            {utilisations.map((u, i) => (
              <Fragment key={u.to}>
                {i > 0 && ' · '}
                <Link to={u.to} className="font-medium text-stamp underline underline-offset-2 hover:no-underline">{u.label}</Link>
              </Fragment>
            ))}
          </p>
        )}
        {config === null ? (
          <p className="text-sm text-ink-faint">Chargement…</p>
        ) : (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-3">
              <Badge variant={configured ? 'success' : 'neutral'}>{configured ? 'Configuré' : 'Non configuré'}</Badge>
              {peutModifier ? (
                <Button type="button" variant="secondary" onClick={() => setModalOpen(true)}>
                  {configured ? 'Modifier' : 'Configurer'}
                </Button>
              ) : (
                <span className="text-xs text-ink-faint">Seul un administrateur peut modifier cette configuration.</span>
              )}
            </div>
            {configured && (
              <div className="space-y-3 border-t border-paper-border pt-4">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                  <span className="min-w-0 break-words text-sm text-ink-muted">
                    Expéditeur : {config.expediteurNom} &lt;{config.expediteurEmail}&gt;
                  </span>
                  <Badge variant={badge.variant} aria-live="polite">{badge.label}</Badge>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    disabled={statutExpediteur === null}
                    onClick={() => setVerification((n) => n + 1)}
                  >
                    Revérifier
                  </Button>
                </div>
                {statutExpediteur === 'en_attente' && (
                  <StatusNotice tone="warning">
                    Brevo n'a pas encore validé cette adresse : les emails (campagnes, reçus) seront refusés tant
                    qu'elle n'est pas validée. Cliquez sur le lien de confirmation envoyé par Brevo à cette adresse,
                    ou authentifiez votre domaine, puis revérifiez. <LienExpediteursBrevo />
                  </StatusNotice>
                )}
                {statutExpediteur === 'introuvable' && (
                  <StatusNotice tone="warning">
                    Cette adresse ne figure pas parmi les expéditeurs de votre compte Brevo : les emails seront
                    refusés. Ajoutez-la dans Brevo{peutModifier ? ', ou corrigez l\'adresse avec « Modifier »' : ''}, puis
                    revérifiez. <LienExpediteursBrevo />
                  </StatusNotice>
                )}
                {statutExpediteur === 'erreur' && (
                  <p className="text-sm text-ink-muted">
                    Brevo n'a pas pu confirmer l'état de l'expéditeur (service indisponible ou clé API refusée).
                    Revérifiez dans un instant ; si cela persiste, contrôlez la clé API.
                  </p>
                )}
              </div>
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
