import { StatusNotice } from './ui/status-notice'
import { Button } from './ui/button'
import {
  estimerDureeEnvoi, estimerTempsRestant, formatDureeEnvoi, formatTempsRestant, lotTraites, type RythmeEnvoi,
} from '../lib/recusLot'
import type { RecuLot, RecuLotEchec } from '../types/recusLot'

interface RecusLotBandeauProps {
  lot: RecuLot
  echecs: RecuLotEchec[]
  /** Erreur de lecture de la liste des échecs. */
  erreurEchecs: string | null
  /** Reçus encore à traiter (relance possible) : manquants prêts à générer, ou non envoyés. */
  nbRestants: number
  /** Lot arrêté dont le reçu en cours de traitement n'est pas encore terminé. */
  arretEnCours: boolean
  actionEnCours: boolean
  onArreter: () => void
  onRelancer: () => void
  onFermer: () => void
  maintenant: number
  /** Lot d'envoi : rythme de l'organisation (estimation de fin). */
  rythme?: RythmeEnvoi
  /** Lot d'envoi : lignes faites sans email (dernière version déjà envoyée entre-temps). */
  nbDejaEnvoyes?: number
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

function formatReprise(iso: string): string {
  return new Date(iso).toLocaleString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })
}

const LIBELLES = {
  generation: {
    enCours: 'Génération des reçus',
    termine: 'Génération {annee} terminée',
    arrete: 'Génération {annee} arrêtée',
    demarrage: 'Démarrage du traitement dans la minute…',
    continue: 'La génération continue sur le serveur : vous pouvez fermer cette page.',
    fait: ['reçu généré', 'reçus générés'],
    arretEnCours: 'Arrêt en cours : le reçu en cours de génération se termine…',
    reprendre: 'Reprendre la génération',
    rienARelancer: 'Aucun reçu manquant prêt à générer (fiches à compléter, ou reçus déjà générés).',
  },
  envoi: {
    enCours: 'Envoi des reçus',
    termine: 'Envoi {annee} terminé',
    arrete: 'Envoi {annee} arrêté',
    demarrage: "Démarrage de l'envoi dans la minute…",
    continue: "L'envoi continue sur le serveur : vous pouvez fermer cette page.",
    fait: ['reçu envoyé', 'reçus envoyés'],
    arretEnCours: "Arrêt en cours : l'email en cours d'envoi se termine…",
    reprendre: "Reprendre l'envoi",
    rienARelancer: 'Aucun reçu à envoyer (emails manquants ou invalides, ou reçus déjà envoyés).',
  },
} as const

/**
 * Lot de reçus (génération ou envoi) : progression pendant le traitement (avec arrêt), puis bilan
 * (traités, échecs et envois à vérifier avec leur raison, relance).
 */
export default function RecusLotBandeau({
  lot, echecs, erreurEchecs, nbRestants, arretEnCours, actionEnCours, onArreter, onRelancer, onFermer, maintenant, rythme, nbDejaEnvoyes = 0,
}: RecusLotBandeauProps) {
  const envoi = lot.type === 'envoi'
  const l = LIBELLES[lot.type]
  const traites = lotTraites(lot)
  const pourcent = lot.nb_total > 0 ? Math.min(100, Math.round((traites / lot.nb_total) * 100)) : 0
  const nbAVerifier = lot.nb_a_verifier ?? 0

  if (lot.statut === 'en_cours') {
    const enAttente = envoi && lot.en_attente_jusqu_a && new Date(lot.en_attente_jusqu_a).getTime() > maintenant
      ? lot.en_attente_jusqu_a
      : null
    const restants = Math.max(0, lot.nb_total - traites)
    let avancement: string | null
    if (enAttente) avancement = `Quota d'envoi atteint : reprise ${formatReprise(enAttente)}`
    else if (traites === 0) avancement = l.demarrage
    else if (envoi && rythme) avancement = `${formatDureeEnvoi(estimerDureeEnvoi(restants, rythme))} au rythme actuel`
    else {
      const restant = estimerTempsRestant(lot, maintenant)
      avancement = restant !== null ? formatTempsRestant(restant) : null
    }
    return (
      <StatusNotice tone="neutral" aria-live="polite" heading={`${l.enCours} ${lot.annee} en cours`}>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0 flex-1">
            <p className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <span className="font-registre-mono text-base font-semibold text-ink">
                {nf.format(traites)} / {nf.format(lot.nb_total)}
              </span>
              {avancement && <span>{avancement}</span>}
              {lot.nb_echecs > 0 && (
                <span className="font-medium text-warning">{pluriel(lot.nb_echecs, 'échec')}</span>
              )}
              {nbAVerifier > 0 && (
                <span className="font-medium text-warning">{pluriel(nbAVerifier, 'à vérifier', 'à vérifier')}</span>
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
              {l.continue}
              {envoi && rythme && ` Rythme moyen : ${pluriel(rythme.parMinute, 'email')} par minute ; plafond : ${nf.format(rythme.parJour)} par jour.`}
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
  const aRelancer = arrete || lot.nb_echecs > 0
  const tone = arrete || lot.nb_echecs > 0 || nbAVerifier > 0 ? 'warning' : 'success'
  const faits = pluriel(lot.nb_faits, l.fait[0], l.fait[1])
  const suite = [
    lot.nb_echecs > 0 ? pluriel(lot.nb_echecs, 'échec') : null,
    nbAVerifier > 0 ? pluriel(nbAVerifier, 'à vérifier', 'à vérifier') : null,
  ].filter(Boolean).join(', ')
  const heading = arrete
    ? `${l.arrete.replace('{annee}', String(lot.annee))} : ${faits} sur ${nf.format(lot.nb_total)}`
    : `${l.termine.replace('{annee}', String(lot.annee))} : ${faits}${suite ? `, ${suite}` : ''}`

  return (
    <StatusNotice tone={tone} heading={heading}>
      {arretEnCours && <p>{l.arretEnCours}</p>}
      {arrete && !arretEnCours && nonTraites > 0 && (
        <p>{pluriel(nonTraites, 'reçu non traité', 'reçus non traités')}{suite && `, ${suite}`}.</p>
      )}
      {envoi && nbDejaEnvoyes > 0 && (
        <p>Dont {pluriel(nbDejaEnvoyes, 'reçu déjà envoyé', 'reçus déjà envoyés')} entre-temps (aucun nouvel email).</p>
      )}
      {nbAVerifier > 0 && (
        <p className="mt-1">
          Envoi incertain : l'email a pu partir. Vérifiez (journal des emails de Brevo, ou auprès du donateur), puis renvoyez-le si besoin
          depuis le détail du reçu ; ces reçus ne sont pas renvoyés automatiquement.
        </p>
      )}
      {erreurEchecs && <p className="mt-2 font-medium text-stamp">{erreurEchecs}</p>}
      {echecs.length > 0 && (
        <ul className="mt-2 max-h-48 divide-y divide-warning-border overflow-y-auto rounded-sm border border-warning-border bg-white">
          {echecs.map((e) => (
            <li key={e.id} className="px-3 py-2">
              <p className="flex flex-wrap items-baseline gap-x-2 font-medium text-ink">
                {nomDonateur(e)}
                {e.statut === 'a_verifier' && (
                  <span className="font-registre-mono text-[11px] font-medium uppercase tracking-wide text-warning">À vérifier</span>
                )}
              </p>
              <p className="mt-0.5 text-xs text-warning">{e.erreur ?? 'Erreur inconnue'}</p>
            </li>
          ))}
        </ul>
      )}
      <div className="mt-3 flex flex-wrap items-center gap-3">
        {aRelancer && (
          <Button size="sm" onClick={onRelancer} disabled={actionEnCours || arretEnCours || nbRestants === 0}>
            {arrete ? l.reprendre : 'Relancer les échecs'}
          </Button>
        )}
        <Button size="sm" variant="secondary" onClick={onFermer}>Fermer</Button>
        {aRelancer && !arretEnCours && nbRestants === 0 && (
          <span className="text-xs">{l.rienARelancer}</span>
        )}
      </div>
    </StatusNotice>
  )
}
