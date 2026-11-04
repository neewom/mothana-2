import { StatusNotice } from './ui/status-notice'
import { Button } from './ui/button'
import { estimerTempsRestant, formatTempsRestant, lotTraites } from '../lib/recusLot'
import type { RecuLot, RecuLotEchec } from '../types/recusLot'

interface RecusLotBandeauProps {
  lot: RecuLot
  echecs: RecuLotEchec[]
  /** Reçus manquants prêts à générer (relance possible). */
  nbManquants: number
  /** Lot arrêté dont le reçu en cours de génération n'est pas encore terminé. */
  arretEnCours: boolean
  actionEnCours: boolean
  onArreter: () => void
  onRelancer: () => void
  onFermer: () => void
  maintenant: number
}

const nf = new Intl.NumberFormat('fr-FR')

function pluriel(n: number, singulier: string, plurielForme = `${singulier}s`) {
  return `${nf.format(n)} ${n > 1 ? plurielForme : singulier}`
}

function nomDonateur(e: RecuLotEchec): string {
  const p = e.profils_participant?.personnes
  if (!p) return 'Donateur'
  return [p.prenom, p.nom].filter(Boolean).join(' ')
}

/**
 * Lot de génération de reçus : progression pendant le traitement (avec arrêt), puis bilan
 * (générés, échecs et leur raison, relance).
 */
export default function RecusLotBandeau({
  lot, echecs, nbManquants, arretEnCours, actionEnCours, onArreter, onRelancer, onFermer, maintenant,
}: RecusLotBandeauProps) {
  const traites = lotTraites(lot)
  const pourcent = lot.nb_total > 0 ? Math.min(100, Math.round((traites / lot.nb_total) * 100)) : 0

  if (lot.statut === 'en_cours') {
    const restant = estimerTempsRestant(lot, maintenant)
    return (
      <StatusNotice tone="neutral" aria-live="polite" heading={`Génération des reçus ${lot.annee} en cours`}>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0 flex-1">
            <p className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <span className="font-registre-mono text-base font-semibold text-ink">
                {nf.format(traites)} / {nf.format(lot.nb_total)}
              </span>
              <span>
                {traites === 0
                  ? 'Démarrage du traitement dans la minute…'
                  : restant !== null && formatTempsRestant(restant)}
              </span>
              {lot.nb_echecs > 0 && (
                <span className="font-medium text-warning">{pluriel(lot.nb_echecs, 'échec')}</span>
              )}
            </p>
            <div
              className="mt-2 h-2 w-full overflow-hidden rounded-full bg-paper-border"
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={lot.nb_total}
              aria-valuenow={traites}
              aria-label="Reçus traités"
            >
              <div className="h-full rounded-full bg-success transition-[width] duration-500" style={{ width: `${pourcent}%` }} />
            </div>
            <p className="mt-2 text-xs text-ink-faint">
              La génération continue sur le serveur : vous pouvez fermer cette page.
            </p>
          </div>
          <Button variant="danger" size="sm" className="shrink-0 self-start sm:self-end" onClick={onArreter} disabled={actionEnCours}>
            {actionEnCours ? 'Arrêt…' : 'Arrêter'}
          </Button>
        </div>
      </StatusNotice>
    )
  }

  const arrete = lot.statut === 'arrete'
  const nonTraites = Math.max(0, lot.nb_total - traites)
  const tone = arrete || lot.nb_echecs > 0 ? 'warning' : 'success'
  const heading = arrete
    ? `Génération ${lot.annee} arrêtée : ${pluriel(lot.nb_faits, 'reçu généré', 'reçus générés')} sur ${nf.format(lot.nb_total)}`
    : `Génération ${lot.annee} terminée : ${pluriel(lot.nb_faits, 'reçu généré', 'reçus générés')}${lot.nb_echecs > 0 ? `, ${pluriel(lot.nb_echecs, 'échec')}` : ''}`

  return (
    <StatusNotice tone={tone} heading={heading}>
      {arretEnCours && <p>Arrêt en cours : le reçu en cours de génération se termine…</p>}
      {arrete && !arretEnCours && nonTraites > 0 && (
        <p>{pluriel(nonTraites, 'reçu non traité', 'reçus non traités')}{lot.nb_echecs > 0 && `, ${pluriel(lot.nb_echecs, 'échec')}`}.</p>
      )}
      {echecs.length > 0 && (
        <ul className="mt-2 max-h-48 divide-y divide-warning-border overflow-y-auto rounded-sm border border-warning-border bg-white">
          {echecs.map((e) => (
            <li key={e.id} className="px-3 py-2">
              <p className="font-medium text-ink">{nomDonateur(e)}</p>
              <p className="mt-0.5 text-xs text-warning">{e.erreur ?? 'Erreur inconnue'}</p>
            </li>
          ))}
        </ul>
      )}
      <div className="mt-3 flex flex-wrap items-center gap-3">
        {(arrete || lot.nb_echecs > 0) && (
          <Button size="sm" onClick={onRelancer} disabled={actionEnCours || arretEnCours || nbManquants === 0}>
            {arrete ? 'Reprendre la génération' : 'Relancer les échecs'}
          </Button>
        )}
        <Button size="sm" variant="secondary" onClick={onFermer}>Fermer</Button>
        {(arrete || lot.nb_echecs > 0) && !arretEnCours && nbManquants === 0 && (
          <span className="text-xs">Aucun reçu manquant prêt à générer (fiches à compléter, ou reçus déjà générés).</span>
        )}
      </div>
    </StatusNotice>
  )
}
