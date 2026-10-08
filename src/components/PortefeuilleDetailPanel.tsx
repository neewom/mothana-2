import type { ResumeAccesPortefeuille } from '../lib/evenementDashboard'
import { emailAffiche, libelleMoyenPaiement, libelleMouvementAdmin, libelleStatutCommande } from '../lib/evenementDashboard'
import { formatCentimes } from '../lib/portefeuilleAcheteur'
import type {
  AuteursParId,
  CommandeEvenement,
  MouvementPortefeuilleAdmin,
  PortefeuilleEvenement,
} from '../types/evenementDashboard'
import { Badge } from './ui/badge'
import { Button } from './ui/button'

interface PortefeuilleDetailPanelProps {
  portefeuille: PortefeuilleEvenement
  acces: ResumeAccesPortefeuille | undefined
  auteurs: AuteursParId
  mouvements: MouvementPortefeuilleAdmin[]
  commandes: CommandeEvenement[]
  busy: boolean
  freezing: boolean
  onClose: () => void
  onResend: () => void
  onToggleFreeze: () => void
  onRevoke: () => void
  onAnonymize: () => void
}

function formatDateTime(value: string): string {
  return new Intl.DateTimeFormat('fr-FR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value))
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="font-registre-mono text-xs font-medium uppercase tracking-wide text-ink-faint">{children}</p>
  )
}

export default function PortefeuilleDetailPanel({
  portefeuille,
  acces,
  auteurs,
  mouvements,
  commandes,
  busy,
  freezing,
  onClose,
  onResend,
  onToggleFreeze,
  onRevoke,
  onAnonymize,
}: PortefeuilleDetailPanelProps) {
  const actifs = acces?.actifs ?? 0
  const dernier = acces?.dernier ?? null
  const auteurCorrection = portefeuille.email_modifie_par ? auteurs.get(portefeuille.email_modifie_par) : undefined
  const auteurDernierLien = dernier?.cree_par ? auteurs.get(dernier.cree_par) : undefined
  const anonymise = portefeuille.anonymise_le !== null
  const auteurAnonymisation = portefeuille.anonymise_par ? auteurs.get(portefeuille.anonymise_par) : undefined

  return (
    <div className="flex h-full min-h-0 flex-col font-registre">
      <div className="flex items-center justify-between border-b border-paper-border px-6 py-4">
        <h2 className="text-lg font-semibold text-ink">Détail du portefeuille</h2>
        <button
          type="button"
          onClick={onClose}
          aria-label="Fermer le détail"
          className="rounded-sm p-1.5 text-ink-faint transition-colors hover:text-stamp focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stamp/70"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <div className="flex-1 space-y-5 overflow-y-auto px-6 py-5">
        <div>
          <SectionLabel>Identité</SectionLabel>
          <p className="mt-1 break-all font-semibold text-ink">{emailAffiche(portefeuille)}</p>
          {portefeuille.anonymise_le && (
            <p className="mt-0.5 text-xs text-ink-faint">
              Anonymisé le {formatDateTime(portefeuille.anonymise_le)}
              {portefeuille.anonymise_par
                ? auteurAnonymisation ? ` par ${auteurAnonymisation}` : ' par un administrateur'
                : ' automatiquement (fin de la durée de conservation)'}
            </p>
          )}
          {!anonymise && portefeuille.email_modifie_le && (
            <p className="mt-0.5 text-xs text-ink-faint">
              Adresse corrigée le {formatDateTime(portefeuille.email_modifie_le)}
              {auteurCorrection ? ` par ${auteurCorrection}` : ''}
            </p>
          )}
          <dl className="mt-3 space-y-3">
            <div>
              <dt className="text-xs text-ink-faint">Code public</dt>
              <dd className="mt-0.5 break-all font-registre-mono text-sm text-ink-muted">{portefeuille.code_public}</dd>
            </div>
            <div>
              <dt className="text-xs text-ink-faint">Statut</dt>
              <dd className="mt-0.5">
                <Badge variant={portefeuille.gele ? 'stamp' : 'neutral'}>{portefeuille.gele ? 'Gelé' : 'Actif'}</Badge>
              </dd>
            </div>
          </dl>
          <p className="mt-3 text-xs text-ink-faint">Solde</p>
          <p className="font-registre-mono text-xl font-bold tabular-nums text-ink">{formatCentimes(portefeuille.solde_centimes)}</p>
        </div>

        <div>
          <SectionLabel>Accès acheteur</SectionLabel>
          <p className="mt-1 text-sm text-ink">
            {actifs > 0
              ? `${actifs} lien${actifs > 1 ? 's' : ''} actif${actifs > 1 ? 's' : ''}`
              : (acces?.total ?? 0) > 0 ? 'Tous les liens sont révoqués' : 'Aucun lien généré'}
          </p>
          {dernier && (
            <p className="mt-0.5 text-xs text-ink-faint">
              Dernier lien : {formatDateTime(dernier.created_at)}
              {dernier.cree_par ? (auteurDernierLien ? `, par ${auteurDernierLien}` : ', par un administrateur') : ', à l’achat'}
            </p>
          )}
        </div>

        <div>
          <SectionLabel>Mouvements</SectionLabel>
          {mouvements.length === 0 ? (
            <p className="mt-1 text-sm text-ink-faint">Aucun mouvement</p>
          ) : (
            <ul className="mt-2 space-y-2">
              {mouvements.map((mouvement) => {
                const isDebit = mouvement.type === 'debit'
                return (
                  <li key={mouvement.id} className="rounded-sm border border-paper-border bg-paper px-4 py-3">
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-sm text-ink-muted">{libelleMouvementAdmin(mouvement.type)}</span>
                      <span className={`font-registre-mono text-sm font-semibold tabular-nums ${isDebit ? 'text-ink' : 'text-success'}`}>
                        {isDebit ? '−' : '+'}{formatCentimes(mouvement.montant_centimes)}
                      </span>
                    </div>
                    <p className="mt-0.5 font-registre-mono text-xs text-ink-faint">
                      {formatDateTime(mouvement.created_at)} · solde {formatCentimes(mouvement.solde_apres_centimes)}
                    </p>
                  </li>
                )
              })}
            </ul>
          )}
        </div>

        <div>
          <SectionLabel>Commandes</SectionLabel>
          {commandes.length === 0 ? (
            <p className="mt-1 text-sm text-ink-faint">Aucune commande</p>
          ) : (
            <ul className="mt-2 space-y-2">
              {commandes.map((commande) => (
                <li key={commande.id} className="rounded-sm border border-paper-border bg-paper px-4 py-3">
                  <div className="flex items-center justify-between gap-3">
                    <span className="font-registre-mono text-sm font-semibold tabular-nums text-ink">{formatCentimes(commande.montant_centimes)}</span>
                    <Badge variant={commande.statut === 'payee' ? 'success' : commande.statut === 'en_attente_paiement' ? 'warning' : 'neutral'}>
                      {libelleStatutCommande(commande.statut)}
                    </Badge>
                  </div>
                  <p className="mt-0.5 font-registre-mono text-xs text-ink-faint">
                    {formatDateTime(commande.created_at)} · {libelleMoyenPaiement(commande.moyen_paiement)}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div className="space-y-2 border-t border-paper-border px-6 py-4">
        <div className="flex gap-2">
          {!anonymise && (
            <Button type="button" className="flex-1" disabled={busy} onClick={onResend}>
              Renvoyer l’accès
            </Button>
          )}
          <Button type="button" variant="secondary" className="flex-1" disabled={busy} onClick={onToggleFreeze}>
            {freezing ? 'Mise à jour…' : portefeuille.gele ? 'Dégeler' : 'Geler'}
          </Button>
        </div>
        {!anonymise && (
          <>
            <Button type="button" variant="danger" className="w-full" disabled={busy || actifs === 0} onClick={onRevoke}>
              Révoquer tous les accès
            </Button>
            <Button type="button" variant="danger" className="w-full" disabled={busy} onClick={onAnonymize}>
              Anonymiser cet acheteur
            </Button>
          </>
        )}
      </div>
    </div>
  )
}
