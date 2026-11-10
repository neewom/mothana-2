import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import {
  NON_ENREGISTRE,
  affichagePiecesJointes,
  RAISON_EXCLUSION_LABELS,
  documentApercuMessage,
  estCampagneAnterieure,
  libelleAuteur,
} from '../lib/campagneMailingDetail'
import { Button } from './ui/button'
import { DetailField } from './ui/side-panel'
import { DestinatairesCampagne, NotesCampagne, type ConfigDestinataires } from './CampagneDetailCommun'
import { Dialog, DialogContent, DialogTitle } from './ui/dialog'

// Détail d'une campagne de l'historique d'Emailing, dans le panneau latéral
// (carte « Emailing : détail figé et notes », 2026-11-09).

export interface CampagneHistorique {
  id: string
  sujet: string
  nombre_destinataires: number
  nombre_exclus: number
  created_at: string
  envoye_par: string | null
  selection_label: string | null
  exclusion_label: string | null
  nombre_pieces_jointes: number | null
  pieces_jointes_noms: string[] | null
  notes: string | null
}

const CONFIG_DESTINATAIRES: ConfigDestinataires = {
  table: 'campagnes_mailing_destinataires',
  rpc: 'rechercher_destinataires_campagne',
  statutRetenus: 'envoye',
  libelleRetenus: 'Envoyés',
  champSecondaire: 'courriel',
  placeholderRecherche: 'Nom ou email…',
  raisons: RAISON_EXCLUSION_LABELS,
  messageAucuneLigne: "Aucun destinataire à afficher : adhérents supprimés depuis l'envoi, ou détail non enregistré lors de l'envoi.",
  noteSupprimes: "Les adhérents supprimés depuis l'envoi n'apparaissent plus ; les compteurs restent ceux de l'envoi.",
}

function formatDateHeure(iso: string): string {
  return new Date(iso).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

export function CampagneMailingApercuTitre({ campagne }: { campagne: CampagneHistorique }) {
  return (
    <span className="block">
      <span className="block break-words">{campagne.sujet}</span>
      <span className="mt-0.5 block font-registre-mono text-[11px] font-medium uppercase tracking-wide text-ink-faint">
        Envoyée le {formatDateHeure(campagne.created_at)}
      </span>
    </span>
  )
}

function pluriel(n: number, mot: string): string {
  return `${n} ${mot}${n > 1 ? 's' : ''}`
}

export function CampagneMailingApercuChamps({
  campagne,
  auteurs,
  onNotesSaved,
}: {
  campagne: CampagneHistorique
  auteurs: ReadonlyMap<string, string>
  onNotesSaved: (id: string, notes: string | null) => void
}) {
  const anterieure = estCampagneAnterieure(campagne)

  return (
    <>
      <DetailField label="Envoyée par">{libelleAuteur(campagne.envoye_par, auteurs)}</DetailField>

      <DetailField label="Sélection">
        {anterieure ? (
          <span className="text-ink-faint">{NON_ENREGISTRE}</span>
        ) : (
          <>
            <p className="break-words">{campagne.selection_label}</p>
            {campagne.exclusion_label && <p className="break-words text-ink-muted">{campagne.exclusion_label}</p>}
          </>
        )}
      </DetailField>

      <div className="grid grid-cols-2 gap-4">
        <DetailField label="Envoyés"><span className="font-registre-mono">{campagne.nombre_destinataires}</span></DetailField>
        <DetailField label="Exclus"><span className="font-registre-mono">{campagne.nombre_exclus}</span></DetailField>
      </div>

      <NotesCampagne key={`notes-${campagne.id}`} campagneId={campagne.id} notes={campagne.notes} rpc="modifier_note_campagne_mailing" onSaved={onNotesSaved} />

      <ApercuMessage campagneId={campagne.id} sujet={campagne.sujet} />

      <PiecesJointes campagne={campagne} />

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

/** Noms seuls, en texte simple : les fichiers ne sont pas conservés. */
function PiecesJointes({ campagne }: { campagne: CampagneHistorique }) {
  const affichage = affichagePiecesJointes(campagne.pieces_jointes_noms, campagne.nombre_pieces_jointes)
  return (
    <DetailField label="Pièces jointes">
      {affichage.kind === 'non_enregistre' ? (
        <span className="text-ink-faint">{NON_ENREGISTRE}</span>
      ) : affichage.kind === 'aucune' ? (
        'Aucune'
      ) : affichage.kind === 'nombre' ? (
        pluriel(affichage.nombre, 'fichier')
      ) : (
        <ul className="space-y-0.5">
          {affichage.noms.map((nom, i) => (
            <li key={`${i}-${nom}`} className="break-all">{nom}</li>
          ))}
        </ul>
      )}
    </DetailField>
  )
}

/** Corps du message relu à l'ouverture, rendu dans un iframe `sandbox` sans scripts (jamais injecté dans la page). */
function ApercuMessage({ campagneId, sujet }: { campagneId: string; sujet: string }) {
  const [corps, setCorps] = useState<{ id: string; html: string | null; erreur: boolean } | null>(null)
  const [agrandi, setAgrandi] = useState(false)

  useEffect(() => {
    let annule = false
    supabase
      .from('campagnes_mailing')
      .select('corps_html')
      .eq('id', campagneId)
      .single()
      .then(({ data, error }) => {
        if (annule) return
        setCorps({ id: campagneId, html: (data as { corps_html: string } | null)?.corps_html ?? null, erreur: !!error })
      })
    return () => { annule = true }
  }, [campagneId])

  const courant = corps?.id === campagneId ? corps : null
  const doc = courant?.html != null ? documentApercuMessage(courant.html) : null

  return (
    <DetailField label="Message">
      {!courant ? (
        <span className="text-ink-faint">Chargement…</span>
      ) : courant.erreur || doc === null ? (
        <span className="text-stamp">Impossible de charger le message.</span>
      ) : (
        <>
          <iframe
            title={`Aperçu du message « ${sujet} »`}
            sandbox="allow-popups allow-popups-to-escape-sandbox"
            srcDoc={doc}
            className="h-48 w-full rounded-sm border border-paper-border bg-white"
          />
          <p className="mt-1 text-xs text-ink-faint">Les images externes peuvent ne pas s'afficher dans cet aperçu.</p>
          <button
            type="button"
            onClick={() => setAgrandi(true)}
            className="mt-1.5 rounded-sm text-xs font-medium text-stamp hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stamp/70"
          >
            Voir en grand
          </button>
          <Dialog open={agrandi} onOpenChange={setAgrandi}>
            <DialogContent className="max-w-3xl" aria-describedby={undefined}>
              <div className="flex max-h-[85vh] flex-col p-6">
                <DialogTitle className="break-words pr-8">{sujet}</DialogTitle>
                <iframe
                  title={`Message « ${sujet} »`}
                  sandbox="allow-popups allow-popups-to-escape-sandbox"
                  srcDoc={doc}
                  className="mt-4 h-[65vh] w-full rounded-sm border border-paper-border bg-white"
                />
                <div className="mt-4 flex justify-end">
                  <Button type="button" variant="secondary" onClick={() => setAgrandi(false)}>Fermer</Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </>
      )}
    </DetailField>
  )
}
