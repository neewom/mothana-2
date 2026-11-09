import type { Adherent, Adhesion } from '../types'
import { CIVILITE_ADHERENT_LABELS } from '../lib/civiliteAdherent'
import { libelleAdhesion } from '../lib/adherentsFiltres'
import { MODE_PAIEMENT_LABELS } from '../lib/modePaiement'
import { libelleRejetEmail } from '../lib/emailInvalide'
import { Badge } from './ui/badge'
import { Button } from './ui/button'
import { DetailField } from './ui/side-panel'
import type { AdherentFiche } from '../hooks/useAdherentApercu'

// Aperçu d'un adhérent dans le panneau latéral de la page Adhérents (carte A1, 2026-11-09) :
// lecture seule, le formulaire complet reste dans AdherentModal (bouton « Modifier »).

function dateFr(iso: string | null | undefined): string {
  if (!iso) return '—'
  const [annee, mois, jour] = iso.slice(0, 10).split('-')
  return `${jour}/${mois}/${annee}`
}

function formatEur(n: number): string {
  return n.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })
}

export function AdherentApercuTitre({ adherent }: { adherent: Adherent }) {
  return (
    <span className="block">
      <span className="block break-words">
        {adherent.nom}
        {adherent.prenom && <span className="font-normal text-ink-muted"> {adherent.prenom}</span>}
      </span>
      {adherent.id_externe && (
        <span className="mt-0.5 block font-registre-mono text-[11px] font-medium uppercase tracking-wide text-ink-faint">
          N° {adherent.id_externe}
        </span>
      )}
    </span>
  )
}

export function AdherentApercuChamps({
  fiche,
  adhesion,
  todayIso,
}: {
  fiche: AdherentFiche
  /** undefined : en cours de chargement ; null : aucune adhésion. */
  adhesion: Adhesion | null | undefined
  todayIso: string
}) {
  const etat = adhesion === undefined ? null : libelleAdhesion(adhesion ?? undefined, todayIso)
  const rejet = fiche.email_invalide_at
    ? libelleRejetEmail(fiche.email_invalide_evenement ?? null, fiche.email_invalide_raison ?? null)
    : null
  const ligneVille = [fiche.code_postal, fiche.ville].filter(Boolean).join(' ')
  const aAdresse = Boolean(fiche.adresse || ligneVille || fiche.pays)

  return (
    <>
      <DetailField label="Adhésion">
        <div className="flex flex-wrap items-center gap-1.5">
          {etat ? <Badge variant={etat.variant}>{etat.label}</Badge> : <span className="text-ink-faint">Chargement…</span>}
          {fiche.statut === 'archive' && <Badge variant="neutral">Fiche archivée</Badge>}
        </div>
      </DetailField>

      {adhesion && (
        <div className="grid grid-cols-2 gap-4">
          <DetailField label="Dernière adhésion">{dateFr(adhesion.date_debut)}</DetailField>
          <DetailField label="Cotisation">
            {adhesion.montant_cotisation != null ? (
              <span className="font-registre-mono">{formatEur(adhesion.montant_cotisation)}</span>
            ) : '—'}
            {adhesion.mode_paiement != null && (
              <p className="text-ink-muted">{MODE_PAIEMENT_LABELS[adhesion.mode_paiement]}</p>
            )}
          </DetailField>
        </div>
      )}

      <DetailField label="Contact">
        {fiche.courriel || fiche.telephone ? (
          <>
            {fiche.courriel && <p className="break-words">{fiche.courriel}</p>}
            {fiche.email_invalide_at && (
              <p className="mt-0.5 font-registre-mono text-[11px] text-warning">
                Email invalide — {rejet ? `${rejet} · ` : ''}le {new Date(fiche.email_invalide_at).toLocaleDateString('fr-FR')}
              </p>
            )}
            {fiche.telephone && <p className="font-registre-mono text-ink-muted">{fiche.telephone}</p>}
          </>
        ) : (
          <span className="text-ink-faint">—</span>
        )}
      </DetailField>

      <DetailField label="Adresse">
        {aAdresse ? (
          <>
            {fiche.adresse && <p>{fiche.adresse}</p>}
            {ligneVille && <p>{ligneVille}</p>}
            {fiche.pays && <p>{fiche.pays}</p>}
          </>
        ) : (
          <span className="text-ink-faint">—</span>
        )}
      </DetailField>

      <div className="grid grid-cols-2 gap-4">
        <DetailField label="Civilité">{fiche.civilite ? CIVILITE_ADHERENT_LABELS[fiche.civilite] : '—'}</DetailField>
        <DetailField label="Naissance">{dateFr(fiche.date_naissance)}</DetailField>
      </div>

      <DetailField label="Listes de diffusion">
        {fiche.tags.length > 0 ? (
          <div className="flex flex-wrap gap-1.5">
            {fiche.tags.map((tag) => <Badge key={tag} variant="neutral">{tag}</Badge>)}
          </div>
        ) : (
          <span className="text-ink-faint">Aucune</span>
        )}
      </DetailField>
    </>
  )
}

export function AdherentApercuActions({
  fiche,
  printing,
  printHelpText,
  onEdit,
  onRenew,
  onPrintCard,
}: {
  fiche: Adherent
  printing: boolean
  printHelpText: string
  onEdit: () => void
  onRenew: () => void
  onPrintCard: () => void
}) {
  return (
    <>
      <Button onClick={onEdit} className="w-full">Modifier</Button>
      <div className="flex gap-2">
        {/* Comme dans la modale : pas de renouvellement pour une fiche archivée (la réactiver d'abord). */}
        {fiche.statut === 'actif' && (
          <Button variant="secondary" onClick={onRenew} className="flex-1">Renouveler</Button>
        )}
        <Button variant="secondary" onClick={onPrintCard} disabled={printing} title={printHelpText} className="flex-1">
          {printing ? 'Génération…' : 'Carte'}
        </Button>
      </div>
    </>
  )
}
