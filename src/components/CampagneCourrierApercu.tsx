import { DetailField } from './ui/side-panel'
import { DestinatairesCampagne, NotesCampagne, type ConfigDestinataires } from './CampagneDetailCommun'
import { NON_ENREGISTRE, libelleAuteur } from '../lib/campagneMailingDetail'
import { RAISON_EXCLUSION_COURRIER_LABELS, estCampagneCourrierAnterieure } from '../lib/campagneCourrierDetail'

// Détail d'une campagne de l'historique Courrier, dans le panneau latéral
// (carte « Courrier : détail figé et notes », 2026-11-10) — même panneau que l'Emailing.

export interface CampagneCourrierHistorique {
  id: string
  activite_id: string
  selection_label: string
  exclusion_label: string | null
  detail_enregistre: boolean
  nombre_destinataires: number
  nombre_exclus: number
  created_at: string
  genere_par: string | null
  notes: string | null
  activites: { nom: string } | null
}

const CONFIG_DESTINATAIRES: ConfigDestinataires = {
  table: 'campagnes_courrier_destinataires',
  rpc: 'rechercher_destinataires_campagne_courrier',
  statutRetenus: 'genere',
  libelleRetenus: 'Étiquettes',
  champSecondaire: 'adresse',
  placeholderRecherche: 'Nom ou adresse…',
  raisons: RAISON_EXCLUSION_COURRIER_LABELS,
  messageAucuneLigne: 'Aucun destinataire à afficher : adhérents supprimés depuis la génération, ou détail non enregistré lors de la génération.',
  noteSupprimes: "Les adhérents supprimés depuis la génération n'apparaissent plus ; les compteurs restent ceux de la génération.",
}

function formatDateHeure(iso: string): string {
  return new Date(iso).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

export function CampagneCourrierApercuTitre({ campagne }: { campagne: CampagneCourrierHistorique }) {
  return (
    <span className="block">
      <span className="block break-words">{campagne.activites?.nom ?? 'Campagne courrier'}</span>
      <span className="mt-0.5 block font-registre-mono text-[11px] font-medium uppercase tracking-wide text-ink-faint">
        Générée le {formatDateHeure(campagne.created_at)}
      </span>
    </span>
  )
}

export function CampagneCourrierApercuChamps({
  campagne,
  auteurs,
  onNotesSaved,
}: {
  campagne: CampagneCourrierHistorique
  auteurs: ReadonlyMap<string, string>
  onNotesSaved: (id: string, notes: string | null) => void
}) {
  const anterieure = estCampagneCourrierAnterieure(campagne)
  // L'activité est le titre du panneau (CampagneCourrierApercuTitre) : pas de champ en double.

  return (
    <>
      <DetailField label="Générée par">{libelleAuteur(campagne.genere_par, auteurs)}</DetailField>

      <DetailField label="Sélection">
        <p className="break-words">{campagne.selection_label}</p>
        {anterieure ? (
          <p className="text-ink-faint">Exclusion non enregistrée (campagne antérieure)</p>
        ) : (
          campagne.exclusion_label && <p className="break-words text-ink-muted">{campagne.exclusion_label}</p>
        )}
      </DetailField>

      <div className="grid grid-cols-2 gap-4">
        <DetailField label="Destinataires"><span className="font-registre-mono">{campagne.nombre_destinataires}</span></DetailField>
        <DetailField label="Exclus"><span className="font-registre-mono">{campagne.nombre_exclus}</span></DetailField>
      </div>

      <NotesCampagne key={`notes-${campagne.id}`} campagneId={campagne.id} notes={campagne.notes} rpc="modifier_note_campagne_courrier" onSaved={onNotesSaved} />

      {anterieure ? (
        <DetailField label="Destinataires">
          <span className="text-ink-faint">{NON_ENREGISTRE}</span>
        </DetailField>
      ) : (
        <DestinatairesCampagne
          key={`destinataires-${campagne.id}`}
          campagneId={campagne.id}
          attendus={campagne.nombre_destinataires + campagne.nombre_exclus}
          config={CONFIG_DESTINATAIRES}
        />
      )}
    </>
  )
}
